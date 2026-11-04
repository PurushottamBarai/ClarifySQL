import sqlParser from 'node-sql-parser';
import { positiveBound } from '../validators/sqlValidator.js';

const parser = new sqlParser.Parser();

function tokenize(sql) {
  const tokens = [];
  for (let i = 0; i < sql.length;) {
    const start = i;
    const char = sql[i];
    if (/\s/.test(char)) { i++; continue; }
    if (char === '#' || (sql.startsWith('--', i) && /\s/.test(sql[i + 2] ?? '\n'))) {
      while (i < sql.length && sql[i] !== '\n') i++;
      continue;
    }
    if (sql.startsWith('/*', i)) {
      if (/^[!+]/.test(sql[i + 2] ?? '')) throw new Error('Executable comments and hints are not permitted.');
      const end = sql.indexOf('*/', i + 2);
      if (end < 0) throw new Error('Unterminated SQL comment.');
      i = end + 2;
      continue;
    }
    if (char === '`' || char === "'" || char === '"') {
      let value = '';
      let closed = false;
      i++;
      while (i < sql.length) {
        if (sql[i] === char) {
          if (sql[i + 1] === char) { value += char; i += 2; continue; }
          i++;
          closed = true;
          break;
        }
        if (sql[i] === '\\' && char !== '`') {
          if (i + 1 >= sql.length) throw new Error('Unterminated SQL string.');
          value += sql[i + 1];
          i += 2;
        } else value += sql[i++];
      }
      if (!closed) throw new Error('Unterminated SQL identifier or string.');
      tokens.push({ value, kind: char === '`' ? 'identifier' : 'string', start, end: i });
    } else if (/[A-Za-z0-9_$]/.test(char)) {
      while (i < sql.length && /[A-Za-z0-9_$]/.test(sql[i])) i++;
      tokens.push({ value: sql.slice(start, i), kind: 'word', start, end: i });
    } else {
      tokens.push({ value: char, kind: 'symbol', start, end: ++i });
    }
  }
  return tokens;
}

function split(tokens, separator) {
  const groups = [];
  let group = [];
  let depth = 0;
  for (const token of tokens) {
    if (token.kind === 'symbol' && token.value === '(') depth++;
    if (token.kind === 'symbol' && token.value === ')') depth--;
    if (depth < 0) throw new Error('Unbalanced schema parentheses.');
    if (token.kind === 'symbol' && token.value === separator && depth === 0) {
      if (!group.length) throw new Error('Empty schema definition.');
      groups.push(group);
      group = [];
    } else group.push(token);
  }
  if (depth) throw new Error('Unbalanced schema parentheses.');
  if (group.length) groups.push(group);
  return groups;
}

const keyword = (token, word) => token?.kind === 'word' && token.value.toUpperCase() === word;
function identifier(token) {
  if (!token || !['word', 'identifier'].includes(token.kind) || !token.value || Buffer.byteLength(token.value) > 256) {
    throw new Error('Invalid or unsupported schema identifier.');
  }
  return token.value;
}

function columnList(tokens, start) {
  if (tokens[start]?.value !== '(') throw new Error('Expected a column list.');
  let end = start + 1;
  while (end < tokens.length && tokens[end].value !== ')') end++;
  if (end === tokens.length) throw new Error('Unterminated column list.');
  const columns = split(tokens.slice(start + 1, end), ',').map(group => {
    if (group.length !== 1) throw new Error('Expression or prefix indexes are not supported in key relationships.');
    return identifier(group[0]);
  });
  if (!columns.length) throw new Error('Empty key column list.');
  return { columns, end: end + 1 };
}

