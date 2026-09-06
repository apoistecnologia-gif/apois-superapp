import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const TTL_MS = 120_000;
const PASSENGER_KEY = 'apois-superapp:corridas-google-url';

function callbackKind(rawUrl) {
  try {
    const url = new URL(rawUrl);
    if (url.protocol === 'br.com.apois.app:' && url.hostname === 'auth' &&
        (url.pathname === '/callback' || url.pathname === '/corridas-google')) return 'passenger';
    if (url.protocol === 'apoismotorista:' && url.hostname === 'auth' && url.pathname === '/google') return 'driver';
  } catch { /* URL inválida */ }
  return null;
}

function validatePkceCallback(rawUrl, expectedKind) {
  if (callbackKind(rawUrl) !== expectedKind) return false;
  const params = new URL(rawUrl).searchParams;
  return Boolean(params.get('code')) && !params.has('access_token') && !params.has('refresh_token');
}

function consumePassenger(storage, now) {
  const raw = storage.getItem(PASSENGER_KEY);
  storage.removeItem(PASSENGER_KEY);
  if (!raw) return null;
  try {
    const envelope = JSON.parse(raw);
    const age = now - Number(envelope?.createdAt);
    return typeof envelope?.url === 'string' && age >= 0 && age <= TTL_MS &&
      validatePkceCallback(envelope.url, 'passenger') ? envelope.url : null;
  } catch {
    return null;
  }
}

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
}

async function finishDriver({ rawUrl, closeBrowser, exchange, profile }) {
  if (!validatePkceCallback(rawUrl, 'driver')) throw new Error('invalid_callback');
  await closeBrowser().catch(() => undefined);
  await exchange(new URL(rawUrl).searchParams.get('code'));
  const resolved = await profile();
  if (!resolved.ok) {
    if (resolved.reason === 'not_found') return '/motorista/cadastro';
    throw new Error(resolved.message || 'profile_invalid');
  }
  return resolved.approved ? '/motorista/app' : '/motorista/status';
}

const now = 2_000_000;
const validPassenger = 'br.com.apois.app://auth/callback?code=valid-code';
const storage = memoryStorage();

assert.equal(validatePkceCallback(validPassenger, 'passenger'), true, 'callback válido');
assert.equal(validatePkceCallback('br.com.apois.app://auth/callback', 'passenger'), false, 'callback sem code');
assert.equal(validatePkceCallback('br.com.apois.app://auth/callbackevil?code=x', 'passenger'), false, 'path inválido');
assert.equal(validatePkceCallback('br.com.apois.app://auth/callback?access_token=a&refresh_token=b', 'passenger'), false, 'tokens rejeitados');

storage.setItem(PASSENGER_KEY, JSON.stringify({ url: validPassenger, createdAt: now }));
assert.equal(consumePassenger(storage, now), validPassenger, 'callback anterior ao mount é consumido');
assert.equal(consumePassenger(storage, now), null, 'callback é consume-once/duplicado');
storage.setItem(PASSENGER_KEY, JSON.stringify({ url: validPassenger, createdAt: now - TTL_MS - 1 }));
assert.equal(consumePassenger(storage, now), null, 'callback expirado');
assert.equal(validatePkceCallback(validPassenger, 'passenger'), true, 'callback posterior ao mount pode seguir em memória');

const driverUrl = 'apoismotorista://auth/google?code=driver-code';
assert.equal(await finishDriver({
  rawUrl: driverUrl,
  closeBrowser: async () => { throw new Error('close failed'); },
  exchange: async (code) => assert.equal(code, 'driver-code'),
  profile: async () => ({ ok: true, approved: true }),
}), '/motorista/app', 'falha de Browser.close não bloqueia exchange');
await assert.rejects(
  finishDriver({ rawUrl: driverUrl, closeBrowser: async () => {}, exchange: async () => { throw new Error('exchange failed'); }, profile: async () => ({ ok: true }) }),
  /exchange failed/,
  'falha do exchange é propagada',
);
await assert.rejects(
  finishDriver({ rawUrl: driverUrl, closeBrowser: async () => {}, exchange: async () => {}, profile: async () => { throw new Error('profile failed'); } }),
  /profile failed/,
  'falha de profile é propagada',
);
await assert.rejects(
  finishDriver({ rawUrl: driverUrl, closeBrowser: async () => {}, exchange: async () => {}, profile: async () => ({ ok: false, reason: 'role_incompatible', message: 'incompatible_role' }) }),
  /incompatible_role/,
  'role incompatível é negada',
);

const passengerSource = readFileSync(resolve('.work/corridas/src/components/auth/PassengerGoogleLoginButton.tsx'), 'utf8');
const driverSource = readFileSync(resolve('.work/motorista/src/components/DriverGoogleLoginButton.tsx'), 'utf8');
const shellSource = readFileSync(resolve('superapp/shell/index.html'), 'utf8');
for (const [label, source] of [['passageiro', passengerSource], ['motorista', driverSource]]) {
  assert.match(source, /exchangeCodeForSession\(code\)/, `${label}: exchange PKCE`);
  assert.match(source, /google_callback_tokens_rejected/, `${label}: rejeita tokens no callback`);
  assert.doesNotMatch(source, /auth\.setSession\(/, `${label}: sem fallback de sessão por tokens`);
  assert.match(source, /\.remove\(\)/, `${label}: listener possui cleanup`);
}
assert.match(passengerSource, /consumeForwardedCallback/, 'passageiro: callback sobrevivente ao mount');
assert.match(passengerSource, /CALLBACK_TTL_MS = 120_000/, 'passageiro: TTL explícito');
assert.match(driverSource, /if \(!profile\.ok\)/, 'motorista: profile obrigatório antes da navegação');
assert.match(driverSource, /profile\.reason === "not_found"/, 'motorista: ausência de cadastro segue para onboarding');
assert.match(shellSource, /clearExpiredCorridasGoogle\(\)/, 'shell: purge de callback expirado no relaunch');
assert.match(shellSource, /localStorage\.getItem\(CORRIDAS_GOOGLE_KEY\)===envelope/, 'shell: timer não remove callback mais novo');

console.log('[PASS] contratos locais de OAuth Corridas validados');
