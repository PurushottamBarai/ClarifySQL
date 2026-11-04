import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import ipaddr from 'ipaddr.js';
import { DatabaseConfigError, normalizeHost } from './databaseConfig.js';

function blocked() {
  return new DatabaseConfigError('Database destination is not permitted.');
}

function addressKind(address) {
  if (!isIP(address) || address.includes('%')) throw blocked();
  let parsed = ipaddr.parse(address);
  if (parsed.kind() === 'ipv6' && parsed.isIPv4MappedAddress()) parsed = parsed.toIPv4Address();
  if (['168.63.129.16', 'fd00:ec2::254'].includes(parsed.toString())) throw blocked();
  const range = parsed.range();
  if (range === 'unicast') return 'public';
  if (['private', 'loopback', 'uniqueLocal'].includes(range)) return 'private';
  throw blocked();
}

export async function validateDestination(config, { env = process.env, resolve = lookup } = {}) {
  const host = normalizeHost(config.host);
  const allowedHosts = env.DATABASE_ALLOWED_HOSTS === undefined ? null :
    env.DATABASE_ALLOWED_HOSTS.split(',').map(value => normalizeHost(value.trim()));
  if (allowedHosts && !allowedHosts.includes(host)) throw blocked();
  const allowedPorts = (env.DATABASE_ALLOWED_PORTS ?? '3306').split(',').map(value => {
    if (!/^\d+$/.test(value.trim())) throw blocked();
    const port = Number(value);
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw blocked();
    return port;
  });
  if (!allowedPorts.includes(config.port)) throw blocked();
  const privateAllowed = env.DATABASE_ALLOW_PRIVATE_NETWORK === 'true' &&
    (env.NODE_ENV !== 'production' || Boolean(allowedHosts?.length));
  let addresses;
  try {
    addresses = isIP(host) ? [{ address: host, family: isIP(host) }] : await resolve(host, { all: true, verbatim: true });
  } catch {
    throw blocked();
  }
  if (!Array.isArray(addresses) || !addresses.length || addresses.length > 64) throw blocked();
  let hasPublic = false;
  for (const entry of addresses) {
    if (!entry || isIP(entry.address) !== entry.family) throw blocked();
    const kind = addressKind(entry.address);
    if (kind === 'private' && !privateAllowed) throw blocked();
    hasPublic ||= kind === 'public';
  }
  const tlsRequired = hasPublic || Boolean(config.ssl);
  // mysql2 omits IP identity verification when it omits SNI for an IP host.
  if (tlsRequired && isIP(host)) {
    throw new DatabaseConfigError('TLS database connections require a DNS hostname.');
  }
  return {
    host,
    address: addresses[0].address,
    family: addresses[0].family,
    ssl: tlsRequired ? { ...config.ssl, minVersion: config.ssl?.minVersion || 'TLSv1.2', rejectUnauthorized: true, verifyIdentity: true } : undefined
  };
}
