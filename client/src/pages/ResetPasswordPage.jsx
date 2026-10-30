import { useState } from 'react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { api } from '../api/client';

const MIN_PASSWORD_LENGTH = 8;
const RESET_TOKEN_PATTERN = /^[a-f0-9]{64}$/i;

export default function ResetPasswordPage({ token, onNavigate }) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [success, setSuccess] = useState(false);

  const tokenIsValid = typeof token === 'string' && RESET_TOKEN_PATTERN.test(token);
  const hasMinLength = password.length >= MIN_PASSWORD_LENGTH;

  const validateFields = () => {
    const errors = {};
    if (!password) {
      errors.password = 'Password is required';
    } else if (password.length < MIN_PASSWORD_LENGTH) {
      errors.password = `Password must be at least ${MIN_PASSWORD_LENGTH} characters long`;
    }
    if (!confirmPassword) {
      errors.confirmPassword = 'Please confirm your password';
    } else if (confirmPassword !== password) {
      errors.confirmPassword = 'Passwords do not match';
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
      await api.resetPassword(token, { password });
      setSuccess(true);
    } catch (err) {
      setError(err.message || 'Invalid or expired reset link.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page-layout">
      <Navbar currentRoute="/reset-password" onNavigate={onNavigate} />

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
              <h1 className="auth-form-title">Set a new password</h1>
              <p className="auth-form-subtitle">
                Choose a new password for your account.
              </p>
            </div>

            {error && (
              <div className="auth-error-banner" role="alert" aria-live="assertive">
                {error}
              </div>
            )}

            {!tokenIsValid ? (
              <>
                <div className="auth-error-banner" role="alert">
                  This password reset link is invalid or incomplete.
                </div>
                <button
                  type="button"
                  className="auth-submit-btn"
                  onClick={() => onNavigate('/forgot-password')}
                >
                  Request a new link
                </button>
              </>
            ) : success ? (
              <div className="auth-success" role="status">
                <p className="auth-success-title">Password updated</p>
                <p className="auth-success-text">
                  Your password has been reset. You can now log in with your new password.
                </p>
                <button
                  type="button"
                  className="auth-submit-btn"
                  onClick={() => onNavigate('/login')}
                >
                  Go to log in
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="auth-fields-form" noValidate>
                <div className={`floating-field-group ${password ? 'has-value' : ''}`}>
                  <input
                    id="reset-password"
                    type={showPassword ? 'text' : 'password'}
                    className="floating-input password-input"
                    placeholder=" "
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (fieldErrors.password) setFieldErrors((prev) => ({ ...prev, password: undefined }));
                    }}
                    autoComplete="new-password"
                    autoFocus
                    disabled={loading}
                    aria-invalid={!!fieldErrors.password}
                    aria-describedby={fieldErrors.password ? 'reset-password-error' : undefined}
                  />
                  <label className="floating-label" htmlFor="reset-password">
                    New password <span className="req-star">*</span>
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
                  <p className="field-error" id="reset-password-error" role="alert">
                    {fieldErrors.password}
                  </p>
                )}

                <div className={`floating-field-group ${confirmPassword ? 'has-value' : ''}`}>
                  <input
                    id="reset-confirm-password"
                    type={showPassword ? 'text' : 'password'}
                    className="floating-input"
                    placeholder=" "
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      if (fieldErrors.confirmPassword) setFieldErrors((prev) => ({ ...prev, confirmPassword: undefined }));
                    }}
                    autoComplete="new-password"
                    disabled={loading}
                    aria-invalid={!!fieldErrors.confirmPassword}
                    aria-describedby={fieldErrors.confirmPassword ? 'reset-confirm-password-error' : undefined}
                  />
                  <label className="floating-label" htmlFor="reset-confirm-password">
                    Confirm new password <span className="req-star">*</span>
                  </label>
                </div>
                {fieldErrors.confirmPassword && (
                  <p className="field-error" id="reset-confirm-password-error" role="alert">
                    {fieldErrors.confirmPassword}
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
                    At least {MIN_PASSWORD_LENGTH} characters
                  </span>
                </div>

                <button
                  type="submit"
                  className="auth-submit-btn"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <span className="btn-spinner" aria-hidden="true" />
                      Saving...
                    </>
                  ) : (
                    'Save new password'
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

      <Footer onNavigate={onNavigate} currentRoute="/reset-password" />
    </div>
  );
}
