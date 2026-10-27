import { getConnection } from './connectionManager.js';

async function executeReadOnlyQuery(sessionId, sql, options = {}) {
  const { pool } = getConnection(sessionId);
  const rowLimit = options.rowLimit || 100;
  const timeoutMs = options.timeoutMs || 5000;

  let boundedSql = sql.trim().replace(/;+$/, '');
  if (!/\bLIMIT\s+\d+/i.test(boundedSql)) {
    boundedSql = `${boundedSql} LIMIT ${rowLimit}`;
  }

  const queryPromise = pool.query(boundedSql);

  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => {
      reject(new Error(`Query execution timed out after ${timeoutMs}ms.`));
    }, timeoutMs);
  });

  const [rows, fields] = await Promise.race([queryPromise, timeoutPromise]);

  const columns = fields ? fields.map(f => f.name) : [];
  return {
    columns,
    rows: Array.isArray(rows) ? rows : [],
    rowCount: Array.isArray(rows) ? rows.length : 0,
    executedSql: boundedSql
  };
}

export { executeReadOnlyQuery };
