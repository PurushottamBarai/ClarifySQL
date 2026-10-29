import { useAuth } from '../context/AuthContext';

export default function Navbar({ currentRoute, onNavigate }) {
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
    <nav className="site-navbar">
      <div className="nav-container">
        {/* Brand */}
        <div className="nav-brand" onClick={() => onNavigate('/')} title="ClarifySQL">
          <img
            src="/logo.png"
            alt="ClarifySQL"
            className="nav-brand-logo"
            style={{ height: '28px', width: 'auto', display: 'block', objectFit: 'contain' }}
          />
        </div>

        {/* Right Nav Actions */}
        <div className="nav-actions">
          {/* Theme Toggle Button */}
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

          {user ? (
            <>
              <button
                type="button"
                className="nav-link-btn"
                onClick={() => onNavigate('/app')}
              >
                Workspace
              </button>
              <button
                type="button"
                className="nav-btn-primary"
                onClick={() => onNavigate('/app')}
              >
                Open Console
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14" />
                  <path d="M12 5l7 7-7 7" />
                </svg>
              </button>
            </>
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

