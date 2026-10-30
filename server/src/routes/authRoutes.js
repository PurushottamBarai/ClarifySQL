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

const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many password reset requests. Please try again later.' }
});

const resetPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
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
