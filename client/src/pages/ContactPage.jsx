import { useEffect, useRef, useState } from 'react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';

export default function ContactPage({ onNavigate }) {
  const { user } = useAuth();
  const [formData, setFormData] = useState(() => ({
    name: user?.name || '',
    email: user?.email || '',
    message: ''
  }));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const successHeadingRef = useRef(null);

  useEffect(() => {
    if (submitted) {
      successHeadingRef.current?.focus();
    }
  }, [submitted]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.email.trim() || !formData.message.trim()) {
      setError('Please fill in all required fields.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await api.sendContact({
        name: formData.name.trim(),
        email: formData.email.trim(),
        message: formData.message.trim()
      });
      setSubmitted(true);
    } catch (err) {
      setError(
        err.message ||
        'Failed to deliver message through the server. You can also email us directly at support@onshare.me'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="contact-page-layout">
      <Navbar currentRoute="/contact" onNavigate={onNavigate} />

      <main className="contact-main">
        <div className="contact-container">
          {/* Header */}
          <div className="contact-header">
            <h1 className="contact-title">Contact Us</h1>
            <p className="contact-subtitle">
              Have questions or need help with ClarifySQL? Reach out directly or send us a message below.
            </p>
          </div>

          <div className="contact-grid">
            {/* Left Info Card */}
            <div className="contact-info-card">
              <div>
                <h2 className="info-card-title">Get in Touch</h2>
                <p className="info-card-desc">
                  We reply to every message within 1–2 business days.
                </p>

                <div className="info-items-list">
                  <div className="info-item">
                    <span className="info-item-label">EMAIL SUPPORT</span>
                    <a href="mailto:support@onshare.me" className="info-item-link">
                      support@onshare.me
                    </a>
                  </div>

                  <div className="info-item">
                    <span className="info-item-label">RESPONSE TIME</span>
                    <span className="info-item-text">Within 1–2 business days</span>
                  </div>

                  <div className="info-item">
                    <span className="info-item-label">PLATFORM</span>
                    <span className="info-item-text">ClarifySQL Engine</span>
                  </div>
                </div>
              </div>

              <div className="info-card-footer">
                For technical bug reports, please include your SQL schema definition or query context in your message.
              </div>
            </div>

            {/* Right Contact Form Card */}
            <div className="contact-form-card">
              {submitted ? (
                <div className="contact-success-state" role="status">
                  <div className="success-icon-badge">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                  <h3 className="success-heading" ref={successHeadingRef} tabIndex={-1}>Message sent</h3>
                  <p className="success-subtext">
                    Thank you, <strong className="text-highlight">{formData.name}</strong>. Your message has been sent to our team. We will review it and get back to you at <strong className="text-highlight">{formData.email}</strong> shortly.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setSubmitted(false);
                      setFormData({
                        name: user?.name || '',
                        email: user?.email || '',
                        message: ''
                      });
                    }}
                    className="btn-hero-secondary"
                    style={{ marginTop: '1.25rem', padding: '0.5rem 1.25rem', fontSize: '0.85rem' }}
                  >
                    Send another message
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="contact-form">
                  {error && (
                    <div id="contact-error" className="auth-error-banner" role="alert" style={{ marginBottom: '1.25rem' }}>
                      {error}
                    </div>
                  )}

                  {/* Name field with floating label */}
                  <div className={`floating-field-group ${formData.name ? 'has-value' : ''}`}>
                    <input
                      id="contact-name"
                      type="text"
                      className="floating-input"
                      placeholder=" "
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                      autoComplete="name"
                      aria-invalid={error && !formData.name.trim() ? 'true' : undefined}
                      aria-describedby={error ? 'contact-error' : undefined}
                    />
                    <label className="floating-label" htmlFor="contact-name">
                      Name <span className="req-star">*</span>
                    </label>
                  </div>

                  {/* Email field with floating label */}
                  <div className={`floating-field-group ${formData.email ? 'has-value' : ''}`}>
                    <input
                      id="contact-email"
                      type="email"
                      className="floating-input"
                      placeholder=" "
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      required
                      autoComplete="email"
                      aria-invalid={error && !formData.email.trim() ? 'true' : undefined}
                      aria-describedby={error ? 'contact-error' : undefined}
                    />
                    <label className="floating-label" htmlFor="contact-email">
                      Email <span className="req-star">*</span>
                    </label>
                  </div>

                  {/* Message field with floating label */}
                  <div className={`floating-field-group ${formData.message ? 'has-value' : ''}`}>
                    <textarea
                      id="contact-message"
                      rows={5}
                      className="floating-input floating-textarea"
                      placeholder=" "
                      value={formData.message}
                      onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                      required
                      aria-invalid={error && !formData.message.trim() ? 'true' : undefined}
                      aria-describedby={error ? 'contact-error' : undefined}
                    />
                    <label className="floating-label" htmlFor="contact-message">
                      Message <span className="req-star">*</span>
                    </label>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    aria-busy={loading}
                    className="auth-submit-btn"
                    style={{ width: '100%', marginTop: '0.5rem' }}
                  >
                    {loading ? 'Sending message...' : 'Send Message'}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </main>

      <Footer onNavigate={onNavigate} />
    </div>
  );
}

