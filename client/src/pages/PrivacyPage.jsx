import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

export default function PrivacyPage({ onNavigate }) {
  return (
    <div className="legal-page-layout">
      <Navbar currentRoute="/privacy" onNavigate={onNavigate} />

      <main className="legal-main">
        <div className="legal-container">
          <div className="legal-header">
            <h1 className="legal-title">Privacy Policy</h1>
            <p className="legal-subtitle">
              Last updated: October 2026
            </p>
          </div>

          <div className="legal-card legal-document-body">
            <section className="doc-section">
              <h2 className="doc-heading">1. Overview</h2>
              <p className="legal-text">
                ClarifySQL (&quot;we&quot;, &quot;our&quot;, or &quot;us&quot;) respects your privacy and is committed to protecting the information you share with us. This Privacy Policy details how we handle, process, and safeguard your data when using ClarifySQL.
              </p>
            </section>

            <section className="doc-section">
              <h2 className="doc-heading">2. Information We Collect</h2>
              <ul className="doc-list">
                <li>
                  <strong className="text-highlight">Account Information:</strong> When signing up, we collect your name and email address. If using Google or GitHub OAuth, we receive your verified email, public name, and avatar.
                </li>
                <li>
                  <strong className="text-highlight">Database Schemas &amp; Queries:</strong> Uploaded SQL DDL statements and natural-language query prompts submitted to generate SQL queries.
                </li>
                <li>
                  <strong className="text-highlight">Connection Credentials:</strong> If you connect a live MySQL instance, database connection details are stored in your session state and are never transferred to third parties or used outside query execution.
                </li>
                <li>
                  <strong className="text-highlight">Technical Logs:</strong> Basic server logs such as IP address and response metrics to detect errors and enforce rate limits.
                </li>
              </ul>
            </section>

            <section className="doc-section">
              <h2 className="doc-heading">3. How We Use Your Information</h2>
              <p className="legal-text" style={{ marginBottom: '0.75rem' }}>We use collected information solely to:</p>
              <ul className="doc-list">
                <li>Provide, authenticate, and maintain your access to the ClarifySQL workspace.</li>
                <li>Parse and validate table structures against your uploaded schema.</li>
                <li>Generate guarded, schema-bounded SQL queries via AI inference.</li>
                <li>Detect and block abusive or destructive SQL operations.</li>
              </ul>
            </section>

            <section className="doc-section">
              <h2 className="doc-heading">4. Third-Party Integrations</h2>
              <ul className="doc-list">
                <li>
                  <strong className="text-highlight">OAuth Providers (Google &amp; GitHub):</strong> Used strictly for secure single sign-on without storing passwords.
                </li>
                <li>
                  <strong className="text-highlight">AI Inference:</strong> Query requests and table metadata are transmitted to inference providers exclusively for natural-language interpretation and query drafting.
                </li>
                <li>
                  <strong className="text-highlight">Email Delivery (Resend):</strong> Used solely to transmit user contact inquiries to support.
                </li>
              </ul>
            </section>

            <section className="doc-section">
              <h2 className="doc-heading">5. Data Retention &amp; Security</h2>
              <p className="legal-text">
                You can reset your active session, schemas, and queries at any time using the Reset option in the console. You may also request complete removal of your account by contacting support.
              </p>
            </section>

            <section className="doc-section">
              <h2 className="doc-heading">6. Contact Support</h2>
              <p className="legal-text">
                For questions regarding this policy or your data, please contact us at{' '}
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

