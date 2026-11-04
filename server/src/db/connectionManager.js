import mysql from 'mysql2/promise';
import net from 'node:net';
import {
  DatabaseConfigError,
  decryptDatabaseConfig,
  encryptDatabaseConfig,
  parseConnectionString,
  positiveSetting
} from '../security/databaseConfig.js';
import { validateDestination } from '../security/databaseDestination.js';

export async function withTimeout(operation, timeoutMs, onTimeout = () => {}) {
  let timer;
  try {
    return await Promise.race([
      Promise.resolve().then(operation),
      new Promise((_, reject) => {
        timer = setTimeout(() => {
          try { onTimeout(); } catch {}
          reject(new DatabaseConfigError('Database operation timed out.'));
        }, timeoutMs);
      })
    ]);
  } finally {
    clearTimeout(timer);
  }
}

function destroyConnection(connection) {
  try { connection.destroy(); } catch {}
  try { connection.connection?.stream?.destroy(); } catch {}
}

export async function closeConnection(connection) {
  if (!connection) return;
  try {
    await withTimeout(() => connection.end(), 1000, () => destroyConnection(connection));
  } catch {} finally {
    destroyConnection(connection);
  }
}

export async function inspectLiveSchema(connection, databaseName, timeoutMs = 10000) {
  const [columns] = await connection.query({
    sql: `SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_KEY
          FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ?
          ORDER BY TABLE_NAME, ORDINAL_POSITION LIMIT 10001`,
    timeout: timeoutMs
  }, [databaseName]);
  if (!Array.isArray(columns) || columns.length > 10000) {
    throw new DatabaseConfigError('Database schema exceeds the supported size.');
  }
  const tableMap = new Map();
  for (const row of columns) {
    if (!tableMap.has(row.TABLE_NAME)) {
      if (tableMap.size >= 500) throw new DatabaseConfigError('Database schema exceeds the supported size.');
      tableMap.set(row.TABLE_NAME, { name: row.TABLE_NAME, columns: [], primaryKeys: [], foreignKeys: [] });
    }
    const table = tableMap.get(row.TABLE_NAME);
    const isPrimary = row.COLUMN_KEY === 'PRI';
    table.columns.push({
      name: row.COLUMN_NAME,
      type: row.DATA_TYPE.toLowerCase(),
      nullable: row.IS_NULLABLE === 'YES',
      isPrimary
    });
    if (isPrimary) table.primaryKeys.push(row.COLUMN_NAME);
  }
  const [foreignKeys] = await connection.query({
    sql: `SELECT TABLE_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
          FROM information_schema.KEY_COLUMN_USAGE
          WHERE TABLE_SCHEMA = ? AND REFERENCED_TABLE_SCHEMA = ? AND REFERENCED_TABLE_NAME IS NOT NULL
          ORDER BY TABLE_NAME, CONSTRAINT_NAME, ORDINAL_POSITION LIMIT 10001`,
    timeout: timeoutMs
  }, [databaseName, databaseName]);
  if (!Array.isArray(foreignKeys) || foreignKeys.length > 10000) {
    throw new DatabaseConfigError('Database schema exceeds the supported size.');
  }
  for (const row of foreignKeys) {
    tableMap.get(row.TABLE_NAME)?.foreignKeys.push({
      column: row.COLUMN_NAME,
      referencedTable: row.REFERENCED_TABLE_NAME,
      referencedColumn: row.REFERENCED_COLUMN_NAME
    });
  }
  return { tables: Array.from(tableMap.values()) };
}

export function createConnectionManager({
  env = process.env,
  now = Date.now,
  resolve,
  mysqlCreateConnection = mysql.createConnection,
  connectSocket = options => net.connect(options)
} = {}) {
  async function openConnection(encryptedConfig) {
    const config = decryptDatabaseConfig(encryptedConfig, { env, now });
    const timeoutMs = positiveSetting(env.DATABASE_CONNECT_TIMEOUT_MS, 10000);
    let socket;
    let connection;
    let timedOut = false;
    try {
      return await withTimeout(async () => {
        const destination = await validateDestination(config, { env, resolve });
        if (timedOut) throw new DatabaseConfigError();
        connection = await mysqlCreateConnection({
          host: destination.host,
          port: config.port,
          user: config.user,
          password: config.password,
          database: config.database,
          ssl: destination.ssl,
          connectTimeout: timeoutMs,
          multipleStatements: false,
          infileStreamFactory: () => { throw new DatabaseConfigError('Local file access is disabled.'); },
          stream: () => {
            socket = connectSocket({ host: destination.address, port: config.port, family: destination.family });
            return socket;
          }
        });
        if (timedOut) {
          destroyConnection(connection);
          throw new DatabaseConfigError();
        }
        decryptDatabaseConfig(encryptedConfig, { env, now });
        return connection;
      }, timeoutMs, () => {
        timedOut = true;
        socket?.destroy();
        if (connection) destroyConnection(connection);
      });
    } catch (error) {
      socket?.destroy();
      if (connection) destroyConnection(connection);
      if (error instanceof DatabaseConfigError) throw error;
      throw new DatabaseConfigError('Unable to connect to the database. Check its configuration and availability.');
    }
  }

  async function createConnection(config) {
    const encryptedConfig = encryptDatabaseConfig(config, { env, now });
    const validated = decryptDatabaseConfig(encryptedConfig, { env, now });
    const timeoutMs = positiveSetting(env.DATABASE_INSPECT_TIMEOUT_MS, 10000);
    let connection;
    try {
      connection = await openConnection(encryptedConfig);
      const liveSchema = await withTimeout(
        () => inspectLiveSchema(connection, validated.database, timeoutMs),
        timeoutMs,
        () => destroyConnection(connection)
      );
      decryptDatabaseConfig(encryptedConfig, { env, now });
      return { liveSchema, encryptedConfig, database: validated.database, host: validated.host, user: validated.user };
    } catch (error) {
      if (error instanceof DatabaseConfigError) throw error;
      throw new DatabaseConfigError('Unable to inspect the database schema.');
    } finally {
      await closeConnection(connection);
    }
  }

  return { openConnection, createConnection };
}

const { openConnection, createConnection } = createConnectionManager();
export { openConnection, createConnection, parseConnectionString };
