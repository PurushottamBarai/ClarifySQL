import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import {
  githubRedirect,
  githubCallback,
  googleRedirect,
  googleCallback,
  getMe,
  logout,
  signup,
  login,
  forgotPassword,
  resetPassword
} from '../controllers/auth.controller.js';

function positiveIntegerSetting(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  if (!/^[1-9]\d*$/.test(raw) || !Number.isSafeInteger(Number(raw))) {
    throw new Error(`Invalid ${name}`);
  }
  return Number(raw);
}

const resetRateLimitWindowMs = positiveIntegerSetting('RESET_RATE_LIMIT_WINDOW_MS', 15 * 60 * 1000);

const forgotPasswordLimiter = rateLimit({
  windowMs: resetRateLimitWindowMs,
  max: positiveIntegerSetting('RESET_REQUEST_RATE_LIMIT_MAX', 5),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many password reset requests. Please try again later.' }
});

const resetPasswordLimiter = rateLimit({
  windowMs: resetRateLimitWindowMs,
  max: positiveIntegerSetting('RESET_ATTEMPT_RATE_LIMIT_MAX', 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many password reset attempts. Please try again later.' }
});

const router = Router();

router.get('/me', getMe);
router.post('/signup', signup);
router.post('/login', login);
router.post('/logout', logout);
router.post('/forgot-password', forgotPasswordLimiter, forgotPassword);
router.post('/reset-password/:token', resetPasswordLimiter, resetPassword);
router.get('/github', githubRedirect);
router.get('/github/callback', githubCallback);
router.get('/google', googleRedirect);
router.get('/google/callback', googleCallback);

export default router;
