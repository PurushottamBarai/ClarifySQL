import express from 'express';
import { createConnection, closeConnection } from '../db/connectionManager.js';
import { compareSchemas } from '../schema/schemaComparator.js';

const router = express.Router();

router.post('/connect', async (req, res) => {
  try {
    const { host, port, user, password, database, connectionString } = req.body;

    const { liveSchema, database: dbName, host: dbHost, user: dbUser } = await createConnection(
      req.sessionID,
      { host, port, user, password, database, connectionString }
    );

    req.session.dbConnected = true;
    req.session.database = dbName;

    let compatibility = { compatible: true, errors: [], warnings: [] };
    if (req.session.importedSchema && req.session.importedSchema !== liveSchema) {
      compatibility = compareSchemas(req.session.importedSchema, liveSchema);
    } else {
      req.session.importedSchema = liveSchema;
    }

    res.json({
      success: true,
      connected: true,
      database: dbName,
      host: dbHost,
      user: dbUser,
      schema: req.session.importedSchema,
      compatibility
    });
  } catch (err) {
    req.session.dbConnected = false;
    res.status(400).json({
      success: false,
      connected: false,
      error: err.message
    });
  }
});

router.post('/disconnect', async (req, res) => {
  await closeConnection(req.sessionID);
  req.session.dbConnected = false;
  req.session.database = null;
  res.json({ success: true, connected: false });
});

router.get('/status', (req, res) => {
  res.json({
    connected: Boolean(req.session.dbConnected),
    database: req.session.database || null,
    schema: req.session.importedSchema || null
  });
});

export default router;
