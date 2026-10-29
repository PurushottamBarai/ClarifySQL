import { useState } from 'react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { useAuth } from '../context/AuthContext';

export default function LandingPage({ onNavigate }) {
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);

  const sampleSql = `SELECT c.segment, SUM(o.total_amount) AS revenue
FROM customers c
JOIN orders o ON c.id = o.customer_id
WHERE o.status = 'completed'
GROUP BY c.segment
ORDER BY revenue DESC
LIMIT 10;`;

  const handleCopy = () => {
    navigator.clipboard.writeText(sampleSql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const sqlLines = sampleSql.split('\n');

  return (
    <div className="landing-layout">
      <Navbar currentRoute="/" onNavigate={onNavigate} />

      <main className="landing-main">
        <div className="landing-hero-grid">
          {/* Left Column: Hero Text & CTAs */}
          <div className="hero-left">
            <div className="hero-badge">
              <span className="badge-dot"></span>
              <span className="badge-text">ClarifySQL Engine v1.0</span>
            </div>

            <h1 className="hero-title">
              Natural-language SQL, clarified and guarded.
            </h1>

            <p className="hero-subtext">
              Evaluate queries against your real MySQL schema. ClarifySQL catches business ambiguity, asks targeted clarifying questions, and safely executes read-only queries with strict bounds.
            </p>

            <div className="hero-cta-group">
              <button
                type="button"
                className="btn-hero-primary"
                onClick={() => onNavigate(user ? '/app' : '/signup')}
              >
                {user ? 'Open Console' : 'Start exploring'}
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14" />
                  <path d="M12 5l7 7-7 7" />
                </svg>
              </button>

              {!user && (
                <button
                  type="button"
                  className="btn-hero-secondary"
                  onClick={() => onNavigate('/login')}
                >
                  Sign in
                </button>
              )}
            </div>

            <div className="hero-features-row">
              <div className="feature-col">
                <span className="feature-label">SCHEMA AWARE</span>
                <span className="feature-value">Strict DDL index</span>
              </div>
              <div className="feature-col">
                <span className="feature-label">CLARIFICATION</span>
                <span className="feature-value">Automated AI</span>
              </div>
              <div className="feature-col">
                <span className="feature-label">GUARDRAILS</span>
                <span className="feature-value">Read-only bounds</span>
              </div>
            </div>
          </div>

          {/* Right Column: Interactive Code Card Mockup */}
          <div className="hero-right">
            <div className="preview-card">
              <div className="preview-card-header">
                <div>
                  <div className="preview-card-title">
                    Monthly revenue by top customer segments
                  </div>
                  <div className="preview-card-meta">
                    MySQL 8.0 &bull; Ready to execute
                  </div>
                </div>
                <span className="badge-autotag">AUTO-CLARIFIED</span>
              </div>

              {/* AI Summary Box */}
              <div className="preview-summary-box">
                <div className="summary-box-label">AI INTERPRETATION</div>
                <div className="summary-box-text">
                  Calculates total completed revenue grouped by customer tier with automated foreign key resolution.
                </div>
              </div>

              {/* Code Snippet Box */}
              <div className="preview-code-box">
                <div className="code-box-header">
                  <div className="code-file-tag">
                    <span className="code-dot"></span>
                    <span>monthly_revenue.sql</span>
                  </div>
                  <button
                    type="button"
                    className="code-copy-btn"
                    onClick={handleCopy}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                    <span>{copied ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>

                <div className="code-box-body">
                  <div className="code-gutter">
                    {sqlLines.map((_, i) => (
                      <div key={i} className="line-num">{i + 1}</div>
                    ))}
                  </div>
                  <pre className="code-content">
                    <code>
                      <span className="token-keyword">SELECT</span> c.segment, <span className="token-fn">SUM</span>(o.total_amount) <span className="token-keyword">AS</span> revenue{'\n'}
                      <span className="token-keyword">FROM</span> customers c{'\n'}
                      <span className="token-keyword">JOIN</span> orders o <span className="token-keyword">ON</span> c.id = o.customer_id{'\n'}
                      <span className="token-keyword">WHERE</span> o.status = <span className="token-string">'completed'</span>{'\n'}
                      <span className="token-keyword">GROUP BY</span> c.segment{'\n'}
                      <span className="token-keyword">ORDER BY</span> revenue <span className="token-keyword">DESC</span>{'\n'}
                      <span className="token-keyword">LIMIT</span> <span className="token-num">10</span>;
                    </code>
                  </pre>
                </div>
              </div>

              {/* Tag Pills */}
              <div className="preview-tags">
                <span className="tag-pill">#mysql</span>
                <span className="tag-pill">#analytics</span>
                <span className="tag-pill">#aggregations</span>
                <span className="tag-pill">#read-only</span>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer onNavigate={onNavigate} />
    </div>
  );
}

