import express from 'express';
import { createConnection } from '../db/connectionManager.js';
import { isDatabaseConfigValid } from '../security/databaseConfig.js';
import { compareSchemas } from '../schema/schemaComparator.js';

function clearDatabaseState(session) {
  delete session.databaseConnection;
  delete session.liveSchema;
  delete session.importedSchema;
  session.dbConnected = false;
  session.database = null;
  session.pendingQuery = null;
  session.clarificationHistory = [];
}

function connectionCompatibility(importedSchema, liveSchema) {
  const result = compareSchemas(importedSchema, liveSchema);
  if (!result.compatible) return result;
  const aliases = { integer: 'int', bool: 'tinyint', boolean: 'tinyint', numeric: 'decimal', dec: 'decimal', 'double precision': 'double' };
  const baseType = type => {
    const base = type.toLowerCase().replace(/\([^)]*\)/g, '').replace(/\b(unsigned|zerofill)\b/g, '').trim();
    return aliases[base] || base;
  };
  const liveTables = new Map(liveSchema.tables.map(table => [table.name.toLowerCase(), table]));
  for (const table of importedSchema.tables) {
    const liveColumns = new Map(liveTables.get(table.name.toLowerCase()).columns.map(column => [column.name.toLowerCase(), column]));
    for (const column of table.columns) {
      if (baseType(column.type) !== baseType(liveColumns.get(column.name.toLowerCase()).type)) {
        result.errors.push(`Column '${table.name}.${column.name}' has an incompatible database type.`);
      }
    }
  }
  return { ...result, compatible: result.errors.length === 0 };
}

export function createDatabaseRouter({ connect = createConnection, isConfigValid = isDatabaseConfigValid } = {}) {
  const router = express.Router();

  router.post('/connect', async (req, res) => {
    const session = req.session;
    const wasConfigured = Boolean(session.databaseConnection || session.dbConnected);
    const wasLiveSchema = session.liveSchema && JSON.stringify(session.importedSchema) === JSON.stringify(session.liveSchema);
    const importedSchema = wasLiveSchema || (wasConfigured && !session.liveSchema) ? null : session.importedSchema;
    clearDatabaseState(session);
    try {
      const { liveSchema, encryptedConfig, database, host, user } = await connect(req.body);
      const compatibility = importedSchema ? connectionCompatibility(importedSchema, liveSchema) :
        { compatible: true, errors: [], warnings: [] };
      if (!compatibility.compatible) {
        return res.status(400).json({
          success: false,
          connected: false,
          error: 'Imported schema is incompatible with the database.',
          compatibility
        });
      }
      session.databaseConnection = encryptedConfig;
      session.dbConnected = true;
      session.database = database;
      session.liveSchema = liveSchema;
      session.importedSchema = importedSchema || liveSchema;
      res.json({ success: true, connected: true, configured: true, database, host, user, schema: session.importedSchema, compatibility });
    } catch {
      clearDatabaseState(session);
      res.status(400).json({ success: false, connected: false, error: 'Unable to configure the database. Check the credentials, destination policy, and server settings.' });
    }
  });

  router.post('/disconnect', (req, res) => {
    clearDatabaseState(req.session);
    res.json({ success: true, connected: false, configured: false });
  });

  router.get('/status', (req, res) => {
    const configured = isConfigValid(req.session.databaseConnection);
    if (!configured && (req.session.databaseConnection || req.session.dbConnected)) clearDatabaseState(req.session);
    res.json({
      connected: configured,
      configured,
      database: configured ? req.session.database || null : null,
      schema: req.session.importedSchema || null
    });
  });

  return router;
}

export default createDatabaseRouter();
