import { useState } from 'react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { api } from '../api/client';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ForgotPasswordPage({ onNavigate }) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState(null);
  const [fieldError, setFieldError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const cleanEmail = email.trim();

    if (!cleanEmail) {
      setFieldError('Email is required');
      return;
    }
    if (!EMAIL_PATTERN.test(cleanEmail)) {
      setFieldError('Enter a valid email address');
      return;
    }

    setFieldError(null);
    setError(null);

    try {
      setLoading(true);
      await api.forgotPassword({ email: cleanEmail });
      setSubmitted(true);
    } catch (err) {
      setError(err.message || 'Failed to send reset link. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page-layout">
      <Navbar currentRoute="/forgot-password" onNavigate={onNavigate} />

      <main className="auth-page-main">
        <div className="auth-single-container">
          <div className="auth-form-card">
            <a
              href="/login"
              className="auth-back-link"
              onClick={(e) => {
                e.preventDefault();
                onNavigate('/login');
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M19 12H5" />
                <path d="M12 19l-7-7 7-7" />
              </svg>
              Back to log in
            </a>

            <div className="auth-form-header">
              <h1 className="auth-form-title">Forgot password?</h1>
              <p className="auth-form-subtitle">
                Enter your email and we will send you a link to reset your password.
              </p>
            </div>

            {error && (
              <div className="auth-error-banner" role="alert" aria-live="assertive">
                {error}
              </div>
            )}

            {submitted ? (
              <div className="auth-success" role="status">
                <p className="auth-success-title">Check your email</p>
                <p className="auth-success-text">
                  If an account exists for <strong>{email.trim()}</strong>, a password reset link has been sent.
                </p>
                <button
                  type="button"
                  className="auth-submit-btn"
                  onClick={() => onNavigate('/login')}
                >
                  Back to log in
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="auth-fields-form" noValidate>
                <div className={`floating-field-group ${email ? 'has-value' : ''}`}>
                  <input
                    id="forgot-email"
                    type="email"
                    className="floating-input"
                    placeholder=" "
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (fieldError) setFieldError(null);
                    }}
                    autoComplete="email"
                    autoFocus
                    disabled={loading}
                    aria-invalid={!!fieldError}
                    aria-describedby={fieldError ? 'forgot-email-error' : undefined}
                  />
                  <label className="floating-label" htmlFor="forgot-email">
                    Email <span className="req-star">*</span>
                  </label>
                </div>
                {fieldError && (
                  <p className="field-error" id="forgot-email-error" role="alert">
                    {fieldError}
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
                      Sending...
                    </>
                  ) : (
                    'Send reset link'
                  )}
                </button>
              </form>
            )}

            <div className="auth-switch-footer">
              Remembered it?{' '}
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
      </main>

      <Footer onNavigate={onNavigate} currentRoute="/forgot-password" />
    </div>
  );
}
