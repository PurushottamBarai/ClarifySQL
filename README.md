# ClarifySQL

ClarifySQL is an intelligent Natural Language to MySQL query assistant and clarification engine. It bridges the gap between non-technical questions and production database queries by eliminating hallucinations, interactively resolving business ambiguity, and enforcing strict read-only query execution guards.

Unlike traditional text-to-SQL tools that guess user intent or generate dangerous operations directly against live tables, ClarifySQL parses uploaded SQL DDL definitions, validates live MySQL compatibility, asks targeted multiple-choice clarification questions when terms are vague, and safely executes approved read-only queries with strict timeouts and row bounds.

---

## Key Capabilities

### 1. Ambiguity Detection and Clarification Engine
- Uses Groq's high-speed inference engine with strict structured JSON schemas (`zod`).
- Evaluates user inquiries against imported table and column definitions.
- When ambiguous terminology is detected (such as "best customers", "recent orders", or "top products"), the engine halts query generation and returns a targeted question with structured multiple-choice options.
- Retains multi-turn clarification history in the user session until ambiguity is resolved into a concrete SQL draft.

### 2. Schema Parser and Live Compatibility Engine
- Parses MySQL DDL (`CREATE TABLE`, primary keys, foreign keys, constraints) client-side and server-side without executing modifications.
- Connects securely to target MySQL instances over standard TCP or TLS/SSL.
- Introspects live database metadata (`information_schema`) and validates imported schemas against the live database, alerting developers to missing tables, columns, or type mismatches.

### 3. Read-Only Execution Guardrails
- Blocks data modification statements (`INSERT`, `UPDATE`, `DELETE`, `DROP`, `ALTER`, `TRUNCATE`, `REPLACE`, `GRANT`, `REVOKE`).
- Prevents SQL injection and multi-statement attacks by forbidding statement chaining (semicolons in queries).
- Enforces runtime query limits (`LIMIT 100` by default) and timeout thresholds (5000ms max) to prevent denial-of-service on live production databases.
- Highlights destructive queries generated during intent exploration with safety warnings and disables execution controls.

### 4. Interactive SQL Code Editor
- Multi-line code editor with line number gutter synchronization.
- Real-time syntax highlighting for keywords, identifiers, strings, numbers, and SQL comments.
- One-click SQL query formatting via `sql-formatter` with MySQL dialect conventions.
- Keyboard shortcuts: Tab indentation and Ctrl+Enter (Cmd+Enter on macOS) execution.

### 5. Multi-Provider OAuth Authentication
- Native OAuth 2.0 integration for Google and GitHub accounts.
- JWT-based authentication stored in secure, HTTP-only session cookies.
- User credentials, provider identifiers, and profile details persisted to MongoDB Atlas.

### 6. Dynamic Workspace
- Drag-to-resize sidebar splitter allowing fluid adjustment of schema panel width (persisted to localStorage).
- Built-in theme switcher supporting Light, Dark, and System color schemes using CSS design variables.

---

## Technology Stack

### Frontend
- Framework: React 19
- Build Tool: Vite 8
- Formatting: sql-formatter
- Styling: Vanilla CSS with custom design tokens and dark mode attributes
- Architecture: Pure ES Modules (ESM)

### Backend
- Runtime: Node.js (v18+) with native ES Modules (`"type": "module"`)
- Framework: Express 5
- AI / LLM SDK: Groq SDK
- Schema Validation: Zod
- Relational Database Driver: mysql2 (Connection pooling, Promises, TLS support)
- User Database ODM: Mongoose (MongoDB Atlas)
- Security & Auth: JSON Web Tokens (`jsonwebtoken`), `cookie-parser`, `express-session`

---

## Project Structure

