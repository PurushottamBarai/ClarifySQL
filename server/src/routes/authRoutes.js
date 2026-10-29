import { Router } from 'express';
import {
  githubRedirect,
  githubCallback,
  googleRedirect,
  googleCallback,
  getMe,
  logout,
  signup,
  login
} from '../controllers/auth.controller.js';

const router = Router();

router.get('/me', getMe);
router.post('/signup', signup);
router.post('/login', login);
router.post('/logout', logout);
router.get('/github', githubRedirect);
router.get('/github/callback', githubCallback);
router.get('/google', googleRedirect);
router.get('/google/callback', googleCallback);

export default router;
