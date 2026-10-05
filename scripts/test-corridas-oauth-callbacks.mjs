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
  const codes = params.getAll('code');
  return codes.length === 1 && Boolean(codes[0]?.trim()) && !params.has('access_token') && !params.has('refresh_token');
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
  await exchange(new URL(rawUrl).searchParams.getAll('code')[0]);
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
assert.equal(validatePkceCallback('br.com.apois.app://auth/callback?code=a&code=b', 'passenger'), false, 'callback com code duplicado');
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

function extractNamedFunction(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `função real ${name} presente`);
  const bodyStart = source.indexOf('{', start);
  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}') depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }
  throw new Error(`função ${name} não terminada`);
}

function executable(functionSource) {
  return functionSource
    .replace(/let stored:\s*string\s*\|\s*null/, 'let stored')
    .replaceAll(': string', '')
    .replaceAll(': URLSearchParams', '')
    .replace(' as { url?: unknown; createdAt?: unknown }', '');
}

const actualPassengerUri = new Function(
  'CALLBACK',
  'LEGACY_CALLBACK',
  `return (${executable(extractNamedFunction(passengerSource, 'isCorridasCallback'))});`,
)('br.com.apois.app://auth/callback', 'br.com.apois.app://auth/corridas-google');
const actualDriverUri = new Function(
  `return (${executable(extractNamedFunction(driverSource, 'isDriverCallback'))});`,
)();
const actualPassengerSingleCode = new Function(
  `return (${executable(extractNamedFunction(passengerSource, 'singlePkceCode'))});`,
)();
const actualDriverSingleCode = new Function(
  `return (${executable(extractNamedFunction(driverSource, 'singlePkceCode'))});`,
)();
const actualParamsFrom = new Function(
  `return (${executable(extractNamedFunction(passengerSource, 'paramsFrom'))});`,
)();

for (const invalid of [
  'not a uri',
  'https://auth/callback?code=x',
  'br.com.apois.app://auth.example/callback?code=x',
  'br.com.apois.app://auth/callback-prefix?code=x',
  'br.com.apois.app://auth/callback/suffix?code=x',
  'apoismotorista://auth/google?code=x',
]) assert.equal(actualPassengerUri(invalid), false, `passageiro rejeita ${invalid}`);
assert.equal(actualPassengerUri(validPassenger), true, 'validador real aceita callback Passageiro');

for (const invalid of [
  'not a uri',
  'https://auth/google?code=x',
  'apoismotorista://auth.example/google?code=x',
  'apoismotorista://auth/google-prefix?code=x',
  'apoismotorista://auth/google/suffix?code=x',
  validPassenger,
]) assert.equal(actualDriverUri(invalid), false, `motorista rejeita ${invalid}`);
assert.equal(actualDriverUri(driverUrl), true, 'validador real aceita callback Motorista');

for (const [label, singleCode] of [['passageiro', actualPassengerSingleCode], ['motorista', actualDriverSingleCode]]) {
  assert.equal(singleCode(new URLSearchParams('code=one')), 'one', `${label}: code único aceito`);
  assert.equal(singleCode(new URLSearchParams('')), null, `${label}: code ausente rejeitado`);
  assert.equal(singleCode(new URLSearchParams('code=')), null, `${label}: code vazio rejeitado`);
  assert.equal(singleCode(new URLSearchParams('code=one&code=two')), null, `${label}: code duplicado rejeitado`);
  assert.equal(singleCode(new URLSearchParams('code=one&unexpected=safe')), 'one', `${label}: parâmetro adicional não cria ambiguidade`);
}

const actualConsumer = new Function(
  'window', 'FORWARDED_KEY', 'CALLBACK_TTL_MS', 'isCorridasCallback', 'paramsFrom', 'singlePkceCode',
  `return (${executable(extractNamedFunction(passengerSource, 'consumeForwardedCallback'))});`,
)({ localStorage: storage }, PASSENGER_KEY, TTL_MS, actualPassengerUri, actualParamsFrom, actualPassengerSingleCode);
const actualNow = Date.now();
storage.setItem(PASSENGER_KEY, JSON.stringify({ url: validPassenger, createdAt: actualNow }));
assert.equal(actualConsumer(), validPassenger, 'consumer real aceita envelope válido');
assert.equal(actualConsumer(), null, 'consumer real impede replay');
storage.setItem(PASSENGER_KEY, JSON.stringify({ url: validPassenger, createdAt: actualNow - TTL_MS - 1 }));
assert.equal(actualConsumer(), null, 'consumer real rejeita e remove envelope expirado');
const callbackA = 'br.com.apois.app://auth/callback?code=A';
const callbackB = 'br.com.apois.app://auth/callback?code=B';
storage.setItem(PASSENGER_KEY, JSON.stringify({ url: callbackA, createdAt: Date.now() }));
storage.setItem(PASSENGER_KEY, JSON.stringify({ url: callbackB, createdAt: Date.now() }));
assert.equal(actualConsumer(), callbackB, 'concorrência usa explicitamente o callback mais recente');

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
assert.ok(passengerSource.indexOf('providerError') < passengerSource.indexOf('const code = singlePkceCode(params)'), 'erro OAuth precede exchange Passageiro');
assert.ok(driverSource.indexOf('providerError') < driverSource.indexOf('const code = singlePkceCode(params)'), 'erro OAuth precede exchange Motorista');
assert.match(shellSource, /clearExpiredCorridasGoogle\(\)/, 'shell: purge de callback expirado no relaunch');
assert.match(shellSource, /localStorage\.getItem\(CORRIDAS_GOOGLE_KEY\)===envelope/, 'shell: timer não remove callback mais novo');
assert.equal(shellSource.includes('let shellAppUrlListenerHandle=null;'), true, 'shell mantém handle do appUrlOpen');
assert.equal(shellSource.includes('removeShellAppUrlListener();'), true, 'shell remove listener antes de entrar no módulo');
assert.equal(shellSource.includes("lastModule==='corridas'"), true, 'shell usa último módulo Corridas como fallback de ownership');
assert.equal(shellSource.includes('callback OAuth genérico sem proprietário; não redirecionando para outro produto'), true, 'shell não desvia callback genérico órfão para Entregas');


console.log('[PASS] contratos locais de OAuth Corridas validados');
