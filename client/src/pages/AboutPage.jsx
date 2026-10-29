import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { useAuth } from '../context/AuthContext';

export default function AboutPage({ onNavigate }) {
  const { user } = useAuth();

  return (
    <div className="legal-page-layout">
      <Navbar currentRoute="/about" onNavigate={onNavigate} />

      <main className="legal-main">
        <div className="legal-container">
          <div className="legal-header">
            <h1 className="legal-title">About ClarifySQL</h1>
            <p className="legal-subtitle">
              A developer-first clarification engine bridging natural language questions and verified MySQL queries.
            </p>
          </div>

          <div className="legal-sections-stack">
            <section className="legal-card">
              <h2 className="legal-section-title">Our Mission</h2>
              <p className="legal-text">
                Writing accurate database queries from ambiguous human requests is one of engineering&apos;s oldest friction points. Traditional text-to-SQL tools guess user intent, hallucinates column names, or attempt dangerous operations against live data. ClarifySQL was built to eliminate these risks by indexing real schema DDLs, proactively asking clarifying questions whenever business metrics are ambiguous, and strictly enforcing read-only query bounds.
              </p>
            </section>

            <div className="legal-feature-grid">
              <div className="legal-card feature-tile">
                <h3 className="tile-title">Schema-Aware Intelligence</h3>
                <p className="tile-text">
                  Parses real MySQL DDL definitions to validate table relationships and column types before generating queries—preventing hallucinated syntax.
                </p>
              </div>

              <div className="legal-card feature-tile">
                <h3 className="tile-title">Ambiguity Clarification</h3>
                <p className="tile-text">
                  Whenever a question is ambiguous (e.g. &quot;top active customers&quot;), ClarifySQL interactively asks multiple-choice clarifying questions before writing SQL.
                </p>
              </div>

              <div className="legal-card feature-tile">
                <h3 className="tile-title">Strict Read-Only Guardrails</h3>
                <p className="tile-text">
                  Rejects destructive statements (`DROP`, `DELETE`, `UPDATE`, `ALTER`) and enforces execution timeouts and row bounds against connected databases.
                </p>
              </div>

              <div className="legal-card feature-tile">
                <h3 className="tile-title">Developer-First Ergonomics</h3>
                <p className="tile-text">
                  Equipped with a built-in SQL formatter, live syntax highlighting, one-click clipboard copying, and light/dark theme adaptation.
                </p>
              </div>
            </div>

            <section className="legal-card cta-banner-card">
              <div>
                <h3 className="cta-banner-title">Ready to query your database with clarity?</h3>
                <p className="cta-banner-subtitle">Start exploring and testing queries for free in seconds.</p>
              </div>
              <div className="cta-buttons-row">
                <button
                  type="button"
                  onClick={() => onNavigate(user ? '/app' : '/signup')}
                  className="btn-hero-primary"
                  style={{ padding: '0.6rem 1.25rem', fontSize: '0.88rem' }}
                >
                  {user ? 'Open Console' : 'Get Started'}
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate('/contact')}
                  className="btn-hero-secondary"
                  style={{ padding: '0.6rem 1.25rem', fontSize: '0.88rem' }}
                >
                  Contact Us
                </button>
              </div>
            </section>
          </div>
        </div>
      </main>

      <Footer onNavigate={onNavigate} />
    </div>
  );
}

