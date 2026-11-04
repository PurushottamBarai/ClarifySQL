import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { isIP } from 'node:net';

const CONFIG_KEYS = new Set(['host', 'port', 'user', 'password', 'database', 'connectionString', 'ssl']);
const SSL_KEYS = new Set(['ca', 'minVersion', 'rejectUnauthorized', 'verifyIdentity']);

export class DatabaseConfigError extends Error {
  constructor(message = 'Invalid database configuration.') {
    super(message);
    this.name = 'DatabaseConfigError';
  }
}

export function positiveSetting(value, fallback, maximum = 2147483647) {
  if (value === undefined) return fallback;
  if (!/^\d+$/.test(String(value))) throw new DatabaseConfigError('Invalid database server settings.');
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 1 || number > maximum) {
    throw new DatabaseConfigError('Invalid database server settings.');
  }
  return number;
}

export function normalizeHost(value) {
  if (typeof value !== 'string' || !value || value.length > 253 || value !== value.trim()) {
    throw new DatabaseConfigError();
  }
  let host = value.toLowerCase();
  if (host.startsWith('[') && host.endsWith(']')) host = host.slice(1, -1);
  if (host.includes('%')) throw new DatabaseConfigError();
  if (isIP(host)) return host;
  host = host.replace(/\.$/, '');
  if (!host.split('.').every(label => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))) {
    throw new DatabaseConfigError();
  }
  return host;
}

function portNumber(value = 3306) {
  if ((typeof value !== 'number' && typeof value !== 'string') || !/^\d+$/.test(String(value))) {
    throw new DatabaseConfigError();
  }
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new DatabaseConfigError();
  return port;
}

function text(value, maximum, empty = false) {
  if (typeof value !== 'string' || value.length > maximum || (!empty && !value.length) || value.includes('\0')) {
    throw new DatabaseConfigError();
  }
  return value;
}

function approvedSsl(value) {
  if (value === undefined) return undefined;
  if (value === true) return { rejectUnauthorized: true, verifyIdentity: true, minVersion: 'TLSv1.2' };
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !SSL_KEYS.has(key))) {
    throw new DatabaseConfigError();
  }
  if ((value.rejectUnauthorized !== undefined && value.rejectUnauthorized !== true) ||
      (value.verifyIdentity !== undefined && value.verifyIdentity !== true) ||
      (value.minVersion !== undefined && !['TLSv1.2', 'TLSv1.3'].includes(value.minVersion))) {
    throw new DatabaseConfigError();
  }
  return {
    rejectUnauthorized: true,
    verifyIdentity: true,
    minVersion: value.minVersion || 'TLSv1.2',
    ...(value.ca === undefined ? {} : { ca: text(value.ca, 65536) })
  };
}

export function parseConnectionString(value) {
  try {
    text(value, 8192);
    const url = new URL(value);
    if (url.protocol !== 'mysql:' || url.hash || !url.pathname.startsWith('/') ||
        [...url.searchParams.keys()].some(key => !['ssl', 'sslmode'].includes(key)) ||
        url.searchParams.getAll('ssl').length > 1 || url.searchParams.getAll('sslmode').length > 1) {
      throw new DatabaseConfigError();
    }
    if (url.searchParams.has('sslmode') && !['require', 'verify-ca', 'verify-full'].includes(url.searchParams.get('sslmode'))) {
      throw new DatabaseConfigError();
    }
    const ssl = url.searchParams.has('ssl') ? approvedSsl(JSON.parse(url.searchParams.get('ssl'))) :
      (url.searchParams.has('sslmode') ? approvedSsl(true) : undefined);
    return validateDatabaseConfig({
      host: url.hostname,
      port: url.port || 3306,
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      database: decodeURIComponent(url.pathname.slice(1)),
      ...(ssl ? { ssl } : {})
    });
  } catch {
    throw new DatabaseConfigError();
  }
}

export function validateDatabaseConfig(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(key => !CONFIG_KEYS.has(key))) {
    throw new DatabaseConfigError();
  }
  if (input.connectionString !== undefined && input.connectionString !== '') {
    if (Object.keys(input).some(key => key !== 'connectionString' && input[key] !== undefined && input[key] !== '')) {
      throw new DatabaseConfigError();
    }
    return parseConnectionString(input.connectionString);
  }
  const ssl = approvedSsl(input.ssl);
  return {
    host: normalizeHost(input.host),
    port: portNumber(input.port),
    user: text(input.user, 128),
    password: text(input.password === undefined ? '' : input.password, 4096, true),
    database: text(input.database, 64),
    ...(ssl ? { ssl } : {})
  };
}

function encryptionKey(env) {
  const value = env.DATABASE_CONFIG_KEY;
  if (typeof value !== 'string' || !/^[A-Za-z0-9+/]{43}=$/.test(value)) {
    throw new DatabaseConfigError('Database credential encryption is not configured.');
  }
  const key = Buffer.from(value, 'base64');
  if (key.length !== 32 || key.toString('base64') !== value) {
    throw new DatabaseConfigError('Database credential encryption is not configured.');
  }
  return key;
}

export function assertDatabaseEncryptionConfigured(env = process.env) {
  encryptionKey(env);
}

export function encryptDatabaseConfig(input, { env = process.env, now = Date.now } = {}) {
  const config = validateDatabaseConfig(input);
  const ttl = positiveSetting(env.DATABASE_CONFIG_TTL_MS, 3600000);
  const expiresAt = now() + ttl;
  const iv = randomBytes(12);
  const header = `v1.${expiresAt}`;
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(env), iv);
  cipher.setAAD(Buffer.from(`clarifysql.database.${header}`));
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(config), 'utf8'), cipher.final()]);
  return `${header}.${iv.toString('base64url')}.${ciphertext.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}`;
}

export function decryptDatabaseConfig(encryptedConfig, { env = process.env, now = Date.now } = {}) {
  try {
    if (typeof encryptedConfig !== 'string' || encryptedConfig.length > 131072) throw new Error();
    const parts = encryptedConfig.split('.');
    if (parts.length !== 5 || parts[0] !== 'v1' || !/^[1-9]\d*$/.test(parts[1])) throw new Error();
    const expiresAt = Number(parts[1]);
    if (!Number.isSafeInteger(expiresAt) || expiresAt <= now()) throw new Error();
    const buffers = parts.slice(2).map(value => {
      if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error();
      const buffer = Buffer.from(value, 'base64url');
      if (buffer.toString('base64url') !== value) throw new Error();
      return buffer;
    });
    if (buffers[0].length !== 12 || buffers[2].length !== 16) throw new Error();
    const decipher = createDecipheriv('aes-256-gcm', encryptionKey(env), buffers[0]);
    decipher.setAAD(Buffer.from(`clarifysql.database.${parts[0]}.${parts[1]}`));
    decipher.setAuthTag(buffers[2]);
    const plaintext = Buffer.concat([decipher.update(buffers[1]), decipher.final()]);
    return validateDatabaseConfig(JSON.parse(plaintext.toString('utf8')));
  } catch {
    throw new DatabaseConfigError('Database configuration is invalid or expired. Reconnect to continue.');
  }
}

export function isDatabaseConfigValid(encryptedConfig, options) {
  try {
    decryptDatabaseConfig(encryptedConfig, options);
    return true;
  } catch {
    return false;
  }
}
