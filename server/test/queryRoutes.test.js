import test from 'node:test';
import assert from 'node:assert/strict';
import { createQueryRouter } from '../src/routes/queryRoutes.js';
import schemaRouter from '../src/routes/schemaRoutes.js';

const schema = { tables: [{ name: 'users', columns: [{ name: 'id', type: 'int' }] }] };
const sessionForQuery = () => ({ importedSchema: structuredClone(schema), liveSchema: structuredClone(schema), databaseConnection: 'encrypted-config' });

function request(router, session, path, body = {}) {
  return new Promise((resolve, reject) => {
    const req = { method: 'POST', url: path, session, body, headers: {} };
    const res = { statusCode: 200, status(code) { this.statusCode = code; return this; },
      json(value) { resolve({ status: this.statusCode, body: value }); return this; } };
    router.handle(req, res, error => reject(error ?? new Error('Route not found')));
  });
}

test('passes encrypted connection and approved schema to execution', async () => {
  const session = sessionForQuery();
  let args;
  const router = createQueryRouter({ execute: async (...values) => { args = values; return { rows: [], columns: [], rowCount: 0 }; } });
  const result = await request(router, session, '/execute', { sql: 'SELECT * FROM users' });
  assert.equal(result.status, 200);
  assert.deepEqual(args, ['encrypted-config', 'SELECT * FROM users', { schema: session.importedSchema }]);
});

test('requires live compatibility, schema, connection and read-only SQL', async () => {
  let calls = 0;
  const router = createQueryRouter({ execute: async () => { calls++; return {}; } });
  for (const mutation of [
    session => { delete session.databaseConnection; },
    session => { delete session.liveSchema; },
    session => { delete session.importedSchema; },
    session => { session.liveSchema.tables[0].columns[0].type = 'text'; }
  ]) {
    const session = sessionForQuery();
    mutation(session);
    assert.equal((await request(router, session, '/execute', { sql: 'SELECT * FROM users' })).status, 400);
  }
  assert.equal((await request(router, sessionForQuery(), '/execute', { sql: 'DELETE FROM users' })).status, 400);
  assert.equal((await request(router, sessionForQuery(), '/execute', { sql: 'SELECT * FROM users, secrets' })).status, 400);
  assert.equal(calls, 0);
});

test('pending SQL is invalidated by schema or connection replacement', async () => {
  for (const replace of [
    session => { session.databaseConnection = 'different-encrypted-config'; },
    session => { session.importedSchema.tables[0].columns.push({ name: 'name', type: 'text' }); }
  ]) {
    const session = sessionForQuery();
    let executions = 0;
    const router = createQueryRouter({ analyze: async () => ({ status: 'clear', sqlDraft: 'SELECT * FROM users' }),
      execute: async () => { executions++; return {}; } });
    assert.equal((await request(router, session, '/', { question: 'List users' })).status, 200);
    assert.equal(session.pendingQuery, 'SELECT * FROM users');
    replace(session);
    assert.equal((await request(router, session, '/execute')).status, 400);
    assert.equal(session.pendingQuery, null);
    assert.deepEqual(session.clarificationHistory, []);
    assert.equal(executions, 0);
  }
});

test('schema import clears pending SQL and clarification history and reports compatibility', async () => {
  const session = { ...sessionForQuery(), pendingQuery: 'SELECT * FROM users', pendingQueryContext: 'old',
    clarificationHistory: [{ question: 'old' }] };
  const result = await request(schemaRouter, session, '/import', { sqlContent: 'CREATE TABLE users (id INT)' });
  assert.equal(result.status, 200);
  assert.equal(result.body.compatibility.compatible, true);
  assert.equal(session.pendingQuery, null);
  assert.equal(session.pendingQueryContext, null);
  assert.deepEqual(session.clarificationHistory, []);
  const imported = session.importedSchema;
  assert.equal((await request(schemaRouter, session, '/import', { sqlContent: 'invalid' })).status, 400);
  assert.equal(session.importedSchema, imported);
});

test('allows destructive drafts but blocks their execution', async () => {
  const session = sessionForQuery();
  const router = createQueryRouter({ analyze: async () => ({ status: 'clear', sqlDraft: 'DELETE FROM users' }) });
  const result = await request(router, session, '/', { question: 'Delete users' });
  assert.equal(result.body.isDestructive, true);
  assert.equal(result.body.sqlDraft, 'DELETE FROM users');
  assert.equal((await request(router, session, '/execute')).status, 400);
});

test('bounds question, answer and clarification turns without calling generation', async () => {
  const previousLength = process.env.QUERY_MAX_LENGTH;
  const previousTurns = process.env.CLARIFICATION_MAX_TURNS;
  process.env.QUERY_MAX_LENGTH = '100';
  process.env.CLARIFICATION_MAX_TURNS = '1';
  let calls = 0;
  const router = createQueryRouter({ analyze: async () => { calls++; return { status: 'needs_clarification', clarificationPrompt: 'Which users?', options: ['All', 'Active'] }; } });
  try {
    const session = sessionForQuery();
    assert.equal((await request(router, session, '/', { question: 'x'.repeat(101) })).status, 400);
    assert.equal((await request(router, session, '/', { question: 'Users', clarificationAnswer: {} })).status, 400);
    assert.equal(calls, 0);
    assert.equal((await request(router, session, '/', { question: 'Users' })).status, 200);
    assert.equal((await request(router, session, '/', { question: 'Users', clarificationAnswer: 'All' })).status, 400);
    assert.equal(calls, 1);
    assert.deepEqual(session.clarificationHistory, []);
  } finally {
    if (previousLength === undefined) delete process.env.QUERY_MAX_LENGTH;
    else process.env.QUERY_MAX_LENGTH = previousLength;
    if (previousTurns === undefined) delete process.env.CLARIFICATION_MAX_TURNS;
    else process.env.CLARIFICATION_MAX_TURNS = previousTurns;
  }
});

test('starting a new question clears stale clarification and approved SQL', async () => {
  const session = sessionForQuery();
  const histories = [];
  const router = createQueryRouter({ analyze: async input => {
    histories.push(structuredClone(input.clarificationHistory));
    return { status: 'needs_clarification', clarificationPrompt: 'Which?', options: ['All'] };
  } });
  await request(router, session, '/', { question: 'First' });
  await request(router, session, '/', { question: 'Second' });
  assert.deepEqual(histories, [[], []]);
  assert.equal(session.clarificationHistory.length, 1);
  assert.equal(session.clarificationHistory[0].question, 'Second');
});
