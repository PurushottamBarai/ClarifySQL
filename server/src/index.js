import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import session from 'express-session';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';

import healthRoutes from './routes/healthRoutes.js';
import schemaRoutes from './routes/schemaRoutes.js';
import dbRoutes from './routes/dbRoutes.js';
import queryRoutes from './routes/queryRoutes.js';
import authRoutes from './routes/authRoutes.js';
import contactRoutes from './routes/contact.routes.js';
import { connectMongo } from './config/mongo.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientDist = path.resolve(__dirname, '../../client/dist');

connectMongo();

const app = express();
const port = process.env.PORT || 5000;

app.set('trust proxy', 1);

const allowedOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  process.env.CLIENT_URL
].filter(Boolean);

app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));

app.use(cookieParser());
app.use(express.json({ limit: '5mb' }));

const isProduction = process.env.NODE_ENV === 'production';

app.use(session({
  secret: process.env.SESSION_SECRET || 'clarifysql_secret_key',
  resave: false,
  saveUninitialized: true,
  cookie: {
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    maxAge: 24 * 60 * 60 * 1000
  }
}));

// API Routes
app.use('/api/health', healthRoutes);
app.use('/api/schema', schemaRoutes);
app.use('/api/db', dbRoutes);
app.use('/api/query', queryRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/contact', contactRoutes);

// Serve Frontend Static Assets
app.use(express.static(clientDist));

// SPA Fallback for client-side routing
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(clientDist, 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  res.status(500).json({
    error: err.message || 'An unexpected server error occurred.'
  });
});

app.listen(port, () => {
  console.log(`ClarifySQL Server running on port ${port}`);
});

export default app;
