import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { createDatabaseRouter } from '../src/routes/dbRoutes.js';
import { encryptDatabaseConfig, isDatabaseConfigValid } from '../src/security/databaseConfig.js';

const liveSchema = { tables: [{ name: 'users', columns: [{ name: 'id', type: 'int', nullable: false, isPrimary: true }], primaryKeys: ['id'], foreignKeys: [] }] };
const env = { DATABASE_CONFIG_KEY: randomBytes(32).toString('base64'), DATABASE_CONFIG_TTL_MS: '1000' };
const config = { host: 'db.example.com', port: 3306, user: 'reader', password: 'secret', database: 'app' };
const encryptedConfig = encryptDatabaseConfig(config, { env, now: () => 1000 });
const connected = { liveSchema, encryptedConfig, database: 'app', host: config.host, user: config.user };

function router(options = {}) {
  return createDatabaseRouter({ connect: async () => connected, isConfigValid: value => isDatabaseConfigValid(value, { env, now: () => 1000 }), ...options });
}
async function invoke(router, method, path, session, body = config) {
  let response;
  let status = 200;
  const res = { status(code) { status = code; return this; }, json(value) { response = value; return this; } };
  const route = router.stack.find(layer => layer.route?.path === path && layer.route.methods[method]).route;
  await route.stack[0].handle({ session, body }, res);
  return { status, body: response };
}
function assertCleared(session) {
  for (const key of ['databaseConnection', 'importedSchema', 'liveSchema']) assert.equal(session[key], undefined);
  assert.equal(session.dbConnected, false);
  assert.equal(session.database, null);
  assert.equal(session.pendingQuery, null);
  assert.deepEqual(session.clarificationHistory, []);
}

test('connect stores encrypted config, clears query context, and does not expose credentials', async () => {
  const session = { pendingQuery: 'old SQL', clarificationHistory: ['old'] };
  const response = await invoke(router(), 'post', '/connect', session);
  assert.equal(response.status, 200);
  assert.equal(response.body.connected, true);
  assert.equal(response.body.configured, true);
  assert.equal(session.databaseConnection, encryptedConfig);
  assert.equal(session.dbConnected, true);
  assert.deepEqual(session.liveSchema, liveSchema);
  assert.equal(session.pendingQuery, null);
  assert.deepEqual(session.clarificationHistory, []);
  assert.ok(!JSON.stringify(response).includes('secret'));
  assert.ok(!JSON.stringify(response).includes(encryptedConfig));
});

test('compatible imported schema is compared and retained', async () => {
  const importedSchema = structuredClone(liveSchema);
  importedSchema.tables[0].columns[0].type = 'INTEGER(11) unsigned';
  const session = { importedSchema };
  const response = await invoke(router(), 'post', '/connect', session);
  assert.equal(response.body.compatibility.compatible, true);
  assert.equal(session.importedSchema, importedSchema);
  assert.equal(session.liveSchema, liveSchema);
});

test('missing columns and incompatible column types reject without marking connected', async () => {
  for (const patch of [{ name: 'missing_column' }, { type: 'varchar(255)' }]) {
    const importedSchema = structuredClone(liveSchema);
    Object.assign(importedSchema.tables[0].columns[0], patch);
    const session = { importedSchema, pendingQuery: 'stale', clarificationHistory: ['stale'] };
    const response = await invoke(router(), 'post', '/connect', session);
    assert.equal(response.status, 400);
    assert.equal(response.body.connected, false);
    assert.equal(response.body.compatibility.compatible, false);
    assertCleared(session);
  }
});

test('reconnect drops a serialized previous live schema instead of comparing stale tables', async () => {
  const oldSchema = { tables: [{ name: 'obsolete', columns: [{ name: 'id', type: 'int' }] }] };
  const session = {
    databaseConnection: 'old', database: 'old', dbConnected: true,
    liveSchema: oldSchema, importedSchema: structuredClone(oldSchema),
    pendingQuery: 'stale', clarificationHistory: ['stale']
  };
  const response = await invoke(router(), 'post', '/connect', session);
  assert.equal(response.status, 200);
  assert.deepEqual(session.importedSchema, liveSchema);
  assert.equal(session.databaseConnection, encryptedConfig);
});

test('failed reconnect clears all stale state and redacts error details', async () => {
  const session = {
    databaseConnection: 'old', database: 'old', dbConnected: true,
    liveSchema, importedSchema: liveSchema, pendingQuery: 'stale', clarificationHistory: ['stale']
  };
  const response = await invoke(router({ connect: async () => { throw new Error('secret password, internal host'); } }), 'post', '/connect', session);
  assert.equal(response.status, 400);
  assert.equal(response.body.connected, false);
  assert.ok(!JSON.stringify(response).includes('secret'));
  assert.ok(!JSON.stringify(response).includes('internal host'));
  assertCleared(session);
});

test('disconnect is idempotent and clears configuration, schemas, and query state', async () => {
  const session = { databaseConnection: encryptedConfig, dbConnected: true, database: 'app', liveSchema, importedSchema: liveSchema };
  const instance = router();
  const response = await invoke(instance, 'post', '/disconnect', session);
  assert.equal(response.body.connected, false);
  assert.equal(response.body.configured, false);
  assertCleared(session);
  await invoke(instance, 'post', '/disconnect', session);
  assertCleared(session);
});

test('status reports configuration, not liveness, without opening a connection', async () => {
  const session = { databaseConnection: encryptedConfig, database: 'app', importedSchema: liveSchema, dbConnected: false };
  const instance = router({ connect: async () => { throw new Error('must not dial'); } });
  const response = await invoke(instance, 'get', '/status', session);
  assert.equal(response.body.connected, true);
  assert.equal(response.body.configured, true);
  assert.equal(response.body.database, 'app');
  const expired = router({ isConfigValid: value => isDatabaseConfigValid(value, { env, now: () => 2000 }) });
  const stale = await invoke(expired, 'get', '/status', session);
  assert.equal(stale.body.connected, false);
  assert.equal(stale.body.database, null);
  assert.equal(stale.body.schema, null);
  assertCleared(session);
});

test('status preserves an independently imported offline schema but rejects legacy connected flags', async () => {
  const session = { importedSchema: liveSchema };
  const response = await invoke(router(), 'get', '/status', session);
  assert.equal(response.body.connected, false);
  assert.equal(response.body.schema, liveSchema);
  session.dbConnected = true;
  await invoke(router(), 'get', '/status', session);
  assertCleared(session);
});
