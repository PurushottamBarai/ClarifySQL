import sqlParser from 'node-sql-parser';

const parser = new sqlParser.Parser();
const dialect = { database: 'MySQL' };
const modifyingTypes = new Set(['insert', 'update', 'delete', 'drop', 'alter', 'truncate', 'replace', 'create']);
const safeFunctions = new Set(`ABS ACOS ASIN ATAN ATAN2 CEIL CEILING FLOOR ROUND TRUNCATE MOD POW POWER SQRT SIGN EXP LN LOG LOG2 LOG10
  COUNT SUM AVG MIN MAX GROUP_CONCAT STD STDDEV STDDEV_POP STDDEV_SAMP VAR_POP VAR_SAMP VARIANCE
  COALESCE IFNULL NULLIF IF GREATEST LEAST ISNULL
  CONCAT CONCAT_WS LOWER LCASE UPPER UCASE LENGTH CHAR_LENGTH CHARACTER_LENGTH TRIM LTRIM RTRIM SUBSTR SUBSTRING
  SUBSTRING_INDEX LEFT RIGHT REPLACE REVERSE LOCATE INSTR LPAD RPAD SPACE STRCMP FORMAT ASCII ORD HEX UNHEX
  DATE TIME YEAR MONTH DAY DAYOFMONTH DAYOFWEEK DAYOFYEAR WEEK WEEKDAY WEEKOFYEAR QUARTER HOUR MINUTE SECOND
  DATE_FORMAT STR_TO_DATE DATEDIFF TIMEDIFF TIMESTAMPDIFF DATE_ADD DATE_SUB ADDDATE SUBDATE EXTRACT LAST_DAY
  CURDATE CURRENT_DATE CURTIME CURRENT_TIME NOW CURRENT_TIMESTAMP TIMESTAMP UNIX_TIMESTAMP FROM_UNIXTIME
  CAST CONVERT JSON_EXTRACT JSON_UNQUOTE JSON_LENGTH JSON_CONTAINS JSON_TYPE JSON_VALID
  ROW_NUMBER RANK DENSE_RANK LAG LEAD FIRST_VALUE LAST_VALUE NTILE CUME_DIST PERCENT_RANK`.split(/\s+/));
const expressionTypes = new Set([
  'select', 'column_ref', 'number', 'string', 'single_quote_string', 'double_quote_string', 'bool', 'null',
  'binary_expr', 'unary_expr', 'expr_list', 'function', 'aggr_func', 'cast', 'case', 'when', 'else',
  'interval', 'extract', 'date', 'timestamp', 'time', 'window', 'default', 'ASC', 'DESC', 'star'
]);

function positiveBound(value, fallback, maximum = Number.MAX_SAFE_INTEGER) {
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? Math.min(number, maximum) : fallback;
}

function parseSingleStatement(sql) {
  const maxLength = positiveBound(process.env.QUERY_MAX_LENGTH, 20000, 1000000);
  if (typeof sql !== 'string' || !sql.trim() || Buffer.byteLength(sql, 'utf8') > maxLength) {
    throw new Error(`Query must be a non-empty string of at most ${maxLength} bytes.`);
  }
  if (/\/\*\s*[!+]/.test(sql)) throw new Error('Executable comments and optimizer hints are not supported.');
  if (/;\s*;\s*$/.test(sql)) throw new Error('Exactly one SQL statement is required.');
  let ast;
  try {
    ast = parser.astify(sql, dialect);
  } catch {
    throw new Error('Unsupported or invalid MySQL syntax.');
  }
  if (Array.isArray(ast)) {
    if (ast.length !== 1) throw new Error('Exactly one SQL statement is required.');
    [ast] = ast;
  }
  if (!ast || typeof ast !== 'object') throw new Error('Exactly one SQL statement is required.');
  return ast;
}

function walk(node, visit) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    node.forEach(item => walk(item, visit));
    return;
  }
  visit(node);
  for (const value of Object.values(node)) walk(value, visit);
}

function checkTables(ast, schema) {
  if (!schema || !Array.isArray(schema.tables) || schema.tables.length === 0) {
    throw new Error('An approved schema is required.');
  }
  const allowed = new Set(schema.tables.map(table => table.name));
  walk(ast, node => {
    if (node.db != null || node.schema != null || node.catalog != null) {
      throw new Error('Database-qualified references are not permitted.');
    }
    if (typeof node.table === 'string' && node.type !== 'column_ref' && !allowed.has(node.table)) {
      throw new Error(`Query references unknown table '${node.table}' not present in imported schema.`);
    }
  });
}

