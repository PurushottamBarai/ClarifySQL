import { format } from "sql-formatter";

const SQL_KEYWORDS = new Set([
  "SELECT", "FROM", "WHERE", "AND", "OR", "NOT", "IN", "IS", "NULL", "LIKE", "ILIKE",
  "BETWEEN", "EXISTS", "JOIN", "INNER", "LEFT", "RIGHT", "FULL", "OUTER", "CROSS",
  "NATURAL", "ON", "AS", "DISTINCT", "ALL", "UNION", "INTERSECT", "EXCEPT",
  "GROUP", "BY", "HAVING", "ORDER", "ASC", "DESC", "LIMIT", "OFFSET",
  "INSERT", "INTO", "VALUES", "UPDATE", "SET", "DELETE", "TRUNCATE",
  "CREATE", "ALTER", "DROP", "TABLE", "DATABASE", "SCHEMA", "VIEW", "INDEX",
  "SHOW", "DATABASES", "TABLES", "COLUMNS", "DESCRIBE", "EXPLAIN", "USE",
  "CASE", "WHEN", "THEN", "ELSE", "END",
  "COUNT", "SUM", "AVG", "MIN", "MAX", "ROUND", "COALESCE", "CONCAT", "NOW",
  "INT", "INTEGER", "BIGINT", "SMALLINT", "TINYINT", "VARCHAR", "CHAR", "TEXT",
  "MEDIUMTEXT", "LONGTEXT", "DECIMAL", "NUMERIC", "FLOAT", "DOUBLE", "DATE",
  "DATETIME", "TIMESTAMP", "TIME", "YEAR", "BOOLEAN", "BOOL",
  "AUTO_INCREMENT", "PRIMARY", "KEY", "FOREIGN", "REFERENCES", "UNIQUE",
  "DEFAULT", "CHECK", "CONSTRAINT", "CASCADE", "RESTRICT", "ENGINE", "INNODB",
  "IF", "CURRENT_TIMESTAMP"
]);

export function formatSql(sql) {
  if (!sql || typeof sql !== "string") return "";
  try {
    return format(sql.trim(), {
      language: "mysql",
      tabWidth: 2,
      keywordCase: "upper",
      linesBetweenQueries: 2,
    });
  } catch (err) {
    console.warn("SQL formatter error, falling back to original:", err);
    return sql;
  }
}

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function highlightSql(sql) {
  if (!sql) return "";

  // Tokenize comments, strings, words/identifiers, and numbers
  const regex = /(--[^\n]*|\/\*[\s\S]*?\*\/|'(?:''|[^'\\]|\\.)*'|"(?:""|[^"\\]|\\.)*"|[a-zA-Z_][a-zA-Z0-9_]*|\d+(?:\.\d+)?|[^\s\w])/g;

  return sql.replace(regex, (token) => {
    if (token.startsWith("--") || token.startsWith("/*")) {
      return `<span style="color: #64748b; font-style: italic;">${escapeHtml(token)}</span>`;
    }
    if (token.startsWith("'") || token.startsWith('"')) {
      return `<span style="color: #059669;">${escapeHtml(token)}</span>`;
    }
    if (SQL_KEYWORDS.has(token.toUpperCase())) {
      return `<span style="color: #0066cc; font-weight: 500;">${escapeHtml(token)}</span>`;
    }
    if (/^\d+(?:\.\d+)?$/.test(token)) {
      return `<span style="color: #09090b;">${escapeHtml(token)}</span>`;
    }
    return escapeHtml(token);
  });
}

export function isDestructiveSql(sql) {
  if (!sql || typeof sql !== "string") return false;
  return /\b(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|REPLACE|GRANT|REVOKE|CREATE)\b/i.test(sql);
}
