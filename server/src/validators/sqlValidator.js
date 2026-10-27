function isDestructiveQuery(sql) {
  if (!sql || typeof sql !== 'string') return false;
  const destructiveRegex = /\b(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|REPLACE|GRANT|REVOKE|CREATE)\b/i;
  return destructiveRegex.test(sql);
}

function validateQuerySafety(sql, approvedSchema) {
  if (!sql || typeof sql !== 'string') {
    return { valid: false, error: 'Query string is required.' };
  }

  const clean = sql.trim().replace(/;+$/, '');

  if (clean.includes(';')) {
    return { valid: false, error: 'Multiple statements are strictly forbidden.' };
  }

  if (approvedSchema && approvedSchema.tables && approvedSchema.tables.length > 0) {
    const allowedTableNames = new Set(approvedSchema.tables.map(t => t.name.toLowerCase()));
    const tablePattern = /\b(?:FROM|JOIN|INTO|TABLE|UPDATE)\s+[`"']?([a-zA-Z0-9_]+)[`"']?/gi;
    let match;
    while ((match = tablePattern.exec(clean)) !== null) {
      const referencedTable = match[1].toLowerCase();
      if (!allowedTableNames.has(referencedTable)) {
        return { valid: false, error: `Query references unknown table '${referencedTable}' not present in imported schema.` };
      }
    }
  }

  return { valid: true };
}

function validateExecutionSafety(sql) {
  if (!sql || typeof sql !== 'string') {
    return { valid: false, error: 'Query string is required.' };
  }

  const clean = sql.trim().replace(/;+$/, '');

  if (clean.includes(';')) {
    return { valid: false, error: 'Multiple statements cannot be executed.' };
  }

  if (!/^SELECT\b/i.test(clean)) {
    return {
      valid: false,
      error: 'Execution blocked: ClarifySQL only executes read-only SELECT queries. Modifying queries (ALTER/DROP/DELETE/INSERT/UPDATE) must be executed manually in your database tool.'
    };
  }

  return { valid: true };
}

export { isDestructiveQuery, validateQuerySafety, validateExecutionSafety };
