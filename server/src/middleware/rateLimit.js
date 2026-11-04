import mongoose from 'mongoose';

const bucketSchema = new mongoose.Schema({
  _id: String,
  count: { type: Number, required: true },
  expiresAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } }
});

const RateLimitBucket = mongoose.models.RateLimitBucket || mongoose.model('RateLimitBucket', bucketSchema);

function integerSetting(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  if (!/^[1-9]\d*$/.test(raw) || !Number.isSafeInteger(Number(raw))) {
    throw new Error(`Invalid ${name}`);
  }
  return Number(raw);
}

async function increment(id, expiresAt) {
  const update = { $inc: { count: 1 }, $setOnInsert: { expiresAt } };
  const options = { upsert: true, new: true };
  try {
    return await RateLimitBucket.findOneAndUpdate({ _id: id }, update, options);
  } catch (error) {
    if (error?.code !== 11000) throw error;
    return RateLimitBucket.findOneAndUpdate({ _id: id }, update, options);
  }
}

export function createRateLimiter({ name, windowMs, max, message }) {
  const envName = name.toUpperCase().replace(/[^A-Z0-9]/g, '_');
  const windowSize = integerSetting(`RATE_LIMIT_${envName}_WINDOW_MS`, windowMs);
  const limit = integerSetting(`RATE_LIMIT_${envName}_MAX`, max);

  return async function rateLimit(req, res, next) {
    try {
      const now = Date.now();
      const windowStart = Math.floor(now / windowSize) * windowSize;
      const windowEnd = windowStart + windowSize;
      const bucket = await increment(`${name}:${req.ip}:${windowStart}`, new Date(windowEnd));

      res.set('RateLimit-Limit', String(limit));
      res.set('RateLimit-Remaining', String(Math.max(0, limit - bucket.count)));

      if (bucket.count > limit) {
        res.set('Retry-After', String(Math.ceil((windowEnd - now) / 1000)));
        return res.status(429).json({ error: message });
      }
      return next();
    } catch {
      return res.status(503).json({ error: 'Rate limiting is unavailable.' });
    }
  };
}

const MINUTE = 60 * 1000;

export const loginLimiter = createRateLimiter({
  name: 'login',
  windowMs: 15 * MINUTE,
  max: 10,
  message: 'Too many login attempts. Please try again later.'
});

export const signupLimiter = createRateLimiter({
  name: 'signup',
  windowMs: 60 * MINUTE,
  max: 10,
  message: 'Too many signup attempts. Please try again later.'
});

export const queryLimiter = createRateLimiter({
  name: 'query',
  windowMs: MINUTE,
  max: 20,
  message: 'Too many query requests. Please slow down.'
});

export const dbConnectLimiter = createRateLimiter({
  name: 'db_connect',
  windowMs: 15 * MINUTE,
  max: 20,
  message: 'Too many database connection attempts. Please try again later.'
});

export const contactLimiter = createRateLimiter({
  name: 'contact',
  windowMs: 15 * MINUTE,
  max: 10,
  message: 'Too many messages sent from this IP. Please try again after 15 minutes.'
});
