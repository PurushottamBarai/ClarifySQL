import { useState } from 'react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import OAuthButtons from '../components/OAuthButtons';
import { useAuth } from '../context/AuthContext';

function getPasswordStrength(value) {
  if (!value) return { score: 0, label: '', level: '' };
  let score = 1;
  if (value.length >= 8) score += 1;
  if (value.length >= 12) score += 1;
  if (/[a-z]/.test(value) && /[A-Z]/.test(value)) score += 1;
  if (/\d/.test(value) && /[^A-Za-z0-9]/.test(value)) score += 1;
  score = Math.min(score, 4);
  const meta = {
    1: { label: 'Weak', level: 'weak' },
    2: { label: 'Fair', level: 'fair' },
    3: { label: 'Good', level: 'good' },
    4: { label: 'Strong', level: 'strong' }
  };
  return { score, ...meta[score] };
}

export default function SignupPage({ onNavigate }) {
  const { signup } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});

  const passwordStrength = getPasswordStrength(password);
  const hasMinLength = password.length >= 8;

  const validateFields = () => {
    const errors = {};
    if (!name.trim()) {
      errors.name = 'Name is required';
    }
    const cleanEmail = email.trim();
    if (!cleanEmail) {
      errors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      errors.email = 'Enter a valid email address';
    }
    if (!password) {
      errors.password = 'Password is required';
    } else if (password.length < 8) {
      errors.password = 'Password must be at least 8 characters long';
    }
    if (!acceptedTerms) {
      errors.terms = 'Please accept the Terms of Service and Privacy Policy to continue';
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
      await signup({ name, email, password, acceptedTerms });
      onNavigate('/app');
    } catch (err) {
      setError(err.message || 'Failed to create account');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page-layout">
      <Navbar currentRoute="/signup" onNavigate={onNavigate} />

      <main className="auth-page-main">
        <div className="auth-split-container">
          {/* Left Column: Product Value & Tagline */}
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
                Create an account to build your private, schema-aware query assistant with automated ambiguity clarification.
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
                <span className="micro-badge">Developer-focused</span>
                <span className="micro-badge">Zero boilerplate</span>
                <span className="micro-badge">Instant clarification</span>
              </div>
            </div>
          </div>

          {/* Right Column: Create Account Form */}
          <div className="auth-right-col">
            <div className="auth-form-card">
              <div className="auth-form-header">
                <h1 className="auth-form-title">Create account</h1>
                <p className="auth-form-subtitle">Get started with your developer workspace.</p>
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
                <div className={`floating-field-group ${name ? 'has-value' : ''}`}>
                  <input
                    id="signup-name"
                    type="text"
                    className="floating-input"
                    placeholder=" "
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      if (fieldErrors.name) setFieldErrors((prev) => ({ ...prev, name: undefined }));
                    }}
                    required
                    autoComplete="name"
                    autoFocus
                    disabled={loading}
                    aria-invalid={!!fieldErrors.name}
                    aria-describedby={fieldErrors.name ? 'signup-name-error' : undefined}
                  />
                  <label className="floating-label" htmlFor="signup-name">
                    Name <span className="req-star">*</span>
                  </label>
                </div>
                {fieldErrors.name && (
                  <p className="field-error" id="signup-name-error" role="alert">
                    {fieldErrors.name}
                  </p>
                )}

                <div className={`floating-field-group ${email ? 'has-value' : ''}`}>
                  <input
                    id="signup-email"
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
                    disabled={loading}
                    aria-invalid={!!fieldErrors.email}
                    aria-describedby={fieldErrors.email ? 'signup-email-error' : undefined}
                  />
                  <label className="floating-label" htmlFor="signup-email">
                    Email <span className="req-star">*</span>
                  </label>
                </div>
                {fieldErrors.email && (
                  <p className="field-error" id="signup-email-error" role="alert">
                    {fieldErrors.email}
                  </p>
                )}

                <div className={`floating-field-group ${password ? 'has-value' : ''}`}>
                  <input
                    id="signup-password"
                    type={showPassword ? 'text' : 'password'}
                    className="floating-input password-input"
                    placeholder=" "
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (fieldErrors.password) setFieldErrors((prev) => ({ ...prev, password: undefined }));
                    }}
                    required
                    minLength={8}
                    autoComplete="new-password"
                    disabled={loading}
                    aria-invalid={!!fieldErrors.password}
                    aria-describedby={fieldErrors.password ? 'signup-password-error' : undefined}
                  />
                  <label className="floating-label" htmlFor="signup-password">
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
                  <p className="field-error" id="signup-password-error" role="alert">
                    {fieldErrors.password}
                  </p>
                )}

                <div className="password-rules-row">
                  <span className={`password-rule ${hasMinLength ? 'met' : ''}`}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      {hasMinLength ? (
                        <polyline points="20 6 9 17 4 12" />
                      ) : (
                        <circle cx="12" cy="12" r="9" />
                      )}
                    </svg>
                    At least 8 characters
                  </span>

                  {password && (
                    <span className="password-strength">
                      <span className="password-strength-bars" aria-hidden="true">
                        {[1, 2, 3, 4].map((step) => (
                          <span
                            key={step}
                            className={`password-strength-bar ${step <= passwordStrength.score ? `active ${passwordStrength.level}` : ''}`}
                          />
                        ))}
                      </span>
                      <span className={`password-strength-label ${passwordStrength.level}`}>
                        {passwordStrength.label}
                      </span>
                    </span>
                  )}
                </div>

                <div className="terms-consent-row">
                  <input
                    id="signup-terms"
                    type="checkbox"
                    className="terms-checkbox"
                    checked={acceptedTerms}
                    onChange={(e) => {
                      setAcceptedTerms(e.target.checked);
                      if (fieldErrors.terms) setFieldErrors((prev) => ({ ...prev, terms: undefined }));
                    }}
                    required
                    disabled={loading}
                    aria-invalid={!!fieldErrors.terms}
                    aria-describedby={fieldErrors.terms ? 'signup-terms-error' : undefined}
                  />
                  <span className="terms-consent-text">
                    <label htmlFor="signup-terms">I agree to the</label>{' '}
                    <button
                      type="button"
                      className="terms-link"
                      onClick={() => onNavigate('/terms')}
                    >
                      Terms of Service
                    </button>{' '}
                    and{' '}
                    <button
                      type="button"
                      className="terms-link"
                      onClick={() => onNavigate('/privacy')}
                    >
                      Privacy Policy
                    </button>
                    .
                  </span>
                </div>
                {fieldErrors.terms && (
                  <p className="field-error" id="signup-terms-error" role="alert">
                    {fieldErrors.terms}
                  </p>
                )}

                <button
                  type="submit"
                  className="auth-submit-btn"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <span className="btn-spinner" aria-hidden="true" />
                      Creating account...
                    </>
                  ) : (
                    'Create account'
                  )}
                </button>
              </form>

              <div className="auth-switch-footer">
                Already have an account?{' '}
                <button
                  type="button"
                  className="switch-link-btn"
                  onClick={() => onNavigate('/login')}
                >
                  Log in
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer onNavigate={onNavigate} currentRoute="/signup" />
    </div>
  );
}

