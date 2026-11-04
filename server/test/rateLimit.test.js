import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { createRateLimiter } from '../src/middleware/rateLimit.js';

function createResponse() {
  return {
    statusCode: 200,
    headers: {},
    body: undefined,
    set(name, value) { this.headers[name] = value; return this; },
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; }
  };
}

function useBuckets(handler) {
  const model = mongoose.models.RateLimitBucket;
  const original = model.findOneAndUpdate;
  model.findOneAndUpdate = handler;
  return () => { model.findOneAndUpdate = original; };
}

function memoryBuckets() {
  const counts = new Map();
  const calls = [];
  const restore = useBuckets(async (filter, update) => {
    calls.push({ filter, update });
    const count = (counts.get(filter._id) || 0) + 1;
    counts.set(filter._id, count);
    return { count };
  });
  return { counts, calls, restore };
}

async function hit(limiter, ip = '203.0.113.5') {
  const res = createResponse();
  let nextCalled = false;
  await limiter({ ip }, res, () => { nextCalled = true; });
  return { res, nextCalled };
}

test('allows requests up to the limit and rejects the next with Retry-After', async () => {
  const { restore } = memoryBuckets();
  try {
    const limiter = createRateLimiter({ name: 'unit_a', windowMs: 60000, max: 2, message: 'blocked' });
    assert.equal((await hit(limiter)).nextCalled, true);
    const second = await hit(limiter);
    assert.equal(second.nextCalled, true);
    assert.equal(second.res.headers['RateLimit-Remaining'], '0');

    const third = await hit(limiter);
    assert.equal(third.nextCalled, false);
    assert.equal(third.res.statusCode, 429);
    assert.deepEqual(third.res.body, { error: 'blocked' });
    assert.ok(Number(third.res.headers['Retry-After']) >= 1);
  } finally {
    restore();
  }
});

test('counts clients and limiter names independently', async () => {
  const { restore } = memoryBuckets();
  try {
    const first = createRateLimiter({ name: 'unit_b', windowMs: 60000, max: 1, message: 'blocked' });
    const second = createRateLimiter({ name: 'unit_c', windowMs: 60000, max: 1, message: 'blocked' });
    assert.equal((await hit(first, '203.0.113.1')).nextCalled, true);
    assert.equal((await hit(first, '203.0.113.2')).nextCalled, true);
    assert.equal((await hit(second, '203.0.113.1')).nextCalled, true);
    assert.equal((await hit(first, '203.0.113.1')).res.statusCode, 429);
  } finally {
    restore();
  }
});

test('sets an expiry at the end of the window using an atomic upsert', async () => {
  const { calls, restore } = memoryBuckets();
  try {
    const limiter = createRateLimiter({ name: 'unit_d', windowMs: 60000, max: 5, message: 'blocked' });
    await hit(limiter);
    const [{ filter, update }] = calls;
    assert.match(filter._id, /^unit_d:203\.0\.113\.5:\d+$/);
    assert.deepEqual(update.$inc, { count: 1 });
    assert.ok(update.$setOnInsert.expiresAt.getTime() > Date.now());
  } finally {
    restore();
  }
});

test('retries once on a duplicate key race', async () => {
  let attempts = 0;
  const restore = useBuckets(async () => {
    attempts += 1;
    if (attempts === 1) throw Object.assign(new Error('duplicate'), { code: 11000 });
    return { count: 1 };
  });
  try {
    const limiter = createRateLimiter({ name: 'unit_e', windowMs: 60000, max: 5, message: 'blocked' });
    assert.equal((await hit(limiter)).nextCalled, true);
    assert.equal(attempts, 2);
  } finally {
    restore();
  }
});

test('fails closed when the counter store is unavailable', async () => {
  const restore = useBuckets(async () => { throw new Error('store down'); });
  try {
    const limiter = createRateLimiter({ name: 'unit_f', windowMs: 60000, max: 5, message: 'blocked' });
    const { res, nextCalled } = await hit(limiter);
    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 503);
  } finally {
    restore();
  }
});

test('environment overrides replace defaults and invalid values are rejected', async () => {
  const { restore } = memoryBuckets();
  process.env.RATE_LIMIT_UNIT_G_MAX = '1';
  try {
    const limiter = createRateLimiter({ name: 'unit_g', windowMs: 60000, max: 50, message: 'blocked' });
    assert.equal((await hit(limiter)).nextCalled, true);
    assert.equal((await hit(limiter)).res.statusCode, 429);

    process.env.RATE_LIMIT_UNIT_H_MAX = '0';
    assert.throws(() => createRateLimiter({ name: 'unit_h', windowMs: 60000, max: 5, message: 'blocked' }), /Invalid/);
  } finally {
    delete process.env.RATE_LIMIT_UNIT_G_MAX;
    delete process.env.RATE_LIMIT_UNIT_H_MAX;
    restore();
  }
});
