import { useState } from 'react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import OAuthButtons from '../components/OAuthButtons';
import { useAuth } from '../context/AuthContext';

export default function LoginPage({ onNavigate }) {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});

  const validateFields = () => {
    const errors = {};
    const cleanEmail = email.trim();
    if (!cleanEmail) {
      errors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      errors.email = 'Enter a valid email address';
    }
    if (!password) {
      errors.password = 'Password is required';
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!validateFields()) {
      return;
    }
    try {
      setLoading(true);
      await login({ email, password });
      onNavigate('/app');
    } catch (err) {
      setError(err.message || 'Failed to log in');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page-layout">
      <Navbar currentRoute="/login" onNavigate={onNavigate} />

      <main className="auth-page-main">
        <div className="auth-split-container">
          {/* Left Column: Product Value & Snippet Preview */}
          <div className="auth-left-col">
            <div className="auth-left-content">
              <div className="auth-brand-pill">
                <span className="brand-code-sym">&lt;/&gt;</span>
                <span className="brand-pill-text">ClarifySQL</span>
              </div>

              <h2 className="auth-left-heading">
                Your database, queried with clarity.
              </h2>

              <p className="auth-left-subtext">
                Ask questions in plain English. ClarifySQL catches business ambiguities, verifies table schemas, and drafts safe read-only SQL automatically.
              </p>

              {/* Code Snippet Card */}
              <div className="auth-snippet-card">
                <div className="snippet-code-text">
                  <span className="code-comment">// Automatically validated &amp; bounded</span>
                  {'\n'}
                  <span className="token-keyword">const</span> query = <span className="token-keyword">await</span> clarify.query(<span className="token-string">'top 5 customers'</span>);
                  {'\n'}
                  <span className="code-comment">// Returns verified read-only SELECT statement</span>
                </div>
              </div>

              <div className="auth-micro-badges">
                <span className="micro-badge">AES-256 encrypted cookies</span>
                <span className="micro-badge">Strict read-only bounds</span>
                <span className="micro-badge">Zero schema modification</span>
              </div>
            </div>
          </div>

          {/* Right Column: Log in Form */}
          <div className="auth-right-col">
            <div className="auth-form-card">
              <div className="auth-form-header">
                <h1 className="auth-form-title">Log in</h1>
                <p className="auth-form-subtitle">Welcome back. Enter your details.</p>
              </div>

              {/* OAuth Buttons */}
              <OAuthButtons />

              <div className="auth-divider">
                <span className="divider-line"></span>
                <span className="divider-text">OR</span>
                <span className="divider-line"></span>
              </div>

              {error && (
                <div className="auth-error-banner" role="alert" aria-live="assertive">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="auth-fields-form">
                <div className={`floating-field-group ${email ? 'has-value' : ''}`}>
                  <input
                    id="login-email"
                    type="email"
                    className="floating-input"
                    placeholder=" "
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (fieldErrors.email) setFieldErrors((prev) => ({ ...prev, email: undefined }));
                    }}
                    required
                    autoComplete="email"
                    autoFocus
                    disabled={loading}
                    aria-invalid={!!fieldErrors.email}
                    aria-describedby={fieldErrors.email ? 'login-email-error' : undefined}
                  />
                  <label className="floating-label" htmlFor="login-email">
                    Email <span className="req-star">*</span>
                  </label>
                </div>
                {fieldErrors.email && (
                  <p className="field-error" id="login-email-error" role="alert">
                    {fieldErrors.email}
                  </p>
                )}

                <div className={`floating-field-group ${password ? 'has-value' : ''}`}>
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    className="floating-input password-input"
                    placeholder=" "
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (fieldErrors.password) setFieldErrors((prev) => ({ ...prev, password: undefined }));
                    }}
                    required
                    autoComplete="current-password"
                    disabled={loading}
                    aria-invalid={!!fieldErrors.password}
                    aria-describedby={fieldErrors.password ? 'login-password-error' : undefined}
                  />
                  <label className="floating-label" htmlFor="login-password">
                    Password <span className="req-star">*</span>
                  </label>
                  <button
                    type="button"
                    className="eye-toggle-btn"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label="Toggle password visibility"
                    aria-pressed={showPassword}
                    disabled={loading}
                  >
                    {showPassword ? (
                      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </svg>
                    ) : (
                      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>
                {fieldErrors.password && (
                  <p className="field-error" id="login-password-error" role="alert">
                    {fieldErrors.password}
                  </p>
                )}

                <div className="field-helper-row">
                  <a
                    href="/forgot-password"
                    className="field-link"
                    onClick={(e) => {
                      e.preventDefault();
                      onNavigate('/forgot-password');
                    }}
                  >
                    Forgot password?
                  </a>
                </div>

                <button
                  type="submit"
                  className="auth-submit-btn"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <span className="btn-spinner" aria-hidden="true" />
                      Logging in...
                    </>
                  ) : (
                    'Log in'
                  )}
                </button>
              </form>

              <div className="auth-switch-footer">
                Don't have an account?{' '}
                <button
                  type="button"
                  className="switch-link-btn"
                  onClick={() => onNavigate('/signup')}
                >
                  Sign up
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer onNavigate={onNavigate} currentRoute="/login" />
    </div>
  );
}

