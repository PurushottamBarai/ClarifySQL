import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { createConnectionManager, closeConnection, inspectLiveSchema } from '../src/db/connectionManager.js';
import { decryptDatabaseConfig, encryptDatabaseConfig } from '../src/security/databaseConfig.js';

const config = { host: 'db.example.com', port: 3306, user: 'reader', password: 'secret', database: 'app' };
const env = { DATABASE_CONFIG_KEY: randomBytes(32).toString('base64'), DATABASE_CONNECT_TIMEOUT_MS: '50', DATABASE_INSPECT_TIMEOUT_MS: '50' };
const columns = [
  { TABLE_NAME: 'users', COLUMN_NAME: 'id', DATA_TYPE: 'INT', IS_NULLABLE: 'NO', COLUMN_KEY: 'PRI' },
  { TABLE_NAME: 'posts', COLUMN_NAME: 'user_id', DATA_TYPE: 'INT', IS_NULLABLE: 'YES', COLUMN_KEY: '' }
];
const foreignKeys = [{ TABLE_NAME: 'posts', COLUMN_NAME: 'user_id', REFERENCED_TABLE_NAME: 'users', REFERENCED_COLUMN_NAME: 'id' }];
function fakeConnection(query) {
  return {
    ended: 0, destroyed: 0, queries: [],
    async query(options, values) {
      this.queries.push({ options, values });
      if (query) return query(options, values);
      return [options.sql.includes('information_schema.COLUMNS') ? columns : foreignKeys];
    },
    async end() { this.ended++; },
    destroy() { this.destroyed++; }
  };
}
const resolve = async () => [{ address: '8.8.8.8', family: 4 }];

test('inspection uses a request-scoped connection, pins DNS, preserves TLS host, and closes', async () => {
  const connection = fakeConnection();
  let driverConfig;
  let socketConfig;
  let lookups = 0;
  const manager = createConnectionManager({
    env,
    resolve: async () => { lookups++; return resolve(); },
    mysqlCreateConnection: async options => { driverConfig = options; options.stream(); return connection; },
    connectSocket: options => { socketConfig = options; return { destroy() {} }; }
  });
  const result = await manager.createConnection(config);
  assert.deepEqual(decryptDatabaseConfig(result.encryptedConfig, { env }), config);
  assert.equal(result.database, config.database);
  assert.equal(result.host, config.host);
  assert.equal(result.user, config.user);
  assert.equal(result.liveSchema.tables.length, 2);
  assert.deepEqual(result.liveSchema.tables[0].primaryKeys, ['id']);
  assert.deepEqual(result.liveSchema.tables[1].foreignKeys, [{ column: 'user_id', referencedTable: 'users', referencedColumn: 'id' }]);
  assert.equal(connection.ended, 1);
  assert.ok(connection.destroyed > 0);
  assert.equal(lookups, 1);
  assert.deepEqual(socketConfig, { host: '8.8.8.8', port: 3306, family: 4 });
  assert.equal(driverConfig.host, config.host);
  assert.equal(driverConfig.ssl.rejectUnauthorized, true);
  assert.equal(driverConfig.ssl.verifyIdentity, true);
  assert.equal(driverConfig.multipleStatements, false);
  assert.throws(() => driverConfig.infileStreamFactory(), /disabled/);
  assert.deepEqual(connection.queries[0].values, ['app']);
  assert.deepEqual(connection.queries[1].values, ['app', 'app']);
});

test('each open creates a fresh connection and rechecks DNS to reject rebinding', async () => {
  const connections = [];
  let address = '8.8.8.8';
  const manager = createConnectionManager({
    env, resolve: async () => [{ address, family: 4 }],
    mysqlCreateConnection: async () => { const connection = fakeConnection(); connections.push(connection); return connection; }
  });
  const encrypted = encryptDatabaseConfig(config, { env });
  const first = await manager.openConnection(encrypted);
  const second = await manager.openConnection(encrypted);
  assert.notEqual(first, second);
  address = '127.0.0.1';
  await assert.rejects(manager.openConnection(encrypted), /not permitted/);
  assert.equal(connections.length, 2);
  await closeConnection(first);
  await closeConnection(second);
});

test('inspection errors close connections and redact driver messages', async () => {
  const connection = fakeConnection(() => { throw new Error('password=secret host=internal'); });
  const manager = createConnectionManager({ env, resolve, mysqlCreateConnection: async () => connection });
  await assert.rejects(manager.createConnection(config), error => {
    assert.equal(error.message, 'Unable to inspect the database schema.');
    return true;
  });
  assert.equal(connection.ended, 1);
  assert.ok(connection.destroyed > 0);
});