function parseTable(tokens, sql) {
  let cursor = 0;
  if (!keyword(tokens[cursor++], 'CREATE') || !keyword(tokens[cursor++], 'TABLE')) {
    throw new Error('Only CREATE TABLE statements are permitted in schema imports.');
  }
  if (keyword(tokens[cursor], 'IF')) {
    if (!keyword(tokens[++cursor], 'NOT') || !keyword(tokens[++cursor], 'EXISTS')) throw new Error('Invalid CREATE TABLE statement.');
    cursor++;
  }
  const name = identifier(tokens[cursor++]);
  if (tokens[cursor]?.value !== '(') throw new Error('Qualified tables and CREATE TABLE LIKE/AS are not supported.');
  const start = ++cursor;
  let depth = 1;
  while (cursor < tokens.length && depth) {
    if (tokens[cursor].kind === 'symbol' && tokens[cursor].value === '(') depth++;
    if (tokens[cursor].kind === 'symbol' && tokens[cursor].value === ')') depth--;
    cursor++;
  }
  if (depth) throw new Error('Unterminated CREATE TABLE definition.');
  const definitions = split(tokens.slice(start, cursor - 1), ',');
  const table = { name, columns: [], primaryKeys: [], foreignKeys: [], constraints: [] };
  for (const definition of definitions) {
    const rawDefinition = sql.slice(definition[0].start, definition[definition.length - 1].end);
    let position = 0;
    let constraint = null;
    if (keyword(definition[position], 'CONSTRAINT')) {
      position++;
      if (!['PRIMARY', 'FOREIGN', 'UNIQUE', 'CHECK'].some(word => keyword(definition[position], word))) {
        constraint = identifier(definition[position++]);
      }
    }
    const first = definition[position];
    const isConstraint = ['PRIMARY', 'FOREIGN', 'UNIQUE', 'KEY', 'INDEX', 'CHECK', 'FULLTEXT', 'SPATIAL'].some(word => keyword(first, word));
    if (isConstraint) {
      table.constraints.push({ name: constraint, definition: rawDefinition });
      if (keyword(first, 'PRIMARY')) {
        if (table.primaryKeys.length) throw new Error(`Multiple primary keys on '${name}'.`);
        table.primaryKeys = columnList(definition, position + 2).columns;
      } else if (keyword(first, 'FOREIGN')) {
        position += 2;
        if (definition[position]?.value !== '(') position++;
        const source = columnList(definition, position);
        position = source.end;
        if (!keyword(definition[position++], 'REFERENCES')) throw new Error('Invalid foreign key definition.');
        const referencedTable = identifier(definition[position++]);
        const target = columnList(definition, position);
        if (source.columns.length !== target.columns.length) throw new Error('Foreign key column counts differ.');
        source.columns.forEach((column, index) => table.foreignKeys.push({
          column, referencedTable, referencedColumn: target.columns[index], constraint
        }));
      }
      continue;
    }
    if (constraint || position) throw new Error('Unsupported table constraint.');
    const columnName = identifier(definition[0]);
    if (table.columns.some(column => column.name.toLowerCase() === columnName.toLowerCase())) throw new Error(`Duplicate column '${columnName}'.`);
    if (definition[1]?.kind !== 'word') throw new Error(`Missing type for column '${columnName}'.`);
    let typeEnd = 2;
    if (definition[typeEnd]?.value === '(') {
      let typeDepth = 1;
      typeEnd++;
      while (typeEnd < definition.length && typeDepth) {
        if (definition[typeEnd].kind === 'symbol' && definition[typeEnd].value === '(') typeDepth++;
        if (definition[typeEnd].kind === 'symbol' && definition[typeEnd].value === ')') typeDepth--;
        typeEnd++;
      }
      if (typeDepth) throw new Error('Unterminated column type.');
    }
    while (['UNSIGNED', 'ZEROFILL', 'PRECISION', 'VARYING'].some(word => keyword(definition[typeEnd], word))) typeEnd++;
    const type = sql.slice(definition[1].start, definition[typeEnd - 1].end).toLowerCase();
    const inlinePrimary = definition.some((token, index) => keyword(token, 'PRIMARY') && keyword(definition[index + 1], 'KEY'));
    const notNull = definition.some((token, index) => keyword(token, 'NOT') && keyword(definition[index + 1], 'NULL'));
    if (definition.some(token => keyword(token, 'REFERENCES'))) throw new Error('Use explicit table-level foreign key constraints.');
    if (inlinePrimary) table.primaryKeys.push(columnName);
    table.columns.push({ name: columnName, type, nullable: !notNull && !inlinePrimary, isPrimary: inlinePrimary, definition: rawDefinition });
  }
  if (!table.columns.length) throw new Error(`Table '${name}' has no columns.`);
  for (const primary of table.primaryKeys) {
    const column = table.columns.find(item => item.name.toLowerCase() === primary.toLowerCase());
    if (!column) throw new Error(`Unknown primary key column '${primary}'.`);
    column.isPrimary = true;
    column.nullable = false;
  }
  return table;
}

function parseDDL(sqlContent) {
  const maxBytes = positiveBound(process.env.SCHEMA_MAX_BYTES, 2 * 1024 * 1024, 16 * 1024 * 1024);
  const maxTables = positiveBound(process.env.SCHEMA_MAX_TABLES, 100, 1000);
  const maxColumns = positiveBound(process.env.SCHEMA_MAX_COLUMNS, 2000, 20000);
  if (typeof sqlContent !== 'string' || !sqlContent.trim() || Buffer.byteLength(sqlContent, 'utf8') > maxBytes) {
    throw new Error(`Schema SQL must contain at most ${maxBytes} bytes.`);
  }
  const statements = split(tokenize(sqlContent), ';');
  if (!statements.length || statements.length > maxTables) throw new Error(`Schema must contain between 1 and ${maxTables} tables.`);
  const tables = [];
  let columnCount = 0;
  for (const tokens of statements) {
    const statement = sqlContent.slice(tokens[0].start, tokens[tokens.length - 1].end);
    let ast;
    try { ast = parser.astify(statement, { database: 'MySQL' }); } catch { throw new Error('Invalid or unsupported CREATE TABLE syntax.'); }
    if (Array.isArray(ast) || ast?.type !== 'create' || ast.keyword !== 'table' || ast.query_expr) {
      throw new Error('Only explicit CREATE TABLE definitions are permitted.');
    }
    const table = parseTable(tokens, sqlContent);
    if (tables.some(existing => existing.name.toLowerCase() === table.name.toLowerCase())) throw new Error(`Duplicate table '${table.name}'.`);
    columnCount += table.columns.length;
    if (columnCount > maxColumns) throw new Error(`Schema exceeds the limit of ${maxColumns} columns.`);
    tables.push(table);
  }
  for (const table of tables) {
    for (const foreign of table.foreignKeys) {
      const target = tables.find(item => item.name === foreign.referencedTable);
      if (!table.columns.some(column => column.name.toLowerCase() === foreign.column.toLowerCase()) ||
          !target?.columns.some(column => column.name.toLowerCase() === foreign.referencedColumn.toLowerCase())) {
        throw new Error(`Invalid foreign key reference on table '${table.name}'.`);
      }
    }
  }
  return { tables, warnings: [] };
}

export { parseDDL };
