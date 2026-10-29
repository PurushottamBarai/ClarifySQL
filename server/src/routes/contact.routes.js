import { Router } from 'express';
import { submitContact } from '../controllers/contact.controller.js';

const router = Router();

// In-memory sliding rate limiter: 10 requests per 15 minutes per IP
const ipHits = new Map();
function contactRateLimit(req, res, next) {
  const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const windowMs = 15 * 60 * 1000;
  const hits = (ipHits.get(ip) || []).filter(time => now - time < windowMs);

  if (hits.length >= 10) {
    return res.status(429).json({
      error: 'Too many messages sent from this IP. Please try again after 15 minutes.'
    });
  }

  hits.push(now);
  ipHits.set(ip, hits);

  if (ipHits.size > 5000) {
    for (const [key, timestamps] of ipHits.entries()) {
      const active = timestamps.filter(time => now - time < windowMs);
      if (active.length === 0) {
        ipHits.delete(key);
      } else {
        ipHits.set(key, active);
      }
    }
  }

  next();
}

router.post('/', contactRateLimit, submitContact);

export default router;

