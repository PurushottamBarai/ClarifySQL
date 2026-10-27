import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import session from 'express-session';

import cookieParser from 'cookie-parser';

import healthRoutes from './routes/healthRoutes.js';
import schemaRoutes from './routes/schemaRoutes.js';
import dbRoutes from './routes/dbRoutes.js';
import queryRoutes from './routes/queryRoutes.js';
import authRoutes from './routes/authRoutes.js';
import { connectMongo } from './config/mongo.js';

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

app.use('/api/health', healthRoutes);
app.use('/api/schema', schemaRoutes);
app.use('/api/db', dbRoutes);
app.use('/api/query', queryRoutes);
app.use('/api/auth', authRoutes);

app.use((err, req, res, next) => {
  res.status(500).json({
    error: err.message || 'An unexpected server error occurred.'
  });
});

app.listen(port, () => {
  console.log(`ClarifySQL Backend running on http://localhost:${port}`);
});
