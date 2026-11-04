import express from 'express';
import { parseDDL } from '../schema/ddlParser.js';
import { compareSchemas } from '../schema/schemaComparator.js';

const router = express.Router();

router.post('/import', (req, res) => {
  try {
    const schema = parseDDL(req.body?.sqlContent);
    req.session.importedSchema = schema;
    req.session.pendingQuery = null;
    req.session.pendingQueryContext = null;
    req.session.queryContext = null;
    req.session.clarificationHistory = [];
    const compatibility = req.session.liveSchema ? compareSchemas(schema, req.session.liveSchema) : undefined;
    res.json({ success: true, tablesCount: schema.tables.length, schema, ...(compatibility ? { compatibility } : {}) });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/', (req, res) => {
  if (!req.session.importedSchema) {
    return res.status(404).json({ error: 'No schema has been imported in this session.' });
  }
  res.json({ schema: req.session.importedSchema });
});

export default router;
