import { useAuth } from '../context/AuthContext';
import BrandLogo from './BrandLogo';

const AUTH_ROUTES = ['/login', '/signup', '/forgot-password', '/reset-password'];

export default function Navbar({
  currentRoute,
  onNavigate,
  dbStatus,
  onOpenDbModal,
  onReset,
}) {
  const { user } = useAuth();
  const isApp = currentRoute === '/app';
  const isAuthPage = AUTH_ROUTES.includes(currentRoute);

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
    <nav className="site-navbar">
      <div className="nav-container">
        <div className="nav-brand" onClick={() => onNavigate('/')} title="ClarifySQL">
          <BrandLogo className="nav-brand-logo" />
        </div>

        <div className="nav-actions">
          {isApp && (
            <>
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
                className="nav-link-btn"
                onClick={onReset}
                title="Reset session and start over"
              >
                Reset
              </button>
            </>
          )}

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

          {isApp ? (
            <button
              type="button"
              className="nav-link-btn"
              onClick={() => onNavigate('/')}
              title="Return to Home"
            >
              Home
            </button>
          ) : user ? (
            <button
              type="button"
              className="nav-btn-primary"
              onClick={() => onNavigate('/app')}
            >
              Workspace
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14" />
                <path d="M12 5l7 7-7 7" />
              </svg>
            </button>
          ) : isAuthPage ? (
            <button
              type="button"
              className="nav-link-btn nav-back-link"
              onClick={() => onNavigate('/')}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5" />
                <path d="M12 19l-7-7 7-7" />
              </svg>
              Back to home
            </button>
          ) : (
            <>
              <button
                type="button"
                className={`nav-link-btn ${currentRoute === '/login' ? 'active' : ''}`}
                onClick={() => onNavigate('/login')}
              >
                Log in
              </button>
              <button
                type="button"
                className="nav-btn-primary"
                onClick={() => onNavigate('/signup')}
              >
                Sign up
              </button>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
