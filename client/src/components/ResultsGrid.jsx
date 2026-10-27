export default function ResultsGrid({ results, error }) {
  if (error) {
    return (
      <div className="results-card" style={{ borderColor: "#fecaca" }}>
        <div className="results-header" style={{ background: "#fef2f2", borderBottomColor: "#fee2e2" }}>
          <span style={{ fontWeight: 600, fontSize: "0.82rem", color: "#dc2626" }}>Result</span>
        </div>
        <div style={{ padding: "1.25rem 1.5rem", display: "flex", flexDirection: "column", gap: "0.4rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "#dc2626", fontWeight: 600, fontSize: "0.95rem" }}>
            <span style={{ border: "1.5px solid #dc2626", borderRadius: "50%", width: "18px", height: "18px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.7rem" }}>✕</span>
            Query Failed.
          </div>
          <div style={{ color: "#52525b", fontSize: "0.82rem", lineHeight: 1.6, maxWidth: "720px" }}>
            {error}
          </div>
        </div>
      </div>
    );
  }

  if (!results) return null;

  const { columns = [], rows = [], rowCount = 0 } = results;

  return (
    <div className="results-card">
      <div className="results-header">
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <span style={{ fontWeight: 600, fontSize: "0.82rem", color: "#09090b", borderBottom: "2px solid #09090b", paddingBottom: "0.55rem", marginBottom: "-0.65rem" }}>
            Result
          </span>
        </div>
        <span style={{ fontSize: "0.74rem", color: "#71717a", background: "#ffffff", padding: "0.15rem 0.5rem", borderRadius: "4px", border: "1px solid var(--border-light)" }}>
          {rowCount} {rowCount === 1 ? "row" : "rows"} returned
        </span>
      </div>

      {rows.length === 0 ? (
        <div style={{ padding: "2rem", textAlign: "center", color: "#a1a1aa", fontSize: "0.84rem" }}>
          Query executed successfully. 0 rows returned.
        </div>
      ) : (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: "36px", textAlign: "center", color: "#a1a1aa" }}>#</th>
                {columns.map((col, idx) => (
                  <th key={idx}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIdx) => (
                <tr key={rowIdx}>
                  <td style={{ textAlign: "center", color: "#a1a1aa", background: "#fafafa" }}>{rowIdx + 1}</td>
                  {columns.map((col, colIdx) => (
                    <td key={colIdx}>
                      {row[col] !== null && row[col] !== undefined ? String(row[col]) : <em style={{ color: "#d4d4d8" }}>NULL</em>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
