import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import {
  validateDatabaseConfig, parseConnectionString, encryptDatabaseConfig,
  decryptDatabaseConfig, isDatabaseConfigValid
} from '../src/security/databaseConfig.js';

const env = { DATABASE_CONFIG_KEY: randomBytes(32).toString('base64'), DATABASE_CONFIG_TTL_MS: '1000' };
const config = { host: 'db.example.com', port: 3306, user: 'reader', password: 'sensitive-password', database: 'app' };
const options = { env, now: () => 1000 };

test('AES-GCM encrypts credentials with unique nonces and authenticated expiry', () => {
  const encrypted = encryptDatabaseConfig(config, options);
  assert.notEqual(encrypted, encryptDatabaseConfig(config, options));
  assert.ok(!encrypted.includes(config.password));
  assert.deepEqual(decryptDatabaseConfig(encrypted, options), config);
  assert.equal(isDatabaseConfigValid(encrypted, { env, now: () => 1999 }), true);
  assert.equal(isDatabaseConfigValid(encrypted, { env, now: () => 2000 }), false);
  for (let index = 0; index < 5; index++) {
    const parts = encrypted.split('.');
    parts[index] = index === 0 ? 'v2' : index === 1 ? '999999' : `${parts[index][0] === 'A' ? 'B' : 'A'}${parts[index].slice(1)}`;
    assert.throws(() => decryptDatabaseConfig(parts.join('.'), options), /invalid or expired/);
  }
});

test('invalid envelopes, wrong keys, and unsafe keys fail without credential leakage', () => {
  const encrypted = encryptDatabaseConfig(config, options);
  for (const value of [null, {}, '', 'v1', 'x'.repeat(131073), encrypted + '.extra']) {
    assert.equal(isDatabaseConfigValid(value, options), false);
  }
  assert.throws(() => decryptDatabaseConfig(encrypted, {
    env: { DATABASE_CONFIG_KEY: randomBytes(32).toString('base64') }, now: () => 1000
  }), /invalid or expired/);
  for (const key of [undefined, 'secret', randomBytes(31).toString('base64'), randomBytes(33).toString('base64')]) {
    assert.throws(() => encryptDatabaseConfig(config, { env: { DATABASE_CONFIG_KEY: key } }), /encryption is not configured/);
  }
  for (const ttl of ['0', '-1', 'NaN', '1.5', '2147483648']) {
    assert.throws(() => encryptDatabaseConfig(config, { env: { ...env, DATABASE_CONFIG_TTL_MS: ttl } }));
  }
});

test('validates credential types, bounds, port, and rejects arbitrary driver options', () => {
  assert.deepEqual(validateDatabaseConfig({ ...config, port: '3306', host: 'DB.EXAMPLE.COM.' }), config);
  for (const patch of [
    { host: null }, { host: 'a'.repeat(254) }, { host: 'db/host' }, { host: ' host' }, { host: 'fe80::1%eth0' },
    { port: 0 }, { port: 65536 }, { port: true }, { port: '3306x' }, { port: 1.5 },
    { user: 1 }, { user: '' }, { user: 'a'.repeat(129) }, { password: {} },
    { password: 'x'.repeat(4097) }, { database: '' }, { database: 'x'.repeat(65) },
    { multipleStatements: true }, { socketPath: '/tmp/mysql.sock' }, { stream: 'anything' },
    { ssl: false }, { ssl: { rejectUnauthorized: false } }, { ssl: { verifyIdentity: false } },
    { ssl: { minVersion: 'TLSv1' } }, { ssl: { key: 'secret' } }
  ]) assert.throws(() => validateDatabaseConfig({ ...config, ...patch }));
  assert.throws(() => validateDatabaseConfig(null));
  assert.equal(validateDatabaseConfig({ ...config, password: '' }).password, '');
});

test('connection strings are bounded and allow only verified TLS options', () => {
  const parsed = parseConnectionString('mysql://read%40er:p%3Ass@DB.EXAMPLE.COM:3307/app?sslmode=require');
  assert.equal(parsed.user, 'read@er');
  assert.equal(parsed.password, 'p:ss');
  assert.equal(parsed.port, 3307);
  assert.equal(parsed.ssl.rejectUnauthorized, true);
  assert.equal(parsed.ssl.verifyIdentity, true);
  for (const value of [
    null, 1, 'x'.repeat(8193), 'postgres://reader:secret@db.example.com/app',
    'mysql://reader:secret@db.example.com/app?ssl=false',
    'mysql://reader:secret@db.example.com/app?ssl={"rejectUnauthorized":false}',
    'mysql://reader:secret@db.example.com/app?sslmode=disable',
    'mysql://reader:secret@db.example.com/app?multipleStatements=true',
    'mysql://reader:secret@db.example.com/app?sslmode=require&sslmode=require',
    'mysql://reader:secret@db.example.com/app#secret',
    'mysql://reader:%ZZ@db.example.com/app', 'mysql://reader:secret@db.example.com:65536/app'
  ]) {
    assert.throws(() => parseConnectionString(value), error => {
      assert.equal(error.message, 'Invalid database configuration.');
      assert.ok(!error.message.includes('secret'));
      return true;
    });
  }
});

test('the existing form payload accepts an empty connection-string field', () => {
  assert.deepEqual(validateDatabaseConfig({ ...config, port: '3306', connectionString: '' }), config);
  assert.throws(() => validateDatabaseConfig({ ...config, connectionString: 'mysql://reader:secret@db.example.com/app' }));
  assert.deepEqual(validateDatabaseConfig({ ...config, ssl: { ca: 'certificate', minVersion: 'TLSv1.3' } }).ssl, {
    ca: 'certificate', minVersion: 'TLSv1.3', rejectUnauthorized: true, verifyIdentity: true
  });
});
