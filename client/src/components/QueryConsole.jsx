import { useState } from "react";

export default function QueryConsole({
  onAsk,
  clarification,
  onAnswerClarification,
  loading,
  schemaReady,
}) {
  const [question, setQuestion] = useState("");
  const [customAnswer, setCustomAnswer] = useState("");

  const sampleQuestions = [
    "Count total rows in each table",
    "Find highest order total and corresponding user",
    "Show me the best users",
    "List all users registered this year",
  ];

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!question.trim()) return;
    onAsk(question);
  };

  const handleSelectSample = (sample) => {
    setQuestion(sample);
    onAsk(sample);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <div className="prompt-card">
        <div className="prompt-header">Ask Natural-Language Question</div>
        <form onSubmit={handleSubmit}>
          <div className="prompt-input-row">
            <textarea
              className="prompt-textarea"
              placeholder={
                schemaReady
                  ? "Ask a question in plain English (e.g., 'What are the top 5 largest orders?')"
                  : "Connect your database or upload a schema .sql file..."
              }
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              disabled={!schemaReady || loading}
              rows={2}
            />
            <button
              type="submit"
              className="btn-primary"
              style={{
                alignSelf: "flex-end",
                height: "42px",
                minWidth: "90px",
              }}
              disabled={!schemaReady || !question.trim() || loading}
            >
              {loading ? "Thinking..." : "Clarify & Ask"}
            </button>
          </div>
        </form>

        {schemaReady && (
          <div className="sample-pills">
            <span
              style={{
                fontSize: "0.75rem",
                color: "#94a3b8",
                alignSelf: "center",
              }}
            >
              Examples:
            </span>
            {sampleQuestions.map((sample, idx) => (
              <button
                key={idx}
                type="button"
                className="sample-pill"
                onClick={() => handleSelectSample(sample)}
                disabled={loading}
              >
                {sample}
              </button>
            ))}
          </div>
        )}
      </div>

      {clarification && (
        <div className="clarification-box">
          <div className="clarification-title">
            <svg
              width="18"
              height="18"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            Ambiguity Detected — Clarification Needed
          </div>

          <div className="clarification-prompt">
            {clarification.clarificationPrompt}
          </div>

          {clarification.options && clarification.options.length > 0 && (
            <div className="clarification-options">
              {clarification.options.map((opt, i) => (
                <button
                  key={i}
                  type="button"
                  className="option-btn"
                  onClick={() => onAnswerClarification(opt)}
                  disabled={loading}
                >
                  {opt}
                </button>
              ))}
            </div>
          )}

          <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
            <input
              className="form-input"
              style={{ flex: 1 }}
              placeholder="Or type custom clarification answer..."
              value={customAnswer}
              onChange={(e) => setCustomAnswer(e.target.value)}
              disabled={loading}
              onKeyDown={(e) => {
                if (e.key === "Enter" && customAnswer.trim()) {
                  onAnswerClarification(customAnswer);
                  setCustomAnswer("");
                }
              }}
            />
            <button
              type="button"
              className="btn-primary"
              disabled={!customAnswer.trim() || loading}
              onClick={() => {
                onAnswerClarification(customAnswer);
                setCustomAnswer("");
              }}
            >
              Submit
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
