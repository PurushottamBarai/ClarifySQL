import { useState } from 'react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import OAuthButtons from '../components/OAuthButtons';
import { useAuth } from '../context/AuthContext';

export default function SignupPage({ onNavigate }) {
  const { signup } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError('Please fill in all required fields');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }
    try {
      setLoading(true);
      setError(null);
      await signup({ name, email, password });
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
                Stop losing hours debugging ambiguous questions and SQL syntax.
              </h2>

              <p className="auth-left-subtext">
                Create an account to build your private, schema-aware query assistant with automated ambiguity clarification.
              </p>

              <div className="auth-micro-badges">
                <span>Developer-focused</span>
                <span className="bullet">&bull;</span>
                <span>Zero boilerplate</span>
                <span className="bullet">&bull;</span>
                <span>Instant clarification</span>
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
                <div className="auth-error-banner">
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
                    onChange={(e) => setName(e.target.value)}
                    autoComplete="name"
                  />
                  <label className="floating-label" htmlFor="signup-name">
                    Name <span className="req-star">*</span>
                  </label>
                </div>

                <div className={`floating-field-group ${email ? 'has-value' : ''}`}>
                  <input
                    id="signup-email"
                    type="email"
                    className="floating-input"
                    placeholder=" "
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                  />
                  <label className="floating-label" htmlFor="signup-email">
                    Email <span className="req-star">*</span>
                  </label>
                </div>

                <div className={`floating-field-group ${password ? 'has-value' : ''}`}>
                  <input
                    id="signup-password"
                    type={showPassword ? 'text' : 'password'}
                    className="floating-input password-input"
                    placeholder=" "
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                    autoComplete="new-password"
                  />
                  <label className="floating-label" htmlFor="signup-password">
                    Password <span className="req-star">*</span>
                  </label>
                  <button
                    type="button"
                    className="eye-toggle-btn"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label="Toggle password visibility"
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

                <button
                  type="submit"
                  className="auth-submit-btn"
                  disabled={loading}
                >
                  {loading ? 'Creating account...' : 'Create account'}
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

      <Footer onNavigate={onNavigate} />
    </div>
  );
}

