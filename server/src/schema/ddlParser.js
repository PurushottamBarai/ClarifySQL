function parseDDL(sqlContent) {
  if (!sqlContent || typeof sqlContent !== 'string') {
    throw new Error('Invalid SQL content provided.');
  }

  const forbiddenPatterns = [
    /\bINSERT\s+INTO\b/i,
    /\bUPDATE\s+[\w`]+\s+SET\b/i,
    /\bDELETE\s+FROM\b/i,
    /\bDROP\s+TABLE\b/i,
    /\bALTER\s+TABLE\b/i,
    /\bTRUNCATE\s+TABLE\b/i
  ];

  for (const pattern of forbiddenPatterns) {
    if (pattern.test(sqlContent)) {
      throw new Error('Data modification or DDL alteration statements are not permitted in schema import.');
    }
  }

  const cleanSql = sqlContent
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/--.*$/gm, '')
    .replace(/#.*$/gm, '');

  const createTableRegex = /CREATE\s+TABLE(?:\s+IF\s+NOT\s+EXISTS)?\s+[`"']?([a-zA-Z0-9_]+)[`"']?\s*\(([\s\S]*?)\)(?:[^;]*;)/gi;
  const tables = [];
  const warnings = [];
  let match;

  while ((match = createTableRegex.exec(cleanSql)) !== null) {
    const tableName = match[1];
    const body = match[2];
    const columns = [];
    const primaryKeys = new Set();
    const foreignKeys = [];

    const lines = splitTableDefinitions(body);

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;

      if (/^CONSTRAINT\b/i.test(line) || /^FOREIGN\s+KEY\b/i.test(line)) {
        const fkMatch = line.match(/(?:CONSTRAINT\s+[`"']?\w+[`"']?\s+)?FOREIGN\s+KEY\s*\([`"']?([a-zA-Z0-9_]+)[`"']?\)\s*REFERENCES\s+[`"']?([a-zA-Z0-9_]+)[`"']?\s*\([`"']?([a-zA-Z0-9_]+)[`"']?\)/i);
        if (fkMatch) {
          foreignKeys.push({
            column: fkMatch[1],
            referencedTable: fkMatch[2],
            referencedColumn: fkMatch[3]
          });
        }
        continue;
      }

      if (/^PRIMARY\s+KEY\b/i.test(line)) {
        const pkMatch = line.match(/PRIMARY\s+KEY\s*\((.*?)\)/i);
        if (pkMatch) {
          const pks = pkMatch[1].split(',').map(s => s.replace(/[`"'\s]/g, ''));
          pks.forEach(pk => primaryKeys.add(pk));
        }
        continue;
      }

      if (/^(?:KEY|INDEX|UNIQUE\s+KEY|UNIQUE\s+INDEX)\b/i.test(line)) {
        continue;
      }

      const colMatch = line.match(/^[`"']?([a-zA-Z0-9_]+)[`"']?\s+([a-zA-Z]+(?:\([^)]+\))?)([\s\S]*)$/);
      if (colMatch) {
        const colName = colMatch[1];
        const colType = colMatch[2].toLowerCase();
        const modifiers = colMatch[3] || '';
        const nullable = !/NOT\s+NULL/i.test(modifiers);
        const isInlinePk = /PRIMARY\s+KEY/i.test(modifiers);

        if (isInlinePk) {
          primaryKeys.add(colName);
        }

        columns.push({
          name: colName,
          type: colType,
          nullable,
          isPrimary: false
        });
      }
    }

    columns.forEach(col => {
      if (primaryKeys.has(col.name)) {
        col.isPrimary = true;
      }
    });

    if (columns.length > 0) {
      tables.push({
        name: tableName,
        columns,
        primaryKeys: Array.from(primaryKeys),
        foreignKeys
      });
    } else {
      warnings.push(`Table '${tableName}' contained no parsable columns.`);
    }
  }

  if (tables.length === 0) {
    throw new Error('No valid CREATE TABLE statements found in the uploaded SQL file.');
  }

  return { tables, warnings };
}

function splitTableDefinitions(body) {
  const lines = [];
  let current = '';
  let parenDepth = 0;

  for (let i = 0; i < body.length; i++) {
    const char = body[i];
    if (char === '(') parenDepth++;
    else if (char === ')') parenDepth--;

    if (char === ',' && parenDepth === 0) {
      lines.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  if (current.trim()) {
    lines.push(current);
  }

  return lines;
}

export { parseDDL };
