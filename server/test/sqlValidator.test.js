import test from 'node:test';
import assert from 'node:assert/strict';
import { validateQuerySafety, validateExecutionSafety, isDestructiveQuery, boundReadOnlyQuery, parseSingleStatement } from '../src/validators/sqlValidator.js';

const schema = { tables: [{ name: 'users', columns: [{ name: 'id', type: 'int' }] }, { name: 'orders', columns: [{ name: 'id', type: 'int' }] }] };

test('accepts supported read-only expressions and normal comments', () => {
  for (const sql of [
    'SELECT * FROM users',
    'SELECT u.id, COUNT(*) AS total FROM users u JOIN orders o ON u.id = o.id GROUP BY u.id',
    "SELECT 'DROP TABLE x; -- text' AS message FROM users;",
    '/* normal comment */ SELECT id FROM users WHERE id IN (SELECT id FROM orders)',
    'SELECT id FROM users WHERE id > 0 ORDER BY id DESC LIMIT 5 OFFSET 2',
    "SELECT COALESCE(id, 0), UPPER('hello') FROM users",
    'SELECT u.id FROM (SELECT id FROM users) u'
  ]) assert.equal(validateExecutionSafety(sql, schema).valid, true, sql);
});

test('rejects non-read-only, output, lock, variable, function and parser bypasses', () => {
  for (const sql of [
    'DELETE FROM users', 'UPDATE users SET id = 1', 'SELECT * FROM users; SELECT 2', 'SELECT * FROM users;;',
    "SELECT * INTO OUTFILE '/tmp/data' FROM users", "SELECT * FROM users INTO OUTFILE '/tmp/data'",
    "SELECT * FROM users INTO DUMPFILE '/tmp/data'", 'SELECT id INTO @x FROM users',
    'SELECT * FROM users FOR UPDATE', 'SELECT * FROM users LOCK IN SHARE MODE',
    'SELECT @@version', 'SELECT @x', 'SELECT @x := 1', 'SELECT SLEEP(1)', 'SELECT BENCHMARK(10, 1)',
    "SELECT LOAD_FILE('/etc/passwd')", "SELECT GET_LOCK('lock', 10)", 'SELECT RELEASE_ALL_LOCKS()',
    'SELECT custom_function(id) FROM users', 'SELECT other.SUM(id) FROM users',
    'SELECT * FROM users /*!50000 FOR UPDATE */', 'SELECT /*+ MAX_EXECUTION_TIME(9999999) */ * FROM users',
    'SELECT SQL_CALC_FOUND_ROWS * FROM users', 'SELECT * FROM users UNION SELECT * FROM orders',
    'WITH x AS (SELECT * FROM users) SELECT * FROM x',
    'SELECT (SELECT SLEEP(1)) FROM users', 'SELECT * FROM users WHERE id IN (SELECT GET_LOCK(\'x\', 1))',
    'SHOW TABLES', 'CALL anything()', 'SELECT * FROM users WHERE'
  ]) assert.equal(validateExecutionSafety(sql, schema).valid, false, sql);
});

test('validates every table reference, including comma joins and nested queries', () => {
  for (const sql of [
    'SELECT * FROM users, secrets', 'SELECT * FROM users u JOIN secrets s ON u.id = s.id',
    'SELECT * FROM (SELECT * FROM secrets) s', 'SELECT * FROM users WHERE id IN (SELECT id FROM secrets)',
    'SELECT * FROM db.users', 'SELECT db.users.id FROM users', 'SELECT * FROM information_schema.tables',
    'SELECT * FROM USERS', 'SELECT * FROM `db`.`users`'
  ]) assert.equal(validateQuerySafety(sql, schema).valid, false, sql);
  assert.equal(validateQuerySafety('SELECT 1', null).valid, false);
  assert.equal(validateQuerySafety('SELECT * FROM users', { tables: [] }).valid, false);
});

test('permits modifying drafts but never executes them', () => {
  for (const sql of ['DELETE FROM users', 'UPDATE users SET id = 2', 'DROP TABLE users', 'ALTER TABLE users ADD COLUMN label VARCHAR(10)']) {
    assert.equal(validateQuerySafety(sql, schema).valid, true, sql);
    assert.equal(isDestructiveQuery(sql), true, sql);
    assert.equal(validateExecutionSafety(sql, schema).valid, false, sql);
  }
  assert.equal(isDestructiveQuery("SELECT 'DELETE FROM users'"), false);
});

test('caps the outer limit independently of nested limits and existing larger limits', () => {
  for (const [sql, expected, offset] of [
    ['SELECT * FROM users', 10],
    ['SELECT * FROM users LIMIT 999999', 10],
    ['SELECT * FROM users LIMIT 3', 3],
    ['SELECT * FROM users LIMIT 0', 0],
    ['SELECT * FROM users LIMIT 20, 999999', 10, 20],
    ['SELECT * FROM users LIMIT 999999 OFFSET 20', 10, 20],
    ['SELECT * FROM users LIMIT 3 OFFSET 20', 3, 20],
    ['SELECT * FROM (SELECT * FROM users LIMIT 1) u', 10]
  ]) {
    const ast = parseSingleStatement(boundReadOnlyQuery(sql, schema, 10));
    const values = ast.limit.value.map(item => Number(item.value));
    assert.equal(values[values.length - 1], expected, sql);
    if (offset !== undefined) assert.equal(values[0], offset, sql);
  }
});

test('query length bounds use UTF-8 bytes and reject invalid input', () => {
  const previous = process.env.QUERY_MAX_LENGTH;
  process.env.QUERY_MAX_LENGTH = '20';
  try {
    assert.equal(validateExecutionSafety("SELECT 'éééééééé'", schema).valid, false);
    for (const value of [null, {}, [], '', ' ']) assert.equal(validateExecutionSafety(value, schema).valid, false);
  } finally {
    if (previous === undefined) delete process.env.QUERY_MAX_LENGTH;
    else process.env.QUERY_MAX_LENGTH = previous;
  }
});
