import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';
import { sendPasswordResetEmail } from '../services/email.service.js';
import {
  getGitHubAuthUrl,
  exchangeGitHubCode,
  getGoogleAuthUrl,
  exchangeGoogleCode,
  findOrCreateOAuthUser
} from '../services/oauth.service.js';

const COOKIE_NAME = 'token';
const JWT_EXPIRES_IN = '7d';
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;
const RESET_TOKEN_BYTES = 32;
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;
const RESET_TOKEN_PATTERN = /^[a-f0-9]{64}$/i;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function generateToken(userId) {
  return jwt.sign(
    { id: userId },
    process.env.JWT_SECRET || 'clarifysql_jwt_secret_dev_key_32chars',
    { expiresIn: JWT_EXPIRES_IN }
  );
}

function setAuthCookie(res, token) {
  const isProduction = process.env.NODE_ENV === 'production';
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    maxAge: COOKIE_MAX_AGE,
    path: '/'
  });
}

function getCallbackUrl(req, provider) {
  if (provider === 'google' && process.env.GOOGLE_CALLBACK_URL) {
    return process.env.GOOGLE_CALLBACK_URL;
  }
  if (provider === 'github' && process.env.GITHUB_CALLBACK_URL) {
    return process.env.GITHUB_CALLBACK_URL;
  }
  if (process.env.CLIENT_URL) {
    return `${process.env.CLIENT_URL.replace(/\/+$/, '')}/api/auth/${provider}/callback`;
  }
  const proto = req.get('x-forwarded-proto') || req.protocol || 'http';
  const protocol = proto.includes('https') ? 'https' : 'http';
  const host = req.get('host');
  return `${protocol}://${host}/api/auth/${provider}/callback`;
}

function getClientRedirectBase(req) {
  if (process.env.CLIENT_URL) {
    return process.env.CLIENT_URL.replace(/\/+$/, '');
  }
  const forwardedProto = (req.get('x-forwarded-proto') || '').split(',')[0].trim();
  const protocol = forwardedProto === 'https' || req.protocol === 'https' ? 'https' : 'http';
  const host = req.get('host') || 'localhost:5173';
  return `${protocol}://${host}`;
}

export async function githubRedirect(req, res) {
  try {
    const callbackUrl = getCallbackUrl(req, 'github');
    const url = getGitHubAuthUrl(callbackUrl);
    return res.redirect(url);
  } catch (err) {
    console.error('GitHub redirect error:', err);
    const clientUrl = getClientRedirectBase(req);
    return res.redirect(`${clientUrl}?error=oauth_unconfigured`);
  }
}

export async function githubCallback(req, res) {
  try {
    const { code, error } = req.query;
    if (error || !code) throw new Error(error || 'Authorization code missing');
    const callbackUrl = getCallbackUrl(req, 'github');
    const profile = await exchangeGitHubCode(code, callbackUrl);
    const user = await findOrCreateOAuthUser(profile);
    const token = generateToken(user._id);
    setAuthCookie(res, token);
    if (req.session) {
      req.session.user = {
        id: user._id,
        name: user.name,
        email: user.email,
        avatarUrl: user.avatarUrl,
        authProvider: user.authProvider
      };
    }
    const clientUrl = getClientRedirectBase(req);
    return res.redirect(`${clientUrl}/`);
  } catch (err) {
    console.error('GitHub callback error:', err);
    const clientUrl = getClientRedirectBase(req);
    return res.redirect(`${clientUrl}/?error=oauth_failed`);
  }
}

export async function googleRedirect(req, res) {
  try {
    const callbackUrl = getCallbackUrl(req, 'google');
    const url = getGoogleAuthUrl(callbackUrl);
    return res.redirect(url);
  } catch (err) {
    console.error('Google redirect error:', err);
    const clientUrl = getClientRedirectBase(req);
    return res.redirect(`${clientUrl}?error=oauth_unconfigured`);
  }
}

export async function googleCallback(req, res) {
  try {
    const { code, error } = req.query;
    if (error || !code) throw new Error(error || 'Authorization code missing');
    const callbackUrl = getCallbackUrl(req, 'google');
    const profile = await exchangeGoogleCode(code, callbackUrl);
    const user = await findOrCreateOAuthUser(profile);
    const token = generateToken(user._id);
    setAuthCookie(res, token);
    if (req.session) {
      req.session.user = {
        id: user._id,
        name: user.name,
        email: user.email,
        avatarUrl: user.avatarUrl,
        authProvider: user.authProvider
      };
    }
    const clientUrl = getClientRedirectBase(req);
    return res.redirect(`${clientUrl}/`);
  } catch (err) {
    console.error('Google callback error:', err);
    const clientUrl = getClientRedirectBase(req);
    return res.redirect(`${clientUrl}/?error=oauth_failed`);
  }
}

