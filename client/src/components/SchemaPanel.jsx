import { useState, useRef, useEffect, useCallback } from "react";

export default function SchemaPanel({
  schema,
  onUpload,
  loading,
  dbStatus,
  onRefresh,
  user,
  onOpenAuthModal,
  onLogout,
}) {
  const [openDbs, setOpenDbs] = useState({ default: true });
  const [openTables, setOpenTables] = useState({});
  const [search, setSearch] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const fileInputRef = useRef(null);
  const menuRef = useRef(null);
  const profileRowRef = useRef(null);

  const [theme, setTheme] = useState(() => {
    return localStorage.getItem("clarify_theme") || "light";
  });

  const applyTheme = useCallback((themeName) => {
    if (themeName === "dark") {
      document.documentElement.setAttribute("data-theme", "dark");
    } else if (themeName === "light") {
      document.documentElement.removeAttribute("data-theme");
    } else {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      if (prefersDark) {
        document.documentElement.setAttribute("data-theme", "dark");
      } else {
        document.documentElement.removeAttribute("data-theme");
      }
    }
  }, []);

  const handleThemeChange = (newTheme) => {
    setTheme(newTheme);
    localStorage.setItem("clarify_theme", newTheme);
    applyTheme(newTheme);
  };

  useEffect(() => {
    applyTheme(theme);
  }, [theme, applyTheme]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target) &&
        profileRowRef.current &&
        !profileRowRef.current.contains(event.target)
      ) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [menuOpen]);

  const handleRefreshClick = async () => {
    setRefreshing(true);
    if (onRefresh) {
      await onRefresh();
    }
    setTimeout(() => setRefreshing(false), 500);
  };

  const toggleDb = (dbKey) => {
    setOpenDbs((prev) => ({
      ...prev,
      [dbKey]: !prev[dbKey],
    }));
  };

  const toggleTable = (tableName) => {
    setOpenTables((prev) => ({
      ...prev,
      [tableName]: !prev[tableName],
    }));
  };

  const handleFile = (file) => {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      alert("File exceeds 2MB limit.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      onUpload(e.target.result);
    };
    reader.readAsText(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const renderColIcon = (col) => {
    const name = (col.name || "").toLowerCase();
    const type = (col.type || "").toLowerCase();

    if (
      name.includes("date") ||
      name.includes("time") ||
      name.includes("created") ||
      name.includes("updated") ||
      type.includes("date") ||
      type.includes("time") ||
      type.includes("year")
    ) {
      return (
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ color: "#6b7280" }}
        >
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      );
    }

    if (
      name.includes("id") ||
      name.includes("price") ||
      name.includes("qty") ||
      name.includes("count") ||
      name.includes("active") ||
      name.includes("status_code") ||
      type.includes("int") ||
      type.includes("decimal") ||
      type.includes("float") ||
      type.includes("double") ||
      type.includes("numeric") ||
      type.includes("bool")
    ) {
      return (
        <span
          style={{
            fontFamily: "var(--font-code)",
            fontSize: "13px",
            fontWeight: 600,
            color: "#6b7280",
            width: "16px",
            textAlign: "center",
            display: "inline-block",
          }}
        >
          #
        </span>
      );
    }

    return (
      <span
        style={{
          fontFamily: "var(--font-ui)",
          fontSize: "12px",
          fontWeight: 600,
          color: "#6b7280",
          width: "16px",
          textAlign: "center",
          display: "inline-block",
        }}
      >
        Aa
      </span>
    );
  };

  const filteredTables = (schema?.tables || []).filter((t) =>
    t.name.toLowerCase().includes(search.toLowerCase())
  );

  const dbName = dbStatus?.database || schema?.database || "default_db";
  const isDbOpen = openDbs["default"] ?? true;

  return (
    <aside
      className="sidebar"
      style={{
        background: "#ffffff",
        borderRight: "1px solid var(--border-light)",
        display: "flex",
        flexDirection: "column",
        overflow: "visible",
        position: "relative",
        userSelect: "none",
        height: "100%",
      }}
    >
      <div
        style={{
          padding: "10px 14px",
          borderBottom: "1px solid var(--border-light)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span style={{ fontSize: "12px", fontWeight: 700, color: "#18181b", textTransform: "uppercase", letterSpacing: "0.5px" }}>
          Schemas
        </span>
        <button
          className="btn-secondary"
          style={{ fontSize: "11px", padding: "2px 7px" }}
          onClick={() => fileInputRef.current?.click()}
        >
          {schema?.tables ? "Import .sql" : "Upload .sql"}
        </button>
      </div>

      <input
        type="file"
        ref={fileInputRef}
        accept=".sql"
        style={{ display: "none" }}
        onChange={(e) => handleFile(e.target.files[0])}
      />

      {(schema?.tables?.length > 0 || dbStatus?.connected) && (
        <div
          style={{
            padding: "6px 10px",
            borderBottom: "1px solid var(--border-light)",
            display: "flex",
            alignItems: "center",
            gap: "6px",
          }}
        >
          <button
            type="button"
            className="btn-secondary"
            style={{
              padding: 0,
              width: "26px",
              height: "26px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              borderRadius: "4px",
              border: "1px solid var(--border-light)",
              background: "#ffffff",
              color: "#52525b",
              cursor: "pointer",
            }}
            onClick={handleRefreshClick}
            disabled={refreshing || loading}
            title="Refresh schema"
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                animation: refreshing || loading ? "spin 0.6s linear infinite" : "none",
              }}
            >
              <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
              <path d="M21 3v5h-5" />
              <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
              <path d="M3 21v-5h5" />
            </svg>
          </button>
          <input
            className="form-input"
            style={{
              flex: 1,
              width: "100%",
              padding: "4px 8px",
              fontSize: "12px",
              height: "26px",
            }}
            placeholder="Filter tables..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      )}

      <div className="sidebar-tree-container" style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
        {!schema?.tables || schema.tables.length === 0 ? (
          <div
            className={`upload-box ${isDragging ? "dragging" : ""}`}
            style={{ margin: "14px", padding: "20px 10px" }}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <svg
              className="upload-icon"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.75}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
              />
            </svg>
            <div className="upload-text">
              {loading ? "Parsing Schema..." : "Upload schema .sql file"}
            </div>
            <div className="upload-hint">Drag & drop or browse</div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {/* Database Node */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "6px 12px",
                cursor: "pointer",
                color: "#374151",
                fontSize: "13.5px",
                fontWeight: 500,
                transition: "background 0.12s ease",
              }}
              onClick={() => toggleDb("default")}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#f4f4f5")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <span style={{ display: "flex", alignItems: "center" }}>
                {isDbOpen ? (
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ color: "#6b7280" }}
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                ) : (
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ color: "#9ca3af" }}
                  >
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                )}
              </span>

              {/* Database cylinder icon */}
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ color: "#4b5563" }}
              >
                <ellipse cx="12" cy="5" rx="9" ry="3" />
                <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
                <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
              </svg>

              <span>{dbName}</span>
            </div>

            {/* Tables List */}
            {isDbOpen && (
              <div style={{ display: "flex", flexDirection: "column" }}>
                {filteredTables.map((table, index) => {
                  const isOpen = openTables[table.name] ?? (index === 0);

                  return (
                    <div key={table.name} style={{ display: "flex", flexDirection: "column" }}>
                      {/* Table Row */}
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          padding: "5px 12px 5px 28px",
                          cursor: "pointer",
                          color: "#4b5563",
                          fontSize: "13px",
                          fontWeight: 500,
                          transition: "background 0.12s ease",
                        }}
                        onClick={() => toggleTable(table.name)}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "#f4f4f5")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                      >
                        <span style={{ display: "flex", alignItems: "center" }}>
                          {isOpen ? (
                            <svg
                              width="11"
                              height="11"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              style={{ color: "#6b7280" }}
                            >
                              <polyline points="6 9 12 15 18 9" />
                            </svg>
                          ) : (
                            <svg
                              width="11"
                              height="11"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              style={{ color: "#9ca3af" }}
                            >
                              <polyline points="9 18 15 12 9 6" />
                            </svg>
                          )}
                        </span>

                        {/* Table grid icon */}
                        <svg
                          width="15"
                          height="15"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          style={{ color: "#4b5563" }}
                        >
                          <rect x="3" y="3" width="18" height="18" rx="2" />
                          <path d="M3 9h18" />
                          <path d="M9 21V9" />
                        </svg>

                        <span>{table.name}</span>
                      </div>

                      {/* Columns List */}
                      {isOpen && (
                        <div style={{ display: "flex", flexDirection: "column" }}>
                          {table.columns.map((col) => (
                            <div
                              key={col.name}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "10px",
                                padding: "4px 12px 4px 48px",
                                color: "#4b5563",
                                fontSize: "13px",
                                transition: "background 0.12s ease",
                              }}
                              onMouseEnter={(e) => (e.currentTarget.style.background = "#f9fafb")}
                              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                            >
                              <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "16px" }}>
                                {renderColIcon(col)}
                              </span>
                              <span>{col.name}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom Profile Section */}
      <div
        style={{
          position: "relative",
          borderTop: "1px solid var(--border-light)",
          background: "#ffffff",
          padding: "6px 8px",
          flexShrink: 0,
        }}
      >
        <div
          ref={profileRowRef}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "8px 10px",
            borderRadius: "6px",
            cursor: "pointer",
            transition: "background 0.12s ease",
            background: menuOpen ? "#f4f4f5" : "transparent",
          }}
          onClick={user ? () => setMenuOpen(!menuOpen) : onOpenAuthModal}
          onMouseEnter={(e) => {
            if (!menuOpen) e.currentTarget.style.background = "#f4f4f5";
          }}
          onMouseLeave={(e) => {
            if (!menuOpen) e.currentTarget.style.background = "transparent";
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ color: "var(--text-main)", flexShrink: 0 }}
            >
              <circle cx="12" cy="12" r="10" />
              <circle cx="12" cy="9.5" r="3.2" />
              <path d="M6.5 18c1.3-2.5 3.3-3.5 5.5-3.5s4.2 1 5.5 3.5" />
            </svg>
            <span
              style={{
                fontSize: "13.5px",
                fontWeight: 500,
                color: "var(--text-main)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {user ? (user.name || user.email) : "Sign In"}
            </span>
          </div>

          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ color: "var(--text-dim)", flexShrink: 0 }}
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </div>

        {/* Floating Profile Dropdown Popover */}
        {menuOpen && (
          <div
            ref={menuRef}
            style={{
              position: "absolute",
              bottom: "8px",
              left: "calc(100% + 8px)",
              background: "var(--bg-surface)",
              border: "1px solid var(--border-light)",
              borderRadius: "8px",
              boxShadow: "0 8px 24px rgba(0, 0, 0, 0.12)",
              padding: "10px 12px",
              minWidth: "220px",
              zIndex: 70,
              display: "flex",
              flexDirection: "column",
            }}
          >
            {/* User Info Header */}
            <div style={{ padding: "4px 2px 8px 2px" }}>
              <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-main)", lineHeight: 1.3 }}>
                {user?.name || (user?.email ? user.email.split('@')[0] : "Guest User")}
              </div>
              <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>
                {user?.email || "Not signed in"}
              </div>
            </div>

            <div style={{ height: "1px", background: "var(--border-light)", margin: "4px 0 8px 0" }} />

            {/* Theme Row */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "4px 2px 8px 2px",
              }}
            >
              <span style={{ fontSize: "13.5px", color: "var(--text-main)", fontWeight: 500 }}>
                Theme
              </span>
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  border: "1px solid var(--border-light)",
                  borderRadius: "8px",
                  background: "var(--bg-subtle)",
                  padding: "2px",
                }}
              >
                {/* Light */}
                <button
                  type="button"
                  onClick={() => handleThemeChange("light")}
                  style={{
                    width: "28px",
                    height: "26px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: "6px",
                    border: theme === "light" ? "1px solid var(--border-focus)" : "1px solid transparent",
                    background: theme === "light" ? "var(--bg-surface)" : "transparent",
                    color: theme === "light" ? "var(--text-main)" : "var(--text-muted)",
                    cursor: "pointer",
                    padding: 0,
                    boxShadow: theme === "light" ? "var(--shadow-sm)" : "none",
                    transition: "all 0.12s ease",
                  }}
                  title="Light mode"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="4" />
                    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
                  </svg>
                </button>

                {/* System */}
                <button
                  type="button"
                  onClick={() => handleThemeChange("system")}
                  style={{
                    width: "28px",
                    height: "26px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: "6px",
                    border: theme === "system" ? "1px solid var(--border-focus)" : "1px solid transparent",
                    background: theme === "system" ? "var(--bg-surface)" : "transparent",
                    color: theme === "system" ? "var(--text-main)" : "var(--text-muted)",
                    cursor: "pointer",
                    padding: 0,
                    boxShadow: theme === "system" ? "var(--shadow-sm)" : "none",
                    transition: "all 0.12s ease",
                  }}
                  title="System mode"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 3v18" />
                    <path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor" opacity="0.35" />
                  </svg>
                </button>

                {/* Dark */}
                <button
                  type="button"
                  onClick={() => handleThemeChange("dark")}
                  style={{
                    width: "28px",
                    height: "26px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: "6px",
                    border: theme === "dark" ? "1px solid var(--border-focus)" : "1px solid transparent",
                    background: theme === "dark" ? "var(--bg-surface)" : "transparent",
                    color: theme === "dark" ? "var(--text-main)" : "var(--text-muted)",
                    cursor: "pointer",
                    padding: 0,
                    boxShadow: theme === "dark" ? "var(--shadow-sm)" : "none",
                    transition: "all 0.12s ease",
                  }}
                  title="Dark mode"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                  </svg>
                </button>
              </div>
            </div>

            <div style={{ height: "1px", background: "var(--border-light)", margin: "0 0 4px 0" }} />

            {/* Logout Row */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "8px 2px 4px 2px",
                borderRadius: "4px",
                cursor: "pointer",
                fontSize: "13.5px",
                color: "var(--text-main)",
                fontWeight: 500,
                transition: "color 0.12s ease",
              }}
              onClick={() => {
                setMenuOpen(false);
                if (user && onLogout) {
                  onLogout();
                } else if (onOpenAuthModal) {
                  onOpenAuthModal();
                }
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#dc2626")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-main)")}
            >
              <span>{user ? "Logout" : "Sign In"}</span>
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ color: "currentColor" }}
              >
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
