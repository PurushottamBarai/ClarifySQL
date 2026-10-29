export default function Footer({ onNavigate }) {
  return (
    <footer className="site-footer">
      <div className="footer-container">
        <div className="footer-copyright">
          ClarifySQL &copy; 2026. Built with React, Express, and Groq.
        </div>

        <div className="footer-links">
          <a href="/about" onClick={(e) => { e.preventDefault(); onNavigate('/about'); }}>About</a>
          <span className="footer-dot">&bull;</span>
          <a href="/privacy" onClick={(e) => { e.preventDefault(); onNavigate('/privacy'); }}>Privacy</a>
          <span className="footer-dot">&bull;</span>
          <a href="/terms" onClick={(e) => { e.preventDefault(); onNavigate('/terms'); }}>Terms</a>
          <span className="footer-dot">&bull;</span>
          <a href="/contact" onClick={(e) => { e.preventDefault(); onNavigate('/contact'); }}>Contact</a>
          <span className="footer-divider">|</span>
          <button type="button" className="footer-link-btn" onClick={() => onNavigate('/login')}>Log in</button>
          <button type="button" className="footer-link-btn" onClick={() => onNavigate('/signup')}>Sign up</button>
        </div>
      </div>
    </footer>
  );
}