export async function getMe(req, res) {
  try {
    let user = null;
    const token = req.cookies?.token;
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'clarifysql_jwt_secret_dev_key_32chars');
        user = await User.findById(decoded.id);
      } catch (_) {}
    }
    if (!user && req.session?.user) {
      user = await User.findById(req.session.user.id);
    }
    if (!user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    return res.status(200).json({
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        avatarUrl: user.avatarUrl,
        authProvider: user.authProvider,
        createdAt: user.createdAt
      }
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, storedHash) {
  if (!storedHash || !storedHash.includes(':')) return false;
  const [salt, key] = storedHash.split(':');
  const keyBuffer = Buffer.from(key, 'hex');
  const derivedKey = crypto.scryptSync(password, salt, 64);
  return crypto.timingSafeEqual(keyBuffer, derivedKey);
}

export async function signup(req, res) {
  try {
    const { name, email, password, acceptedTerms } = req.body;
    if (!name || !name.trim() || !email || !password) {
      return res.status(400).json({ error: 'Name, email and password are required' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters long' });
    }
    if (acceptedTerms !== true) {
      return res.status(400).json({ error: 'You must accept the Terms of Service and Privacy Policy' });
    }
    const cleanEmail = email.toLowerCase().trim();
    const existing = await User.findOne({ email: cleanEmail });
    if (existing) {
      return res.status(400).json({ error: 'An account with this email already exists' });
    }

    const passwordHash = hashPassword(password);
    const user = await User.create({
      name: (name || cleanEmail.split('@')[0]).trim(),
      email: cleanEmail,
      passwordHash,
      authProvider: 'local',
      termsAcceptedAt: new Date()
    });

    const token = generateToken(user._id);
    setAuthCookie(res, token);
    if (req.session) {
      req.session.user = {
        id: user._id,
        name: user.name,
        email: user.email,
        authProvider: user.authProvider
      };
    }

    return res.status(201).json({
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        authProvider: user.authProvider
      }
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

export async function login(req, res) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    const cleanEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: cleanEmail });
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    if (!user.passwordHash) {
      return res.status(400).json({
        error: `This account was registered using ${user.authProvider || 'OAuth'}. Please sign in with that provider.`
      });
    }
    const valid = verifyPassword(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = generateToken(user._id);
    setAuthCookie(res, token);
    if (req.session) {
      req.session.user = {
        id: user._id,
        name: user.name,
        email: user.email,
        authProvider: user.authProvider
      };
    }

    return res.status(200).json({
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        authProvider: user.authProvider
      }
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

export async function logout(req, res) {
  const isProduction = process.env.NODE_ENV === 'production';
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    path: '/'
  });
  if (req.session) {
    req.session.user = null;
  }
  return res.status(200).json({ message: 'Logged out successfully' });
}

function hashResetToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function buildResetUrl(req, token) {
  const baseUrl = getClientRedirectBase(req).replace(/\/+$/, '');
  return `${baseUrl}/reset-password/${token}`;
}

export async function forgotPassword(req, res) {
  try {
    const { email } = req.body || {};
    if (!email || typeof email !== 'string' || !EMAIL_PATTERN.test(email.trim())) {
      return res.status(400).json({ error: 'Enter a valid email address' });
    }

    const cleanEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: cleanEmail });

    if (user && user.passwordHash) {
      const resetToken = crypto.randomBytes(RESET_TOKEN_BYTES).toString('hex');
      user.resetPasswordToken = hashResetToken(resetToken);
      user.resetPasswordExpires = new Date(Date.now() + RESET_TOKEN_TTL_MS);
      await user.save();

      await sendPasswordResetEmail({
        to: user.email,
        resetUrl: buildResetUrl(req, resetToken)
      });
    }

    return res.status(200).json({
      message: 'If an account with that email exists, a password reset link has been sent.'
    });
  } catch (err) {
    console.error('Forgot password error:', err);
    return res.status(500).json({ error: 'Unable to process the password reset request' });
  }
}

export async function resetPassword(req, res) {
  try {
    const { token } = req.params;
    const { password } = req.body || {};

    if (!token || !RESET_TOKEN_PATTERN.test(token)) {
      return res.status(400).json({ error: 'Password reset link is invalid or has expired' });
    }
    if (!password || typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters long' });
    }

    const user = await User.findOne({
      resetPasswordToken: hashResetToken(token),
      resetPasswordExpires: { $gt: new Date() }
    }).select('+resetPasswordToken +resetPasswordExpires');

    if (!user) {
      return res.status(400).json({ error: 'Password reset link is invalid or has expired' });
    }

    user.passwordHash = hashPassword(password);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    return res.status(200).json({ message: 'Password has been reset successfully' });
  } catch (err) {
    console.error('Reset password error:', err);
    return res.status(500).json({ error: 'Unable to reset the password' });
  }
}