function checkReadOnly(ast) {
  if (ast.type !== 'select') throw new Error('Only read-only SELECT statements may be executed.');
  walk(ast, node => {
    if (node.type && !expressionTypes.has(node.type)) {
      throw new Error(`Unsupported SQL expression '${node.type}'.`);
    }
    if (node.type === 'select') {
      if (node.with || node._next || node.set_op || node.locking_read || node.for_update || node.lock || node.procedure ||
          (node.into && (node.into.position || node.into.type || node.into.expr))) {
        throw new Error('CTEs, unions, output, procedures and locking SELECT statements are not supported.');
      }
      if (node.options?.length) throw new Error('SELECT options are not supported.');
    }
    if (node.db != null || node.schema != null || node.catalog != null) {
      throw new Error('Database-qualified references are not permitted.');
    }
    if (node.type === 'function' || node.type === 'aggr_func') {
      const parts = node.name?.name;
      const name = typeof node.name === 'string' ? node.name :
        Array.isArray(parts) && parts.length === 1 ? parts[0].value : null;
      if (!name || !safeFunctions.has(name.toUpperCase()) || node.name?.schema) {
        throw new Error('Only approved built-in functions are permitted.');
      }
    }
    if (node.type === 'binary_expr' && !new Set([
      '=', '!=', '<>', '<', '>', '<=', '>=', '<=>', '+', '-', '*', '/', '%', 'DIV', 'MOD',
      'AND', 'OR', 'XOR', 'IN', 'NOT IN', 'IS', 'IS NOT', 'LIKE', 'NOT LIKE', 'REGEXP', 'NOT REGEXP',
      'RLIKE', 'NOT RLIKE', 'BETWEEN', 'NOT BETWEEN', '&', '|', '^', '<<', '>>', '->', '->>'
    ]).has(node.operator?.toUpperCase())) throw new Error('Unsupported SQL operator.');
    if (node.type === 'column_ref' && (typeof node.column === 'string' && node.column.startsWith('@'))) {
      throw new Error('SQL variables are not permitted.');
    }
  });
}

function isDestructiveQuery(sql) {
  try { return modifyingTypes.has(parseSingleStatement(sql).type); } catch { return false; }
}

function validateQuerySafety(sql, approvedSchema) {
  try {
    const ast = parseSingleStatement(sql);
    if (ast.type === 'select') checkReadOnly(ast);
    else if (!modifyingTypes.has(ast.type)) throw new Error('Unsupported SQL statement.');
    checkTables(ast, approvedSchema);
    return { valid: true };
  } catch (error) {
    return { valid: false, error: error.message };
  }
}

function validateExecutionSafety(sql, approvedSchema) {
  try {
    const ast = parseSingleStatement(sql);
    checkReadOnly(ast);
    if (approvedSchema !== undefined) checkTables(ast, approvedSchema);
    return { valid: true, ast };
  } catch (error) {
    return { valid: false, error: error.message };
  }
}

function boundReadOnlyQuery(sql, schema, rowLimit) {
  const result = validateExecutionSafety(sql, schema);
  if (!result.valid) throw new Error(result.error);
  const ast = result.ast;
  const cap = positiveBound(rowLimit, 100, 100000);
  const values = ast.limit?.value;
  let offset;
  let count = cap;
  if (Array.isArray(values) && values.length) {
    if (values.some(value => value.type !== 'number' || !Number.isSafeInteger(Number(value.value)) || Number(value.value) < 0)) {
      throw new Error('LIMIT and OFFSET must be non-negative integers.');
    }
    if (values.length > 2) throw new Error('Unsupported LIMIT clause.');
    if (values.length === 2) {
      offset = ast.limit.seperator === 'offset' ? values[1] : values[0];
      count = Math.min(cap, Number((ast.limit.seperator === 'offset' ? values[0] : values[1]).value));
    } else count = Math.min(cap, Number(values[0].value));
  }
  ast.limit = { seperator: offset ? ',' : '', value: [...(offset ? [offset] : []), { type: 'number', value: count }] };
  return parser.sqlify(ast, dialect);
}

export { isDestructiveQuery, validateQuerySafety, validateExecutionSafety, parseSingleStatement, boundReadOnlyQuery, positiveBound };
