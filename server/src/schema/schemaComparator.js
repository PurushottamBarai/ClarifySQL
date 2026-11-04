function validSchema(schema) {
  if (!schema || !Array.isArray(schema.tables) || schema.tables.length === 0) return false;
  const tables = new Set();
  return schema.tables.every(table => {
    if (!table || typeof table.name !== 'string' || !table.name || tables.has(table.name) ||
        !Array.isArray(table.columns) || table.columns.length === 0) return false;
    tables.add(table.name);
    const columns = new Set();
    return table.columns.every(column => {
      if (!column || typeof column.name !== 'string' || !column.name || columns.has(column.name.toLowerCase()) ||
          typeof column.type !== 'string' || !column.type.trim()) return false;
      columns.add(column.name.toLowerCase());
      return true;
    });
  });
}

function baseType(type) {
  const name = type.trim().toLowerCase().split(/[\s(]/)[0];
  return ({ integer: 'int', numeric: 'decimal', dec: 'decimal', bool: 'tinyint', boolean: 'tinyint',
    'double precision': 'double' })[name] || name;
}

function compareSchemas(importedSchema, liveSchema) {
  const errors = [];
  const warnings = [];
  if (!validSchema(importedSchema)) return { compatible: false, errors: ['Imported schema is empty or invalid.'], warnings };
  if (!validSchema(liveSchema)) return { compatible: false, errors: ['Live database schema could not be retrieved or is invalid.'], warnings };
  const liveTables = new Map(liveSchema.tables.map(table => [table.name, table]));
  for (const table of importedSchema.tables) {
    const live = liveTables.get(table.name);
    if (!live) {
      errors.push(`Table '${table.name}' is missing in the live database.`);
      continue;
    }
    const columns = new Map(live.columns.map(column => [column.name.toLowerCase(), column]));
    for (const column of table.columns) {
      const actual = columns.get(column.name.toLowerCase());
      if (!actual) errors.push(`Column '${table.name}.${column.name}' is missing in the live database.`);
      else if (baseType(column.type) !== baseType(actual.type)) {
        errors.push(`Column '${table.name}.${column.name}' has an incompatible type in the live database.`);
      }
    }
  }
  return { compatible: errors.length === 0, errors, warnings };
}

export { compareSchemas };
