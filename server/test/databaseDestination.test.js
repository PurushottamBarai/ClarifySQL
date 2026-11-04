import test from 'node:test';
import assert from 'node:assert/strict';
import { validateDestination } from '../src/security/databaseDestination.js';

const config = { host: 'db.example.com', port: 3306 };
const resolver = (...addresses) => async (host, options) => {
  assert.equal(host, config.host);
  assert.deepEqual(options, { all: true, verbatim: true });
  return addresses.map(address => ({ address, family: address.includes(':') ? 6 : 4 }));
};

test('public destinations enforce TLS and exact hostname and port allowlists', async () => {
  const resolve = resolver('8.8.8.8', '2606:4700:4700::1111');
  const result = await validateDestination(config, { env: {}, resolve });
  assert.equal(result.address, '8.8.8.8');
  assert.equal(result.host, config.host);
  assert.deepEqual(result.ssl, { minVersion: 'TLSv1.2', rejectUnauthorized: true, verifyIdentity: true });
  await validateDestination({ ...config, port: 3307 }, {
    env: { DATABASE_ALLOWED_HOSTS: 'DB.EXAMPLE.COM.', DATABASE_ALLOWED_PORTS: '3306, 3307' }, resolve
  });
  for (const env of [
    { DATABASE_ALLOWED_HOSTS: 'example.com' }, { DATABASE_ALLOWED_HOSTS: '*.example.com' },
    { DATABASE_ALLOWED_HOSTS: '' }, { DATABASE_ALLOWED_PORTS: '' }, { DATABASE_ALLOWED_PORTS: '65536' }
  ]) await assert.rejects(validateDestination(config, { env, resolve }));
  await assert.rejects(validateDestination({ ...config, port: 3307 }, { env: {}, resolve }));
  await assert.rejects(validateDestination({ ...config, host: '8.8.8.8' }, { env: {} }), /DNS hostname/);
});

test('every DNS address is checked, including IPv4-mapped IPv6', async () => {
  for (const address of ['127.0.0.1', '10.0.0.1', '192.168.1.1', '172.16.1.1', '::1', 'fd12::1', '::ffff:127.0.0.1']) {
    await assert.rejects(validateDestination(config, { env: {}, resolve: resolver('8.8.8.8', address) }));
  }
  for (const addresses of [[], [{ address: '8.8.8.8', family: 6 }], [{ address: 'invalid', family: 4 }]]) {
    await assert.rejects(validateDestination(config, { env: {}, resolve: async () => addresses }));
  }
  await assert.rejects(validateDestination(config, { env: {}, resolve: async () => { throw new Error('DNS secret'); } }), error => {
    assert.ok(!error.message.includes('DNS secret'));
    return true;
  });
});

test('private network access requires opt-in, plus an exact allowlist in production', async () => {
  const resolve = resolver('10.0.0.1');
  const development = { DATABASE_ALLOW_PRIVATE_NETWORK: 'true' };
  const production = { ...development, NODE_ENV: 'production' };
  const privateResult = await validateDestination(config, { env: development, resolve });
  assert.equal(privateResult.ssl, undefined);
  assert.equal(privateResult.address, '10.0.0.1');
  await assert.rejects(validateDestination(config, { env: production, resolve }));
  await validateDestination(config, { env: { ...production, DATABASE_ALLOWED_HOSTS: config.host }, resolve });
  await assert.rejects(validateDestination(config, { env: { DATABASE_ALLOW_PRIVATE_NETWORK: 'TRUE' }, resolve }));
  const secured = await validateDestination({ ...config, ssl: { ca: 'approved-ca' } }, { env: development, resolve });
  assert.equal(secured.ssl.ca, 'approved-ca');
  assert.equal(secured.ssl.verifyIdentity, true);
  const literal = await validateDestination({ ...config, host: '127.0.0.1' }, { env: development });
  assert.equal(literal.address, '127.0.0.1');
});

test('metadata, link-local, reserved, multicast, and transition addresses stay blocked even with opt-in', async () => {
  const env = { NODE_ENV: 'production', DATABASE_ALLOW_PRIVATE_NETWORK: 'true', DATABASE_ALLOWED_HOSTS: config.host };
  for (const address of [
    '169.254.169.254', '169.254.1.1', '168.63.129.16', '100.100.100.200', '0.0.0.0', '224.0.0.1',
    '255.255.255.255', 'fe80::1', 'ff02::1', '::', 'fd00:ec2::254',
    '::ffff:169.254.169.254', '2002:7f00:1::', '64:ff9b::7f00:1'
  ]) await assert.rejects(validateDestination(config, { env, resolve: resolver(address) }), undefined, address);
});