```text
ClarifySQL/
├── client/                     # Frontend application
│   ├── public/                 # Static assets (favicon.png, logo.png)
│   ├── src/
│   │   ├── api/
│   │   │   └── client.js       # Centralized REST API client
│   │   ├── components/
│   │   │   ├── AuthModal.jsx       # Sign in dialog
│   │   │   ├── DatabaseModal.jsx   # MySQL connection configuration modal
│   │   │   ├── Header.jsx          # Top brand bar and connection status
│   │   │   ├── OAuthButtons.jsx    # Google and GitHub buttons
│   │   │   ├── QueryConsole.jsx    # Question input and clarification options
│   │   │   ├── ResultsGrid.jsx     # Tabular query result view
│   │   │   ├── SchemaPanel.jsx     # Collapsible schema tree and profile menu
│   │   │   └── SQLPreviewCard.jsx  # Interactive SQL editor and execution card
│   │   ├── context/
│   │   │   └── AuthContext.jsx # User authentication state provider
│   │   ├── utils/
│   │   │   └── sqlFormatter.js # SQL tokenization and formatting logic
│   │   ├── App.css             # Main workspace styling
│   │   ├── App.jsx             # Top-level workspace layout
│   │   ├── index.css           # Global tokens, reset, and scrollbar styles
│   │   └── main.jsx            # React root mount
│   ├── package.json
│   └── vite.config.js          # Vite config with API proxy
│
├── server/                     # Backend API server
│   ├── src/
│   │   ├── config/
│   │   │   └── mongo.js        # MongoDB Atlas connection with DNS fallback
│   │   ├── controllers/
│   │   │   └── auth.controller.js  # OAuth and user controller
│   │   ├── db/
│   │   │   ├── connectionManager.js # MySQL connection pools & introspection
│   │   │   └── queryExecutor.js     # Guarded read-only executor
│   │   ├── models/
│   │   │   └── User.js         # Mongoose User model
│   │   ├── routes/
│   │   │   ├── authRoutes.js   # OAuth redirects and user endpoints
│   │   │   ├── dbRoutes.js     # MySQL connect, disconnect, and status
│   │   │   ├── healthRoutes.js # Service health check
│   │   │   ├── queryRoutes.js  # Groq clarification and execution endpoints
│   │   │   └── schemaRoutes.js # DDL upload and session schema endpoints
│   │   ├── schema/
│   │   │   ├── ddlParser.js         # DDL parser and validator
│   │   │   └── schemaComparator.js  # Imported vs live schema validator
│   │   ├── services/
│   │   │   ├── groqService.js   # Groq model prompt and structured response
│   │   │   └── oauth.service.js # Google and GitHub OAuth token exchanges
│   │   ├── validators/
│   │   │   └── sqlValidator.js # Safety and read-only query rules
│   │   └── index.js            # Express server initialization
│   ├── .env.example
│   └── package.json
│
└── README.md
```

---

## Getting Started

### Prerequisites
- Node.js version 18.0.0 or higher
- npm version 9.0.0 or higher
- A Groq Cloud API key
- A MongoDB Atlas connection string (or local MongoDB instance)
- A MySQL database instance (optional for schema-only design, required for query execution)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/PurushottamBarai/ClarifySQL.git
   cd ClarifySQL
   ```

2. Install root and workspace dependencies:
   ```bash
   npm install
   cd server && npm install
   cd ../client && npm install
   cd ..
   ```

### Configuration

Create a `.env` file inside the `server/` directory following `server/.env.example`:

```env
PORT=5000
MONGODB_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/clarifysql?retryWrites=true&w=majority
GROQ_API_KEY=your_groq_api_key_here
GROQ_MODEL=openai/gpt-oss-120b
SESSION_SECRET=your_session_secret_32_characters_long
CLIENT_URL=http://localhost:5173
JWT_SECRET=your_jwt_secret_64_characters_long

# GitHub OAuth
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
GITHUB_CALLBACK_URL=http://localhost:5173/api/auth/github/callback

# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALLBACK_URL=http://localhost:5173/api/auth/google/callback
```

### Running the Application

From the root directory, start both the Express backend and the Vite frontend concurrently:

```bash
npm run dev
```

The application will be available at:
- Web Interface: `http://localhost:5173`
- Backend API: `http://localhost:5000`

---

## API Reference

### Authentication
- `GET /api/auth/github` - Initiates GitHub OAuth authentication flow.
- `GET /api/auth/github/callback` - Handles GitHub code exchange and session establishment.
- `GET /api/auth/google` - Initiates Google OAuth authentication flow.
- `GET /api/auth/google/callback` - Handles Google code exchange and session establishment.
- `GET /api/auth/me` - Returns current authenticated user record.
- `POST /api/auth/logout` - Clears authentication token and invalidates session.

### Schema Management
- `POST /api/schema/import` - Uploads and parses raw SQL DDL file into table definitions.
- `GET /api/schema` - Retrieves the active session schema.

### Database Connection
- `POST /api/db/connect` - Connects to a live MySQL instance via credentials or connection string.
- `POST /api/db/disconnect` - Closes active connection pool for the session.
- `GET /api/db/status` - Returns connection status and live database name.

### Query Engine
- `POST /api/query` - Submits a natural-language question or clarification answer to the Groq clarification engine.
- `POST /api/query/execute` - Validates and executes an approved read-only SQL query against the connected MySQL instance.
- `POST /api/query/reset` - Clears clarification context and resets conversation state.

---

## Security Model

1. **Read-Only Verification**: The query executor will refuse execution if a query contains any non-SELECT keyword or attempts multi-statement execution.
2. **Credential Safety**: Database connection passwords are stored only in memory within the server session and are never transmitted back to the client interface.
3. **HTTP-Only Cookies**: Authentication tokens are written to secure HTTP-only cookies with configurable `SameSite` policies to mitigate Cross-Site Scripting (XSS) risks.
4. **CORS and Trust Proxy**: Reverse proxy trust configuration and origin whitelisting ensure cross-origin protection across local and cloud environments.
