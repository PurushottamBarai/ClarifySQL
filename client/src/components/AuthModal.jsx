import OAuthButtons from './OAuthButtons';

export default function AuthModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.45)',
        backdropFilter: 'blur(3px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
        padding: '1rem',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#ffffff',
          borderRadius: 'var(--radius-md)',
          boxShadow: 'var(--shadow-lg)',
          width: '100%',
          maxWidth: '380px',
          border: '1px solid var(--border-light)',
          overflow: 'hidden',
          animation: 'fadeIn 0.15s ease-out',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            padding: '1.25rem 1.25rem 1rem 1.25rem',
            borderBottom: '1px solid var(--border-light)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <img src="/logo.png" alt="ClarifySQL" style={{ height: '24px', width: 'auto' }} />
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-dim)',
              fontSize: '1.2rem',
              cursor: 'pointer',
              lineHeight: 1,
              padding: '0.2rem',
            }}
          >
            ×
          </button>
        </div>

        <div style={{ padding: '1.5rem 1.25rem', textAlign: 'center' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '0.35rem' }}>
            Welcome to ClarifySQL
          </h2>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '1.5rem', lineHeight: 1.5 }}>
            Sign in with your developer account to authenticate your session.
          </p>

          <OAuthButtons />

          <p style={{ fontSize: '0.74rem', color: 'var(--text-dim)', marginTop: '1.25rem' }}>
            By continuing, you agree to secure read-only SQL querying terms.
          </p>
        </div>
      </div>
    </div>
  );
}
