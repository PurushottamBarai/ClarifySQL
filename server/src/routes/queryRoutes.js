import express from 'express';
import { createHash } from 'node:crypto';
import { analyzeQuestionWithGroq } from '../services/groqService.js';
import { validateQuerySafety, isDestructiveQuery, validateExecutionSafety, positiveBound } from '../validators/sqlValidator.js';
import { executeReadOnlyQuery } from '../db/queryExecutor.js';
import { compareSchemas } from '../schema/schemaComparator.js';

function clearContext(session) {
  session.clarificationHistory = [];
  session.pendingQuery = null;
  session.pendingQueryContext = null;
}

function contextKey(session) {
  return createHash('sha256').update(JSON.stringify([
    session.importedSchema ?? null, session.databaseConnection ?? null, session.liveSchema ?? null
  ])).digest('hex');
}

function synchronizeContext(session) {
  const key = contextKey(session);
  if (session.queryContext !== key) clearContext(session);
  session.queryContext = key;
  return key;
}

function createQueryRouter({ analyze = analyzeQuestionWithGroq, execute = executeReadOnlyQuery } = {}) {
  const router = express.Router();

  router.post('/', async (req, res) => {
    try {
      const context = synchronizeContext(req.session);
      const { question, clarificationAnswer } = req.body ?? {};
      const maxLength = positiveBound(process.env.QUERY_MAX_LENGTH, 20000, 1000000);
      const maxTurns = positiveBound(process.env.CLARIFICATION_MAX_TURNS, 8, 50);
      const boundedText = value => typeof value === 'string' && value.trim() && Buffer.byteLength(value, 'utf8') <= maxLength;
      if (!boundedText(question)) return res.status(400).json({ error: `Question must contain at most ${maxLength} bytes.` });
      if (clarificationAnswer !== undefined && !boundedText(clarificationAnswer)) {
        return res.status(400).json({ error: `Clarification answer must contain at most ${maxLength} bytes.` });
      }
      const schema = req.session.importedSchema;
      if (!schema?.tables?.length) return res.status(400).json({ error: 'Import a database schema first.' });
      if (!clarificationAnswer) clearContext(req.session);
      const history = req.session.clarificationHistory;
      if (!Array.isArray(history) || history.length > maxTurns || Buffer.byteLength(JSON.stringify(history), 'utf8') > maxLength * maxTurns) {
        clearContext(req.session);
        return res.status(400).json({ error: 'Clarification history limit reached. Start a new question.' });
      }
      if (clarificationAnswer) {
        if (!history.length) return res.status(400).json({ error: 'No clarification is awaiting an answer.' });
        history[history.length - 1].clarificationAnswer = clarificationAnswer;
      }
      if (Buffer.byteLength(JSON.stringify(history), 'utf8') > maxLength * maxTurns) {
        clearContext(req.session);
        return res.status(400).json({ error: 'Clarification history limit reached.' });
      }
      req.session.pendingQuery = null;
      req.session.pendingQueryContext = null;
      const result = await analyze({ question, schema, clarificationHistory: history });
      if (contextKey(req.session) !== context) {
        clearContext(req.session);
        return res.status(409).json({ error: 'Database context changed. Submit the question again.' });
      }
      if (result.status === 'clear') {
        const safety = validateQuerySafety(result.sqlDraft, schema);
        if (!safety.valid) {
          result.status = 'unsupported';
          result.reason = `Query validation failed: ${safety.error}`;
          delete result.sqlDraft;
        } else {
          result.isDestructive = isDestructiveQuery(result.sqlDraft);
          if (result.isDestructive) result.warning = 'This draft modifies data or schema and cannot be executed by ClarifySQL.';
          req.session.pendingQuery = result.sqlDraft;
          req.session.pendingQueryContext = context;
        }
        req.session.clarificationHistory = [];
      } else if (result.status === 'needs_clarification') {
        if (history.length >= maxTurns) {
          clearContext(req.session);
          return res.status(400).json({ error: 'Clarification turn limit reached. Start a new question.' });
        }
        result.options ??= [];
        if (!boundedText(result.clarificationPrompt) || !Array.isArray(result.options) ||
            result.options.length > 20 || result.options.some(option => !boundedText(option))) {
          clearContext(req.session);
          return res.status(400).json({ error: 'Invalid or oversized clarification response.' });
        }
        const turn = { question, clarificationPrompt: result.clarificationPrompt, options: result.options };
        if (Buffer.byteLength(JSON.stringify([...history, turn]), 'utf8') > maxLength * maxTurns) {
          clearContext(req.session);
          return res.status(400).json({ error: 'Clarification history limit reached.' });
        }
        history.push(turn);
      } else clearContext(req.session);
      return res.json(result);
    } catch {
      clearContext(req.session);
      return res.status(500).json({ error: 'Unable to generate a query. Please try again.' });
    }
  });

  router.post('/execute', async (req, res) => {
    try {
      const context = synchronizeContext(req.session);
      const sql = req.body?.sql ?? req.session.pendingQuery;
      if (!sql || (!req.body?.sql && req.session.pendingQueryContext !== context)) {
        return res.status(400).json({ error: 'No approved query available to execute.' });
      }
      if (!req.session.databaseConnection) return res.status(400).json({ error: 'Connect to a database first.' });
      const schema = req.session.importedSchema;
      const compatibility = compareSchemas(schema, req.session.liveSchema);
      if (!compatibility.compatible) {
        return res.status(400).json({ error: 'Imported schema is not compatible with the connected database.', compatibility });
      }
      const safety = validateExecutionSafety(sql, schema);
      if (!safety.valid) return res.status(400).json({ error: safety.error });
      const result = await execute(req.session.databaseConnection, sql, { schema });
      return res.json({ success: true, ...result });
    } catch {
      return res.status(400).json({ error: 'Query execution failed or exceeded the configured limits.' });
    }
  });

  router.post('/reset', (req, res) => {
    clearContext(req.session);
    res.json({ success: true, message: 'Clarification context reset.' });
  });
  return router;
}

export { createQueryRouter };
export default createQueryRouter();
