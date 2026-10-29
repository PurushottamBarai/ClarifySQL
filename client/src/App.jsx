import { useState, useEffect } from "react";
import Header from "./components/Header";
import SchemaPanel from "./components/SchemaPanel";
import DatabaseModal from "./components/DatabaseModal";
import AuthModal from "./components/AuthModal";
import QueryConsole from "./components/QueryConsole";
import SQLPreviewCard from "./components/SQLPreviewCard";
import ResultsGrid from "./components/ResultsGrid";
import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import ContactPage from "./pages/ContactPage";
import AboutPage from "./pages/AboutPage";
import PrivacyPage from "./pages/PrivacyPage";
import TermsPage from "./pages/TermsPage";
import { api } from "./api/client";
import { useAuth } from "./context/AuthContext";
import "./App.css";

export default function App() {
  const { user, logout } = useAuth();

  // Simple client-side path router supporting /, /login, /signup, /app
  const [currentRoute, setCurrentRoute] = useState(() => {
    const path = window.location.pathname.toLowerCase().replace(/\/+$/, '') || '/';
    return path;
  });

  const handleNavigate = (path) => {
    const clean = path.toLowerCase().replace(/\/+$/, '') || '/';
    if (window.location.pathname !== clean) {
      window.history.pushState({}, '', clean);
    }
    setCurrentRoute(clean);
    window.scrollTo(0, 0);
  };

  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname.toLowerCase().replace(/\/+$/, '') || '/';
      setCurrentRoute(path);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const [schema, setSchema] = useState(null);
  const [dbStatus, setDbStatus] = useState(null);
  const [isDbModalOpen, setIsDbModalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [queryResult, setQueryResult] = useState(null);
  const [clarification, setClarification] = useState(null);
  const [lastQuestion, setLastQuestion] = useState("");
  const [executionResults, setExecutionResults] = useState(null);
  const [executionError, setExecutionError] = useState(null);

  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem("clarify_sidebar_width");
    return saved ? Math.min(Math.max(parseInt(saved, 10), 200), 650) : 280;
  });
  const [isResizing, setIsResizing] = useState(false);

  useEffect(() => {
    if (!isResizing) return;

    const handlePointerMove = (e) => {
      const maxWidth = Math.min(650, window.innerWidth * 0.55);
      const newWidth = Math.min(Math.max(e.clientX, 210), maxWidth);
      setSidebarWidth(newWidth);
    };

    const handlePointerUp = () => {
      setIsResizing(false);
      localStorage.setItem("clarify_sidebar_width", sidebarWidth.toString());
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, sidebarWidth]);

  const [loadingSchema, setLoadingSchema] = useState(false);
  const [loadingQuery, setLoadingQuery] = useState(false);
  const [loadingExecute, setLoadingExecute] = useState(false);
  const [loadingDb, setLoadingDb] = useState(false);

  useEffect(() => {
    async function init() {
      try {
        const schemaRes = await api.getSchema();
        if (schemaRes?.schema) setSchema(schemaRes.schema);
      } catch (err) {
        console.debug("No active schema:", err.message);
      }

      try {
        const dbRes = await api.getDbStatus();
        setDbStatus(dbRes);
        if (dbRes?.schema) {
          setSchema(dbRes.schema);
        }
      } catch (err) {
        console.debug("Database not yet connected:", err.message);
      }
    }
    init();
  }, []);

  const handleUploadSchema = async (sqlContent) => {
    try {
      setLoadingSchema(true);
      const res = await api.importSchema(sqlContent);
      setSchema(res.schema);
      setQueryResult(null);
      setClarification(null);
      setExecutionResults(null);
      setExecutionError(null);
    } catch (err) {
      alert(`Schema upload error: ${err.message}`);
    } finally {
      setLoadingSchema(false);
    }
  };

  const handleConnectDb = async (config) => {
    try {
      setLoadingDb(true);
      const res = await api.connectDb(config);
      setDbStatus({ connected: true, database: res.database });
      if (res.schema) {
        setSchema(res.schema);
      }
      if (res.compatibility && !res.compatibility.compatible) {
        alert(
          `Warning: Live schema differences detected:\n${res.compatibility.errors.join("\n")}`,
        );
      }
    } finally {
      setLoadingDb(false);
    }
  };

  const handleDisconnectDb = async () => {
    try {
      await api.disconnectDb();
      setDbStatus({ connected: false });
    } catch (err) {
      alert(err.message);
    }
  };

  const handleAskQuestion = async (question) => {
    try {
      setLoadingQuery(true);
      setLastQuestion(question);
      setExecutionResults(null);
      setExecutionError(null);
      const res = await api.askQuery(question);

      if (res.status === "needs_clarification") {
        setClarification(res);
        setQueryResult(null);
      } else if (res.status === "clear") {
        setQueryResult(res);
        setClarification(null);
      } else if (res.status === "unsupported") {
        alert(`Unsupported Request: ${res.reason}`);
        setQueryResult(null);
        setClarification(null);
      }
    } catch (err) {
      alert(`Query error: ${err.message}`);
    } finally {
      setLoadingQuery(false);
    }
  };

  const handleAnswerClarification = async (answer) => {
    try {
      setLoadingQuery(true);
      const res = await api.askQuery(lastQuestion, answer);

      if (res.status === "needs_clarification") {
        setClarification(res);
        setQueryResult(null);
      } else if (res.status === "clear") {
        setQueryResult(res);
        setClarification(null);
      } else if (res.status === "unsupported") {
        alert(`Unsupported Request: ${res.reason}`);
        setQueryResult(null);
        setClarification(null);
      }
    } catch (err) {
      alert(`Query error: ${err.message}`);
    } finally {
      setLoadingQuery(false);
    }
  };

  const handleExecuteQuery = async (sql) => {
    try {
      setLoadingExecute(true);
      setExecutionError(null);
      const res = await api.executeQuery(sql);
      setExecutionResults(res);
    } catch (err) {
      setExecutionError(err.message);
    } finally {
      setLoadingExecute(false);
    }
  };

  const handleRefreshSchema = async () => {
    try {
      setLoadingSchema(true);
      if (dbStatus?.connected) {
        const dbRes = await api.getDbStatus();
        if (dbRes?.schema) setSchema(dbRes.schema);
      } else {
        const schemaRes = await api.getSchema();
        if (schemaRes?.schema) setSchema(schemaRes.schema);
      }
    } catch (err) {
      console.warn("Failed to refresh schema:", err);
    } finally {
      setLoadingSchema(false);
    }
  };

  const handleReset = async () => {
    if (
      confirm(
        "Reset session? This clears your clarification history and imported state.",
      )
    ) {
      await api.resetQuery();
      setQueryResult(null);
      setClarification(null);
      setExecutionResults(null);
      setExecutionError(null);
    }
  };

  // Route 1: Landing Page
  if (currentRoute === '/' || currentRoute === '') {
    return <LandingPage onNavigate={handleNavigate} />;
  }

  // Route 2: Login Page
  if (currentRoute === '/login') {
    return <LoginPage onNavigate={handleNavigate} />;
  }

  // Route 3: Signup Page
  if (currentRoute === '/signup') {
    return <SignupPage onNavigate={handleNavigate} />;
  }

  // Route 4: Contact Page
  if (currentRoute === '/contact') {
    return <ContactPage onNavigate={handleNavigate} />;
  }

  // Route 5: About Page
  if (currentRoute === '/about') {
    return <AboutPage onNavigate={handleNavigate} />;
  }

  // Route 6: Privacy Policy Page
  if (currentRoute === '/privacy') {
    return <PrivacyPage onNavigate={handleNavigate} />;
  }

  // Route 7: Terms of Service Page
  if (currentRoute === '/terms') {
    return <TermsPage onNavigate={handleNavigate} />;
  }

  // Route 8: Main ClarifySQL App Console (/app)
  return (
    <div className="app-layout">
      <Header
        dbStatus={dbStatus}
        onOpenDbModal={() => setIsDbModalOpen(true)}
        onReset={handleReset}
        onNavigate={handleNavigate}
      />

      <div
        className="main-content"
        style={{ gridTemplateColumns: `${sidebarWidth}px 1fr` }}
      >
        <div style={{ position: "relative", height: "100%", overflow: "visible" }}>
          <SchemaPanel
            schema={schema}
            onUpload={handleUploadSchema}
            loading={loadingSchema}
            dbStatus={dbStatus}
            onRefresh={handleRefreshSchema}
            user={user}
            onOpenAuthModal={() => handleNavigate('/login')}
            onLogout={logout}
          />
          {/* Draggable Resizer Handle */}
          <div
            className={`sidebar-resizer ${isResizing ? "resizing" : ""}`}
            onPointerDown={(e) => {
              e.preventDefault();
              setIsResizing(true);
            }}
            onDoubleClick={() => setSidebarWidth(280)}
            title="Drag to resize sidebar width (Double click to reset)"
          />
        </div>

        <main className="console-area">
          <QueryConsole
            onAsk={handleAskQuestion}
            clarification={clarification}
            onAnswerClarification={handleAnswerClarification}
            loading={loadingQuery}
            schemaReady={Boolean(schema?.tables?.length)}
          />

          <SQLPreviewCard
            queryResult={queryResult}
            onExecute={handleExecuteQuery}
            executing={loadingExecute}
            dbConnected={Boolean(dbStatus?.connected)}
          />

          <ResultsGrid results={executionResults} error={executionError} />
        </main>
      </div>

      <DatabaseModal
        isOpen={isDbModalOpen}
        onClose={() => setIsDbModalOpen(false)}
        onConnect={handleConnectDb}
        onDisconnect={handleDisconnectDb}
        dbStatus={dbStatus}
        loading={loadingDb}
      />

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
      />
    </div>
  );
}
