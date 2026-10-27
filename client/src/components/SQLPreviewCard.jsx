import { useState, useRef } from "react";
import { formatSql, highlightSql, isDestructiveSql } from "../utils/sqlFormatter";

export default function SQLPreviewCard({
  queryResult,
  onExecute,
  executing,
  dbConnected,
}) {
  const [copied, setCopied] = useState(false);
  const [prevSqlDraft, setPrevSqlDraft] = useState(null);
  const [editedSql, setEditedSql] = useState("");
  const textareaRef = useRef(null);
  const preRef = useRef(null);
  const gutterRef = useRef(null);

  if (queryResult?.sqlDraft !== prevSqlDraft) {
    setPrevSqlDraft(queryResult?.sqlDraft || null);
    setEditedSql(queryResult?.sqlDraft ? formatSql(queryResult.sqlDraft) : "");
  }

  if (!queryResult || queryResult.status !== "clear" || !queryResult.sqlDraft) {
    return null;
  }

  const { interpretation, warning } = queryResult;
  const isDestructive = isDestructiveSql(editedSql);
  const lines = (editedSql || "").split("\n");

  const handleCopy = () => {
    navigator.clipboard.writeText(editedSql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleFormat = () => {
    setEditedSql(formatSql(editedSql));
  };

  const handleScroll = (e) => {
    if (preRef.current) {
      preRef.current.scrollTop = e.target.scrollTop;
      preRef.current.scrollLeft = e.target.scrollLeft;
    }
    if (gutterRef.current) {
      gutterRef.current.scrollTop = e.target.scrollTop;
    }
  };

  const handleGutterWheel = (e) => {
    if (textareaRef.current) {
      textareaRef.current.scrollTop += e.deltaY;
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Tab") {
      e.preventDefault();
      const start = e.target.selectionStart;
      const end = e.target.selectionEnd;
      const val = e.target.value;
      const updated = val.substring(0, start) + "  " + val.substring(end);
      setEditedSql(updated);
      requestAnimationFrame(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart = textareaRef.current.selectionEnd = start + 2;
        }
      });
    } else if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      if (dbConnected && !isDestructive && !executing) {
        onExecute(editedSql);
      }
    }
  };

  return (
    <div className="sql-card">
      <div className="sql-card-header">
        <div style={{ fontSize: "0.82rem", color: "#3f3f46", lineHeight: 1.4 }}>
          <strong style={{ color: "#09090b", fontWeight: 600 }}>Interpretation: </strong>
          {interpretation || "Generated SQL query"}
        </div>
        <div style={{ display: "flex", gap: "0.45rem", alignItems: "center", flexShrink: 0 }}>
          {isDestructive && (
            <span
              style={{
                background: "#fef2f2",
                color: "#dc2626",
                fontSize: "0.72rem",
                fontWeight: 600,
                padding: "0.15rem 0.45rem",
                borderRadius: "4px",
                border: "1px solid #fee2e2",
              }}
            >
              Destructive Query
            </span>
          )}
          <button
            className="btn-secondary"
            style={{ fontSize: "0.75rem", padding: "0.2rem 0.5rem" }}
            onClick={handleFormat}
            title="Auto-format SQL indentation and keywords"
          >
            Format
          </button>
          <button
            className="btn-secondary"
            style={{ fontSize: "0.75rem", padding: "0.2rem 0.5rem" }}
            onClick={handleCopy}
            title="Copy current SQL to clipboard"
          >
            {copied ? "✓ Copied" : "Copy SQL"}
          </button>
          <button
            className="btn-primary"
            style={{ fontSize: "0.75rem", padding: "0.2rem 0.65rem" }}
            onClick={() => onExecute(editedSql)}
            disabled={!dbConnected || isDestructive || executing}
            title={
              !dbConnected
                ? "Connect a database to run"
                : isDestructive
                ? "Destructive queries cannot be executed automatically"
                : "Execute query (Ctrl+Enter)"
            }
          >
            {executing ? "Running..." : "▶ Run"}
          </button>
        </div>
      </div>

      {isDestructive && (
        <div className="warning-banner">
          <svg
            width="18"
            height="18"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            style={{ flexShrink: 0 }}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <div>
            <strong>Warning:</strong>{" "}
            {warning ||
              "This query alters or deletes data/schema. ClarifySQL will not execute it on your database."}
          </div>
        </div>
      )}

      <div className="sql-editor-container">
        <div ref={gutterRef} className="sql-editor-gutter" onWheel={handleGutterWheel}>
          {lines.map((_, i) => (
            <div key={i}>{i + 1}</div>
          ))}
          <div style={{ height: "2rem" }} />
        </div>

        <div className="sql-editor-wrapper">
          <textarea
            ref={textareaRef}
            className="sql-editor-textarea"
            value={editedSql}
            onChange={(e) => setEditedSql(e.target.value)}
            onScroll={handleScroll}
            onKeyDown={handleKeyDown}
            spellCheck={false}
          />
          <pre ref={preRef} className="sql-editor-highlight" aria-hidden="true">
            <code dangerouslySetInnerHTML={{ __html: highlightSql(editedSql) + "\n" }} />
          </pre>
        </div>
      </div>
    </div>
  );
}
