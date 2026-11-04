import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { Readable } from 'node:stream';
import { executeReadOnlyQuery } from '../src/db/queryExecutor.js';
import { parseSingleStatement } from '../src/validators/sqlValidator.js';

const schema = { tables: [{ name: 'users', columns: [{ name: 'id', type: 'int' }] }] };

function fakeConnection({ rows = [{ id: 1 }], error, hang = false } = {}) {
  const state = { destroyed: 0, sql: null, stream: null };
  const connection = {
    connection: {
      query(sql) {
        state.sql = sql;
        const query = new EventEmitter();
        query.stream = () => {
          const stream = hang ? new Readable({ objectMode: true, read() {} }) : Readable.from(rows);
          state.stream = stream;
          queueMicrotask(() => {
            query.emit('fields', [{ name: 'id' }]);
            if (error) stream.destroy(error);
          });
          return stream;
        };
        return query;
      }
    },
    destroy() {
      state.destroyed++;
      state.stream?.destroy();
    }
  };
  return { connection, state };
}

test('uses encrypted config, bounds outer SQL and destroys request-scoped connection', async () => {
  const { connection, state } = fakeConnection();
  let supplied;
  const result = await executeReadOnlyQuery('encrypted-config', 'SELECT * FROM users LIMIT 999999', {
    schema, rowLimit: 5, openConnection: async config => { supplied = config; return connection; }
  });
  assert.equal(supplied, 'encrypted-config');
  assert.deepEqual(result.rows, [{ id: 1 }]);
  assert.deepEqual(result.columns, ['id']);
  assert.equal(result.rowCount, 1);
  assert.equal(parseSingleStatement(state.sql).limit.value[0].value, 5);
  assert.equal(state.destroyed, 1);
});

test('rejects unsafe queries and absent schema before opening a connection', async () => {
  let opened = 0;
  const openConnection = async () => { opened++; throw new Error('Unexpected connection'); };
  await assert.rejects(executeReadOnlyQuery('encrypted-config', 'DELETE FROM users', { schema, openConnection }), /SELECT/);
  await assert.rejects(executeReadOnlyQuery('encrypted-config', 'SELECT * FROM secrets', { schema, openConnection }), /unknown table/);
  await assert.rejects(executeReadOnlyQuery('encrypted-config', 'SELECT * FROM users', { openConnection }), /schema/);
  assert.equal(opened, 0);
});

test('enforces result byte and defensive row limits and cleans up', async () => {
  for (const [rows, options] of [[[{ id: 'x'.repeat(200) }], { maxBytes: 100 }], [[{ id: 1 }, { id: 2 }], { rowLimit: 1 }]]) {
    const { connection, state } = fakeConnection({ rows });
    await assert.rejects(executeReadOnlyQuery('encrypted-config', 'SELECT * FROM users', {
      schema, ...options, openConnection: async () => connection
    }), /limit/);
    assert.equal(state.destroyed, 1);
    assert.equal(state.stream.destroyed, true);
  }
});

test('destroys executing connection on timeout', async () => {
  const { connection, state } = fakeConnection({ hang: true });
  await assert.rejects(executeReadOnlyQuery('encrypted-config', 'SELECT * FROM users', {
    schema, timeoutMs: 20, openConnection: async () => connection
  }), /timed out/);
  assert.equal(state.destroyed, 1);
  assert.equal(state.stream.destroyed, true);
});

test('destroys a connection acquired after timeout without executing SQL', async () => {
  const { connection, state } = fakeConnection();
  let resolveOpen;
  await assert.rejects(executeReadOnlyQuery('encrypted-config', 'SELECT * FROM users', {
    schema, timeoutMs: 10, openConnection: () => new Promise(resolve => { resolveOpen = resolve; })
  }), /timed out/);
  resolveOpen(connection);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(state.destroyed, 1);
  assert.equal(state.sql, null);
});

test('propagates query failure and cleans up', async () => {
  const { connection, state } = fakeConnection({ error: new Error('Database query failed') });
  await assert.rejects(executeReadOnlyQuery('encrypted-config', 'SELECT * FROM users', {
    schema, openConnection: async () => connection
  }), /Database query failed/);
  assert.equal(state.destroyed, 1);
});
