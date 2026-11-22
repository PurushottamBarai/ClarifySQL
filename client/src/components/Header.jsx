import { useAuth } from '../context/AuthContext';
import BrandLogo from './BrandLogo';

export default function Header({ dbStatus, onOpenDbModal, onReset, onNavigate }) {
  const { user } = useAuth();

  const toggleTheme = () => {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    if (isDark) {
      document.documentElement.removeAttribute('data-theme');
      localStorage.setItem('clarify_theme', 'light');
    } else {
      document.documentElement.setAttribute('data-theme', 'dark');
      localStorage.setItem('clarify_theme', 'dark');
    }
  };

  return (
    <header className="header site-navbar">
      <div className="header-brand" onClick={() => onNavigate && onNavigate('/')} style={{ cursor: 'pointer' }} title="ClarifySQL">
        <BrandLogo className="nav-brand-logo" />
      </div>

      <div className="header-status">
        <button
          type="button"
          className={`status-badge ${dbStatus?.connected ? 'connected' : 'disconnected'}`}
          onClick={onOpenDbModal}
          title="Click to configure MySQL connection"
        >
          <span className="dot-indicator"></span>
          {dbStatus?.connected ? `Connected: ${dbStatus.database}` : 'Connect Database'}
        </button>

        <button
          type="button"
          className="btn-secondary"
          onClick={onReset}
          title="Reset session and start over"
        >
          Reset
        </button>

        <button
          type="button"
          className="theme-toggle-btn"
          onClick={toggleTheme}
          aria-label="Toggle theme"
          title="Toggle theme"
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
          </svg>
        </button>

        {onNavigate && (
          <button
            type="button"
            className="nav-link-btn"
            onClick={() => onNavigate('/')}
            title="Return to Home"
          >
            Home
          </button>
        )}
      </div>
    </header>
  );
}
