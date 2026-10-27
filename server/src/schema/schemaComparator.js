function compareSchemas(importedSchema, liveSchema) {
  const errors = [];
  const warnings = [];

  if (!importedSchema || !importedSchema.tables || !Array.isArray(importedSchema.tables)) {
    return { compatible: false, errors: ['Imported schema is empty or invalid.'], warnings };
  }

  if (!liveSchema || !liveSchema.tables || !Array.isArray(liveSchema.tables)) {
    return { compatible: false, errors: ['Live database schema could not be retrieved.'], warnings };
  }

  const liveTableMap = new Map();
  for (const table of liveSchema.tables) {
    const colMap = new Map();
    for (const col of table.columns) {
      colMap.set(col.name.toLowerCase(), col.type.toLowerCase());
    }
    liveTableMap.set(table.name.toLowerCase(), colMap);
  }

  for (const impTable of importedSchema.tables) {
    const impTableName = impTable.name.toLowerCase();
    const liveColMap = liveTableMap.get(impTableName);

    if (!liveColMap) {
      errors.push(`Table '${impTable.name}' exists in imported schema but is missing in the live database.`);
      continue;
    }

    for (const impCol of impTable.columns) {
      const impColName = impCol.name.toLowerCase();
      const liveColType = liveColMap.get(impColName);

      if (!liveColType) {
        errors.push(`Column '${impTable.name}.${impCol.name}' is missing in the live database.`);
      }
    }
  }

  const compatible = errors.length === 0;
  return { compatible, errors, warnings };
}

export { compareSchemas };
