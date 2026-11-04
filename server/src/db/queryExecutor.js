import * as connectionManager from './connectionManager.js';
import { boundReadOnlyQuery, positiveBound } from '../validators/sqlValidator.js';

async function executeReadOnlyQuery(encryptedConfig, sql, options = {}) {
  const rowLimit = positiveBound(options.rowLimit ?? process.env.QUERY_ROW_LIMIT, 100, 100000);
  const timeoutMs = positiveBound(options.timeoutMs ?? process.env.QUERY_TIMEOUT_MS, 5000, 300000);
  const maxBytes = positiveBound(options.maxBytes ?? process.env.QUERY_MAX_BYTES, 1024 * 1024, 64 * 1024 * 1024);
  if (typeof encryptedConfig !== 'string' || !encryptedConfig) throw new Error('A database connection is required.');
  if (!options.schema) throw new Error('An approved schema is required.');
  const boundedSql = boundReadOnlyQuery(sql, options.schema, rowLimit);
  const openConnection = options.openConnection ?? connectionManager.openConnection;
  if (typeof openConnection !== 'function') throw new Error('Database connection service is unavailable.');
  let connection;
  let timer;
  let expired = false;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      expired = true;
      try { connection?.destroy(); } finally {
        reject(new Error(`Query execution timed out after ${timeoutMs}ms.`));
      }
    }, timeoutMs);
  });
  const execute = async () => {
    const opened = await openConnection(encryptedConfig);
    if (expired) {
      opened.destroy();
      throw new Error('Query connection arrived after the execution deadline.');
    }
    connection = opened;
    if (!connection.connection?.query) throw new Error('Streaming database connection is unavailable.');
    const query = connection.connection.query(boundedSql);
    let columns = [];
    let bytes = 0;
    query.on('fields', fields => { columns = fields.map(field => field.name); });
    const stream = query.stream({ highWaterMark: 1 });
    const rows = [];
    try {
      for await (const row of stream) {
        bytes += Buffer.byteLength(JSON.stringify(row), 'utf8');
        if (rows.length >= rowLimit || bytes > maxBytes) {
          throw new Error('Query result exceeds the configured row or byte limit.');
        }
        rows.push(row);
      }
    } finally {
      stream.destroy();
    }
    if (Buffer.byteLength(JSON.stringify(columns), 'utf8') + bytes > maxBytes) {
      throw new Error('Query result exceeds the configured byte limit.');
    }
    return { columns, rows, rowCount: rows.length, executedSql: boundedSql };
  };
  try {
    return await Promise.race([execute(), timeout]);
  } finally {
    clearTimeout(timer);
    if (!expired) connection?.destroy();
  }
}

export { executeReadOnlyQuery };
