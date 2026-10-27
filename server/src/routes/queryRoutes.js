import express from 'express';
import { analyzeQuestionWithGroq } from '../services/groqService.js';
import { validateQuerySafety, isDestructiveQuery, validateExecutionSafety } from '../validators/sqlValidator.js';
import { executeReadOnlyQuery } from '../db/queryExecutor.js';

const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const { question, clarificationAnswer } = req.body;

    if (!question || typeof question !== 'string') {
      return res.status(400).json({ error: 'Question is required.' });
    }

    const schema = req.session.importedSchema;
    if (!schema || !schema.tables || schema.tables.length === 0) {
      return res.status(400).json({ error: 'No database schema imported. Please import a schema first.' });
    }

    if (!req.session.clarificationHistory) {
      req.session.clarificationHistory = [];
    }

    if (clarificationAnswer && req.session.clarificationHistory.length > 0) {
      const lastTurn = req.session.clarificationHistory[req.session.clarificationHistory.length - 1];
      lastTurn.clarificationAnswer = clarificationAnswer;
    }

    const result = await analyzeQuestionWithGroq({
      question,
      schema,
      clarificationHistory: req.session.clarificationHistory
    });

    if (result.status === 'clear') {
      const safetyCheck = validateQuerySafety(result.sqlDraft, schema);
      if (!safetyCheck.valid) {
        result.status = 'unsupported';
        result.reason = `Query validation failed: ${safetyCheck.error}`;
        delete result.sqlDraft;
      } else {
        if (isDestructiveQuery(result.sqlDraft)) {
          result.isDestructive = true;
          result.warning = result.warning || 'Warning: This query modifies or alters data/schema. ClarifySQL will not execute destructive queries on the connected database; run it manually in your database tool if intended.';
        }
        req.session.pendingQuery = result.sqlDraft;
        req.session.clarificationHistory = [];
      }
    } else if (result.status === 'needs_clarification') {
      req.session.clarificationHistory.push({
        question,
        clarificationPrompt: result.clarificationPrompt,
        options: result.options
      });
    } else {
      req.session.clarificationHistory = [];
    }

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/execute', async (req, res) => {
  try {
    const sqlToRun = req.body.sql || req.session.pendingQuery;

    if (!sqlToRun) {
      return res.status(400).json({ error: 'No approved query available to execute.' });
    }

    const executionCheck = validateExecutionSafety(sqlToRun);
    if (!executionCheck.valid) {
      return res.status(400).json({ error: executionCheck.error });
    }

    const schema = req.session.importedSchema;
    const safetyCheck = validateQuerySafety(sqlToRun, schema);
    if (!safetyCheck.valid) {
      return res.status(400).json({ error: safetyCheck.error });
    }

    const result = await executeReadOnlyQuery(req.sessionID, sqlToRun);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/reset', (req, res) => {
  req.session.clarificationHistory = [];
  req.session.pendingQuery = null;
  res.json({ success: true, message: 'Clarification context reset.' });
});

export default router;
