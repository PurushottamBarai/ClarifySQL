import Groq from 'groq-sdk';
import { z } from 'zod';

const ClarificationResponseSchema = z.object({
  status: z.enum(['clear', 'needs_clarification', 'unsupported']),
  interpretation: z.string().optional(),
  sqlDraft: z.string().optional(),
  clarificationPrompt: z.string().optional(),
  options: z.array(z.string()).optional(),
  reason: z.string().optional(),
  isDestructive: z.boolean().optional(),
  warning: z.string().optional()
});

function getGroqClient() {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error('GROQ_API_KEY is not configured in server environment.');
  }
  return new Groq({ apiKey });
}

function formatSchemaForPrompt(schema) {
  if (!schema || !schema.tables) return 'No schema available.';
  return schema.tables.map(table => {
    const cols = table.columns.map(c => `${c.name} (${c.type}${c.isPrimary ? ', PK' : ''})`).join(', ');
    const fks = (table.foreignKeys || []).map(fk => `${fk.column} -> ${fk.referencedTable}.${fk.referencedColumn}`).join(', ');
    return `TABLE ${table.name} (\n  Columns: ${cols}${fks ? `\n  Foreign Keys: ${fks}` : ''}\n)`;
  }).join('\n\n');
}

async function analyzeQuestionWithGroq({ question, schema, clarificationHistory = [] }) {
  const groq = getGroqClient();
  const model = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';

  const schemaText = formatSchemaForPrompt(schema);

  const systemPrompt = `You are ClarifySQL, an expert Natural Language to MySQL clarification and query assistance engine.
Your mission is to evaluate questions against the provided schema, resolve ambiguities, and provide accurate MySQL queries.

DATABASE SCHEMA (MySQL dialect):
${schemaText}

RULES:
1. ONLY reference tables and columns that exist in the schema above. Do NOT invent non-existent columns, tables, or relations.
2. If the user question has ambiguous business terms (e.g., "best customer", "active users", "high value") or missing time ranges/entities, respond with status: "needs_clarification" and ask a single focused question with clear multiple-choice options. Do NOT return SQL when clarifying.
3. If the user asks for operations that modify data or schema (e.g. ALTER TABLE, DROP COLUMN, DROP TABLE, DELETE, UPDATE, INSERT, TRUNCATE):
   - Generate the accurate MySQL query in sqlDraft.
   - Set status: "clear".
   - Set isDestructive: true.
   - Set warning: "Warning: This query modifies or removes schema/data. ClarifySQL will not execute destructive queries on the connected database; run it manually in your database management tool if intended."
4. If the question asks for tables or columns completely unrelated to or missing from the schema, respond with status: "unsupported" and explain why in reason.
5. If the question is clear and well-specified, respond with status: "clear", providing a plain-English interpretation and the single MySQL query in sqlDraft.
6. Return JSON ONLY matching this schema:
{
  "status": "clear" | "needs_clarification" | "unsupported",
  "interpretation": "plain English explanation of what this query does (when clear)",
  "sqlDraft": "MySQL statement (only when clear, single query, no markdown)",
  "isDestructive": true,
  "warning": "Warning message when isDestructive is true",
  "clarificationPrompt": "Focused question to resolve ambiguity (when needs_clarification)",
  "options": ["Option A", "Option B", "Option C"],
  "reason": "Clear explanation of why the request is unsupported (when unsupported)"
}`;

  const messages = [
    { role: 'system', content: systemPrompt }
  ];

  for (const turn of clarificationHistory) {
    if (turn.question) {
      messages.push({ role: 'user', content: turn.question });
    }
    if (turn.clarificationPrompt) {
      messages.push({
        role: 'assistant',
        content: JSON.stringify({
          status: 'needs_clarification',
          clarificationPrompt: turn.clarificationPrompt,
          options: turn.options || []
        })
      });
    }
    if (turn.clarificationAnswer) {
      messages.push({ role: 'user', content: `Clarification answer: ${turn.clarificationAnswer}` });
    }
  }

  messages.push({ role: 'user', content: question });

  const response = await groq.chat.completions.create({
    model,
    messages,
    response_format: { type: 'json_object' }
  });

  const rawContent = response.choices[0]?.message?.content;
  if (!rawContent) {
    throw new Error('Empty response received from Groq clarification engine.');
  }

  let parsedJson;
  try {
    parsedJson = JSON.parse(rawContent);
  } catch (err) {
    const extracted = rawContent.replace(/```json\s*/gi, '').replace(/```/g, '').trim();
    parsedJson = JSON.parse(extracted);
  }

  const validated = ClarificationResponseSchema.parse(parsedJson);

  if (validated.status === 'clear' && validated.sqlDraft) {
    validated.sqlDraft = validated.sqlDraft.replace(/```sql\s*/gi, '').replace(/```/g, '').trim();
  }

  return validated;
}

export { analyzeQuestionWithGroq };
