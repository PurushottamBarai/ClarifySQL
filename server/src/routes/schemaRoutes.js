import express from 'express';
import { parseDDL } from '../schema/ddlParser.js';

const router = express.Router();

router.post('/import', (req, res, next) => {
  try {
    const { sqlContent } = req.body;
    if (!sqlContent || typeof sqlContent !== 'string') {
      return res.status(400).json({ error: 'Schema SQL content is required.' });
    }

    if (sqlContent.length > 2 * 1024 * 1024) {
      return res.status(400).json({ error: 'Schema file exceeds maximum limit of 2MB.' });
    }

    const { tables, warnings } = parseDDL(sqlContent);

    req.session.importedSchema = { tables, warnings };

    res.json({
      success: true,
      tablesCount: tables.length,
      schema: { tables, warnings }
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/', (req, res) => {
  if (!req.session.importedSchema) {
    return res.status(404).json({ error: 'No schema has been imported in this session.' });
  }
  res.json({ schema: req.session.importedSchema });
});

export default router;
