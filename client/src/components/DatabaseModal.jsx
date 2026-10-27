import { useState } from "react";

export default function DatabaseModal({
  isOpen,
  onClose,
  onConnect,
  onDisconnect,
  dbStatus,
  loading,
}) {
  const [useUrl, setUseUrl] = useState(false);
  const [formData, setFormData] = useState({
    host: "localhost",
    port: "3306",
    user: "root",
    password: "",
    database: "",
    connectionString: "",
  });
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await onConnect(
        useUrl ? { connectionString: formData.connectionString } : formData,
      );
      onClose();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ fontSize: "1rem", fontWeight: 700 }}>
            MySQL Database Connection
          </h3>
          <button
            className="btn-secondary"
            style={{ padding: "0.2rem 0.5rem" }}
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div
              style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem" }}
            >
              <button
                type="button"
                className={`btn-secondary ${!useUrl ? "btn-primary" : ""}`}
                style={{ flex: 1 }}
                onClick={() => setUseUrl(false)}
              >
                Standard Fields
              </button>
              <button
                type="button"
                className={`btn-secondary ${useUrl ? "btn-primary" : ""}`}
                style={{ flex: 1 }}
                onClick={() => setUseUrl(true)}
              >
                Connection String
              </button>
            </div>

            {error && (
              <div
                style={{
                  background: "#fee2e2",
                  color: "#b91c1c",
                  padding: "0.5rem 0.75rem",
                  borderRadius: "6px",
                  fontSize: "0.8rem",
                }}
              >
                {error}
              </div>
            )}

            {!useUrl ? (
              <>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Host</label>
                    <input
                      className="form-input"
                      name="host"
                      value={formData.host}
                      onChange={handleChange}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Port</label>
                    <input
                      className="form-input"
                      name="port"
                      value={formData.port}
                      onChange={handleChange}
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Database Name</label>
                  <input
                    className="form-input"
                    name="database"
                    placeholder="e.g. ecommerce_db"
                    value={formData.database}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Username</label>
                    <input
                      className="form-input"
                      name="user"
                      value={formData.user}
                      onChange={handleChange}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Password</label>
                    <input
                      className="form-input"
                      type="password"
                      name="password"
                      value={formData.password}
                      onChange={handleChange}
                    />
                  </div>
                </div>
              </>
            ) : (
              <div className="form-group">
                <label className="form-label">MySQL Connection URL</label>
                <input
                  className="form-input"
                  name="connectionString"
                  placeholder="mysql://user:password@localhost:3306/dbname"
                  value={formData.connectionString}
                  onChange={handleChange}
                  required
                />
              </div>
            )}
          </div>

          <div className="modal-footer">
            {dbStatus?.connected && (
              <button
                type="button"
                className="btn-secondary"
                style={{ color: "#e11d48", borderColor: "#fecdd3" }}
                onClick={async () => {
                  await onDisconnect();
                  onClose();
                }}
              >
                Disconnect
              </button>
            )}
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? "Connecting..." : "Connect"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
