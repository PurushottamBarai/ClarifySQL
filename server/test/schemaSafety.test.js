import test from 'node:test';
import assert from 'node:assert/strict';
import { parseDDL } from '../src/schema/ddlParser.js';
import { compareSchemas } from '../src/schema/schemaComparator.js';

const ddl = `
  -- schema comment
  CREATE TABLE users (
    id INT NOT NULL,
    name VARCHAR(120) DEFAULT 'hello, (world); -- not a comment',
    amount DECIMAL(12, 2),
    role ENUM('a,b', 'c)') NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_name (name),
    CHECK (amount >= 0)
  ) ENGINE=InnoDB;
  CREATE TABLE orders (
    id INT PRIMARY KEY,
    user_id INT,
    CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users (id)
  );
`;

test('parses complete definitions with nested type parentheses and quoted delimiters', () => {
  const result = parseDDL(ddl);
  assert.equal(result.tables.length, 2);
  const [users, orders] = result.tables;
  assert.deepEqual(users.columns.map(column => column.name), ['id', 'name', 'amount', 'role']);
  assert.equal(users.columns[2].type, 'decimal(12, 2)');
  assert.equal(users.columns[0].isPrimary, true);
  assert.equal(users.columns[0].nullable, false);
  assert.equal(users.constraints.length, 3);
  assert.match(users.columns[1].definition, /hello, \(world\); -- not a comment/);
  assert.deepEqual(orders.foreignKeys, [{ column: 'user_id', referencedTable: 'users', referencedColumn: 'id', constraint: 'fk_user' }]);
  assert.deepEqual(result.warnings, []);
});

test('supports no final semicolon, quoted identifiers and composite foreign keys', () => {
  const schema = parseDDL('CREATE TABLE `parent` (`a` INT, b INT, PRIMARY KEY (`a`, b)); CREATE TABLE child (a INT, b INT, FOREIGN KEY (a,b) REFERENCES `parent` (`a`,b))');
  assert.equal(schema.tables[1].foreignKeys.length, 2);
  assert.deepEqual(schema.tables[0].primaryKeys, ['a', 'b']);
  assert.equal(schema.tables[0].columns.every(column => column.isPrimary && !column.nullable), true);
  assert.equal(parseDDL("CREATE TABLE comments (s VARCHAR(50) DEFAULT '/* x */ # --') # comment").tables.length, 1);
});

test('never silently accepts malformed or unsupported schema fragments', () => {
  for (const sql of [
    '', 'SELECT 1', 'CREATE TABLE users (id INT); INSERT INTO users VALUES (1);',
    'CREATE TABLE users (id INT); DROP TABLE users;', 'CREATE TABLE users (id INT); garbage',
    'CREATE TABLE users LIKE secrets;', 'CREATE TABLE users AS SELECT * FROM secrets;',
    'CREATE TABLE db.users (id INT);', 'CREATE TEMPORARY TABLE users (id INT);',
    'CREATE TABLE users ();', 'CREATE TABLE users (id INT, id VARCHAR(10));',
    'CREATE TABLE users (id INT); CREATE TABLE users (other INT);',
    'CREATE TABLE users (id INT, FOREIGN KEY (missing) REFERENCES users(id));',
    'CREATE TABLE users (id INT, FOREIGN KEY (id) REFERENCES missing(id));',
    'CREATE TABLE users (id INT, FOREIGN KEY (id) REFERENCES users(missing));',
    'CREATE TABLE users (id INT, PRIMARY KEY (missing));',
    'CREATE TABLE users (id INT, unsupported constraint);',
    "CREATE TABLE users (id INT, name VARCHAR(10) DEFAULT 'unterminated);",
    'CREATE TABLE users (id INT) /* unfinished',
    'CREATE TABLE users (id INT); /*!50000 DROP TABLE users */'
  ]) assert.throws(() => parseDDL(sql), undefined, sql);
});

test('enforces schema byte, table and total column limits', () => {
  const previous = { ...process.env };
  try {
    process.env.SCHEMA_MAX_TABLES = '1';
    assert.throws(() => parseDDL('CREATE TABLE a (id INT); CREATE TABLE b (id INT);'), /tables/);
    process.env.SCHEMA_MAX_COLUMNS = '1';
    assert.throws(() => parseDDL('CREATE TABLE a (id INT, name TEXT);'), /columns/);
    process.env.SCHEMA_MAX_BYTES = '20';
    assert.throws(() => parseDDL('CREATE TABLE a (id INT);'), /bytes/);
  } finally {
    for (const name of ['SCHEMA_MAX_TABLES', 'SCHEMA_MAX_COLUMNS', 'SCHEMA_MAX_BYTES']) {
      if (previous[name] === undefined) delete process.env[name];
      else process.env[name] = previous[name];
    }
  }
});

test('compatibility fails closed on missing, invalid and mismatched live schema', () => {
  const imported = parseDDL('CREATE TABLE users (id INT, amount DECIMAL(12,2));');
  const live = { tables: [{ name: 'users', columns: [{ name: 'id', type: 'int' }, { name: 'amount', type: 'decimal' }] }] };
  assert.equal(compareSchemas(imported, live).compatible, true);
  for (const invalid of [null, {}, { tables: [] }, { tables: [{ name: 'users' }] }, { tables: [{ name: 'users', columns: [] }] }]) {
    assert.equal(compareSchemas(imported, invalid).compatible, false);
  }
  assert.equal(compareSchemas(imported, { tables: [{ name: 'users', columns: [{ name: 'id', type: 'varchar' }] }] }).compatible, false);
  assert.equal(compareSchemas(imported, { tables: [{ name: 'USERS', columns: live.tables[0].columns }] }).compatible, false);
});
