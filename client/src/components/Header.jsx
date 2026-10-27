export default function Header({ dbStatus, onOpenDbModal, onReset }) {
  return (
    <header className="header">
      <div className="header-brand">
        <img
          src="/logo.png"
          alt="ClarifySQL"
          style={{ height: '28px', width: 'auto', display: 'block', objectFit: 'contain' }}
        />
      </div>

      <div className="header-status">
        <button
          className={`status-badge ${dbStatus?.connected ? 'connected' : 'disconnected'}`}
          onClick={onOpenDbModal}
          title="Click to configure MySQL connection"
        >
          <span className="dot-indicator"></span>
          {dbStatus?.connected ? `Connected: ${dbStatus.database}` : 'Connect Database'}
        </button>

        <button className="btn-secondary" onClick={onReset} title="Reset session and start over">
          Reset
        </button>
      </div>
    </header>
  );
}