test('failed handshakes destroy their socket and hide driver details', async () => {
  let destroyed = 0;
  const manager = createConnectionManager({
    env, resolve,
    connectSocket: () => ({ destroy() { destroyed++; } }),
    mysqlCreateConnection: async options => { options.stream(); throw new Error('secret credentials'); }
  });
  await assert.rejects(manager.createConnection(config), error => {
    assert.ok(!error.message.includes('secret'));
    return true;
  });
  assert.equal(destroyed, 1);
});

test('timeouts bound DNS and prevent a late DNS answer from opening a socket', async () => {
  let calls = 0;
  const manager = createConnectionManager({
    env: { ...env, DATABASE_CONNECT_TIMEOUT_MS: '5' },
    resolve: async () => { await delay(25); return resolve(); },
    mysqlCreateConnection: async () => { calls++; return fakeConnection(); }
  });
  await assert.rejects(manager.createConnection(config), /timed out/);
  await delay(40);
  assert.equal(calls, 0);
});

test('handshake timeout destroys the socket and any connection that arrives late', async () => {
  const connection = fakeConnection();
  let destroyed = 0;
  const manager = createConnectionManager({
    env: { ...env, DATABASE_CONNECT_TIMEOUT_MS: '5' }, resolve,
    connectSocket: () => ({ destroy() { destroyed++; } }),
    mysqlCreateConnection: async options => { options.stream(); await delay(25); return connection; }
  });
  await assert.rejects(manager.createConnection(config), /timed out/);
  await delay(40);
  assert.ok(destroyed > 0);
  assert.ok(connection.destroyed > 0);
});

test('schema inspection has a total deadline and destroys stalled connections', async () => {
  const connection = fakeConnection(() => new Promise(() => {}));
  const manager = createConnectionManager({
    env: { ...env, DATABASE_INSPECT_TIMEOUT_MS: '5' }, resolve, mysqlCreateConnection: async () => connection
  });
  await assert.rejects(manager.createConnection(config), /timed out/);
  assert.equal(connection.ended, 1);
  assert.ok(connection.destroyed > 0);
});

test('schema sizes are bounded instead of silently truncating', async () => {
  const connection = fakeConnection(() => [Array(10001).fill(columns[0])]);
  await assert.rejects(inspectLiveSchema(connection, 'app'), /supported size/);
  assert.equal(connection.queries.length, 1);
  const manyTables = fakeConnection(() => [Array.from({ length: 501 }, (_, index) => ({ ...columns[0], TABLE_NAME: `t${index}` }))]);
  await assert.rejects(inspectLiveSchema(manyTables, 'app'), /supported size/);
  const manyFks = fakeConnection(options => [options.sql.includes('COLUMNS') ? columns : Array(10001).fill(foreignKeys[0])]);
  await assert.rejects(inspectLiveSchema(manyFks, 'app'), /supported size/);
});

test('expired or unconfigured credentials are rejected before DNS or driver work', async () => {
  let calls = 0;
  const failIfCalled = async () => { calls++; throw new Error('must not run'); };
  const manager = createConnectionManager({ env: {}, resolve: failIfCalled, mysqlCreateConnection: failIfCalled });
  await assert.rejects(manager.createConnection(config), /encryption is not configured/);
  await assert.rejects(manager.openConnection('invalid'), /invalid or expired/);
  const encrypted = encryptDatabaseConfig(config, { env: { ...env, DATABASE_CONFIG_TTL_MS: '1' }, now: () => 1000 });
  const expired = createConnectionManager({ env, now: () => 1001, resolve: failIfCalled, mysqlCreateConnection: failIfCalled });
  await assert.rejects(expired.openConnection(encrypted), /invalid or expired/);
  assert.equal(calls, 0);
});

test('credentials expiring during handshake or inspection cannot become configured', async () => {
  for (const phase of ['handshake', 'inspection']) {
    let time = 1000;
    const connection = fakeConnection(phase === 'inspection' ? options => {
      time = 2000;
      return [options.sql.includes('COLUMNS') ? columns : foreignKeys];
    } : undefined);
    const manager = createConnectionManager({
      env: { ...env, DATABASE_CONFIG_TTL_MS: '1000' }, now: () => time, resolve,
      mysqlCreateConnection: async () => {
        if (phase === 'handshake') time = 2000;
        return connection;
      }
    });
    await assert.rejects(manager.createConnection(config), /invalid or expired/);
    assert.ok(connection.destroyed > 0);
  }
});

test('close destroys the physical socket even when graceful shutdown fails', async () => {
  let destroyed = 0;
  const connection = {
    end: async () => { throw new Error('shutdown failed'); },
    destroy: () => { throw new Error('driver failed'); },
    connection: { stream: { destroy() { destroyed++; } } }
  };
  await closeConnection(connection);
  assert.equal(destroyed, 1);
  await closeConnection(null);
});
