import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

export default function TermsPage({ onNavigate }) {
  return (
    <div className="legal-page-layout">
      <Navbar currentRoute="/terms" onNavigate={onNavigate} />

      <main className="legal-main">
        <div className="legal-container">
          <div className="legal-header">
            <h1 className="legal-title">Terms and Conditions</h1>
            <p className="legal-subtitle">
              Last updated: October 2026
            </p>
          </div>

          <div className="legal-card legal-document-body">
            <section className="doc-section">
              <h2 className="doc-heading">1. Acceptance of Terms</h2>
              <p className="legal-text">
                By accessing, browsing, or using ClarifySQL, you agree to comply with and be bound by these Terms of Service. If you disagree with any portion of these terms, you should cease use of the service.
              </p>
            </section>

            <section className="doc-section">
              <h2 className="doc-heading">2. User Accounts &amp; Authentication</h2>
              <p className="legal-text">
                You are responsible for maintaining the security of your authentication credentials (including OAuth logins and local passwords). You agree to notify us immediately of any suspected unauthorized access.
              </p>
            </section>

            <section className="doc-section">
              <h2 className="doc-heading">3. Query Ownership &amp; Database Content</h2>
              <p className="legal-text">
                You retain 100% full ownership, rights, and intellectual property over any schema definitions, queries, and analytical outputs generated with ClarifySQL. ClarifySQL claims no ownership over your database structures or data.
              </p>
            </section>

            <section className="doc-section">
              <h2 className="doc-heading">4. Acceptable Use Policy</h2>
              <p className="legal-text" style={{ marginBottom: '0.75rem' }}>You agree not to use ClarifySQL to:</p>
              <ul className="doc-list">
                <li>Attempt to bypass read-only query guardrails or execute unauthorized destructive SQL against third-party systems.</li>
                <li>Submit queries designed to exploit or extract confidential infrastructure data.</li>
                <li>Circumvent system rate limits or overload AI inference pipelines.</li>
                <li>Store, distribute, or query illegal or malicious payloads.</li>
              </ul>
            </section>

            <section className="doc-section">
              <h2 className="doc-heading">5. Disclaimer of Warranties</h2>
              <p className="legal-text">
                ClarifySQL is provided on an &quot;AS IS&quot; and &quot;AS AVAILABLE&quot; basis without warranties of any kind. While ClarifySQL enforces strict read-only execution bounds and AST safety checks, users remain responsible for validating queries before running them in production environments.
              </p>
            </section>

            <section className="doc-section">
              <h2 className="doc-heading">6. Limitation of Liability</h2>
              <p className="legal-text">
                To the maximum extent permitted by law, ClarifySQL and its developers shall not be liable for any direct, indirect, incidental, or consequential damages resulting from database operations or queries drafted using the platform.
              </p>
            </section>

            <section className="doc-section">
              <h2 className="doc-heading">7. Contact Information</h2>
              <p className="legal-text">
                For questions regarding these Terms, please reach out to us at{' '}
                <a href="mailto:support@onshare.me" className="info-item-link">
                  support@onshare.me
                </a>.
              </p>
            </section>
          </div>
        </div>
      </main>

      <Footer onNavigate={onNavigate} />
    </div>
  );
}

