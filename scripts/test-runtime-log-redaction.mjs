import assert from 'node:assert/strict';
import { createSafeRuntimeLogger, redactRuntimeLogValue, safeRuntimeContext } from './runtime-log-redaction.mjs';

const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.signature';
const input = {
  authorization: 'Bearer super-secret-token',
  access_token: 'access-123',
  refreshToken: 'refresh-456',
  oauthCode: 'oauth-code',
  code_verifier: 'pkce-verifier',
  serviceRoleKey: 'service-role-secret',
  webhookSecret: 'webhook-secret',
  private_key: '-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----',
  nested: {
    jwt,
    latitude: -8.123456,
    longitude: -40.654321,
    email: 'pessoa@example.com',
    orderId: 'order-123',
    correlationId: 'corr-456',
    status: 'provider_timeout',
  },
};

const redacted = safeRuntimeContext(input);
assert.equal(redacted.authorization, '[REDACTED]');
assert.equal(redacted.access_token, '[REDACTED]');
assert.equal(redacted.refreshToken, '[REDACTED]');
assert.equal(redacted.oauthCode, '[REDACTED]');
assert.equal(redacted.code_verifier, '[REDACTED]');
assert.equal(redacted.serviceRoleKey, '[REDACTED]');
assert.equal(redacted.webhookSecret, '[REDACTED]');
assert.equal(redacted.private_key, '[REDACTED]');
assert.equal(redacted.nested.jwt, '[REDACTED]');
assert.equal(redacted.nested.latitude, '[PRECISE_LOCATION_REDACTED]');
assert.equal(redacted.nested.longitude, '[PRECISE_LOCATION_REDACTED]');
assert.equal(redacted.nested.email, '[PERSONAL_DATA_REDACTED]');
assert.equal(redacted.nested.orderId, 'order-123');
assert.equal(redacted.nested.correlationId, 'corr-456');
assert.equal(redacted.nested.status, 'provider_timeout');

assert.equal(redactRuntimeLogValue('Bearer abc.def.ghi'), '[REDACTED]');
assert.equal(redactRuntimeLogValue(jwt), '[REDACTED]');
assert.equal(redactRuntimeLogValue('APP_USR-abcdefghijklmnopqrstuvwxyz0123456789'), '[REDACTED]');
assert.deepEqual(
  safeRuntimeContext({ latitude: -8.1, email: 'x@y.z' }, { allowPreciseLocation: true, allowPersonalData: true }),
  { latitude: -8.1, email: 'x@y.z' },
);

const captured = [];
const fakeConsole = {
  log: (...args) => captured.push(['log', ...args]),
  warn: (...args) => captured.push(['warn', ...args]),
  error: (...args) => captured.push(['error', ...args]),
};
const logger = createSafeRuntimeLogger(fakeConsole);
logger.error('payment.reconcile_failed', {
  correlationId: 'payment-42',
  authorization: 'Bearer should-not-leak',
  providerStatus: 502,
});
assert.deepEqual(captured[0], [
  'error',
  'payment.reconcile_failed',
  { correlationId: 'payment-42', authorization: '[REDACTED]', providerStatus: 502 },
]);

console.log('[OK] runtime log redaction tests passed');
