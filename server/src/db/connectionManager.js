import mysql from 'mysql2/promise';

const connectionPools = new Map();

function parseConnectionString(connectionString) {
  try {
    const url = new URL(connectionString);
    if (url.protocol !== 'mysql:') {
      throw new Error('Connection string must use mysql:// protocol');
    }

    const host = url.hostname;
    const isRemote = host !== 'localhost' && host !== '127.0.0.1';

    let ssl;
    if (url.searchParams.has('ssl')) {
      try {
        ssl = JSON.parse(url.searchParams.get('ssl'));
      } catch {
        ssl = { minVersion: 'TLSv1.2', rejectUnauthorized: true };
      }
    } else if (isRemote || url.searchParams.get('sslmode')) {
      ssl = { minVersion: 'TLSv1.2', rejectUnauthorized: true };
    }

    return {
      host,
      port: Number(url.port) || 3306,
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      database: url.pathname.replace(/^\//, ''),
      ssl
    };
  } catch (err) {
    throw new Error(`Invalid MySQL connection string: ${err.message}`);
  }
}

async function createConnection(sessionId, config) {
  let dbConfig;
  if (config.connectionString) {
    dbConfig = parseConnectionString(config.connectionString);
  } else {
    const host = config.host || 'localhost';
    const isRemote = host !== 'localhost' && host !== '127.0.0.1';
    dbConfig = {
      host,
      port: Number(config.port) || 3306,
      user: config.user,
      password: config.password,
      database: config.database,
      ssl: isRemote ? { minVersion: 'TLSv1.2', rejectUnauthorized: true } : undefined
    };
  }

  if (!dbConfig.user || !dbConfig.database) {
    throw new Error('Database username and database name are required.');
  }

  await closeConnection(sessionId);

  const pool = mysql.createPool({
    ...dbConfig,
    waitForConnections: true,
    connectionLimit: 5,
    queueLimit: 0,
    connectTimeout: 15000
  });

  const [testResult] = await pool.query('SELECT 1 as connected');
  if (!testResult || testResult.length === 0) {
    throw new Error('Unable to establish connection to MySQL database.');
  }

  connectionPools.set(sessionId, {
    pool,
    database: dbConfig.database,
    host: dbConfig.host,
    user: dbConfig.user
  });

  const liveSchema = await inspectLiveSchema(pool, dbConfig.database);
  return { liveSchema, database: dbConfig.database, host: dbConfig.host, user: dbConfig.user };
}

async function inspectLiveSchema(pool, databaseName) {
  const [columns] = await pool.query(
    `SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_KEY 
     FROM information_schema.COLUMNS 
     WHERE TABLE_SCHEMA = ? 
     ORDER BY TABLE_NAME, ORDINAL_POSITION`,
    [databaseName]
  );

  const tableMap = new Map();
  for (const row of columns) {
    const tableName = row.TABLE_NAME;
    if (!tableMap.has(tableName)) {
      tableMap.set(tableName, {
        name: tableName,
        columns: [],
        primaryKeys: []
      });
    }

    const isPrimary = row.COLUMN_KEY === 'PRI';
    tableMap.get(tableName).columns.push({
      name: row.COLUMN_NAME,
      type: row.DATA_TYPE.toLowerCase(),
      nullable: row.IS_NULLABLE === 'YES',
      isPrimary
    });

    if (isPrimary) {
      tableMap.get(tableName).primaryKeys.push(row.COLUMN_NAME);
    }
  }

  return { tables: Array.from(tableMap.values()) };
}

function getConnection(sessionId) {
  const conn = connectionPools.get(sessionId);
  if (!conn) {
    throw new Error('No active database connection found for this session.');
  }
  return conn;
}

async function closeConnection(sessionId) {
  const existing = connectionPools.get(sessionId);
  if (existing) {
    try {
      await existing.pool.end();
    } catch (_) {}
    connectionPools.delete(sessionId);
  }
}

export {
  createConnection,
  getConnection,
  closeConnection,
  parseConnectionString
};
