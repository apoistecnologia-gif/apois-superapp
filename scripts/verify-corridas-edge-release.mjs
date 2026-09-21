import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const releaseRoot = resolve(root, '.release/corridas-functions');
let failed = false;
const fail = (message) => { failed = true; console.error(`[FAIL] ${message}`); };
const ok = (message) => console.log(`[OK] ${message}`);

function load(slug) {
  const path = resolve(releaseRoot, slug, 'index.ts');
  if (!existsSync(path)) {
    fail(`bundle ausente: ${slug}/index.ts`);
    return '';
  }
  return readFileSync(path, 'utf8');
}

const requestRide = load('request-ride');
for (const marker of [
  'async function rollbackFailedDispatch(',
  'error_code: "dispatch_failed"',
  'request_key: null',
  'const driverDomainUserIds =',
  '.select("id,auth_user_id")',
]) {
  if (!requestRide.includes(marker)) fail(`request-ride perdeu hardening obrigatório: ${marker}`);
}
for (const forbidden of [
  '.from("subscriptions")',
  'activeSubscriptions',
  'subscriptionsError',
  'entitledDrivers',
  'console.log("[request-ride] google key loaded"',
  'prefix: mapsKey.slice',
]) {
  if (requestRide.includes(forbidden)) fail(`request-ride contém runtime proibido: ${forbidden}`);
}
if (requestRide) ok('request-ride: rollback, identity boundary e eligibility sem provider confirmados');

const driverAction = load('driver-ride-action');
for (const marker of [
  'const authUserId = authData.user?.id;',
  '.eq("auth_user_id", authUserId)',
  'const domainUserId = String(domainUser.id);',
  'const driverRecordId = String(driver.id);',
  'const finalPrice = Number(ride.final_price ?? ride.estimated_price ?? 0);',
  '.eq("driver_id", driverRecordId)',
]) {
  if (!driverAction.includes(marker)) fail(`driver-ride-action perdeu hardening obrigatório: ${marker}`);
}
for (const forbidden of ['finitePositive(body.final_price)', 'requestedFinalPrice', 'driver_id: userId']) {
  if (driverAction.includes(forbidden)) fail(`driver-ride-action ainda aceita autoridade indevida do cliente: ${forbidden}`);
}
if (driverAction) ok('driver-ride-action: AUTH→DOMAIN→DRIVER e preço server-authoritative confirmados');

const cancelRide = load('cancel-ride');
for (const marker of [
  'const authUserId = authData.user?.id;',
  '.eq("auth_user_id", authUserId)',
  'const passengerDomainUserId = String(domainUser.id);',
  'async function ensureCancellationFinancialState(',
  'cancellation_financial_reconciliation_failed',
  'feeError.code !== "23505"',
]) {
  if (!cancelRide.includes(marker)) fail(`cancel-ride perdeu hardening obrigatório: ${marker}`);
}
for (const forbidden of ['ride.passenger_id !== userId', 'cancelled_by: userId', 'passenger_id: userId,']) {
  if (cancelRide.includes(forbidden)) fail(`cancel-ride ainda mistura AUTH e DOMAIN: ${forbidden}`);
}
if (cancelRide) ok('cancel-ride: ownership DOMAIN e reconciliação idempotente confirmados');

const push = load('send-ride-push');
const hasModernNormalizer =
  push.includes('normalizeRecipientIds') ||
  push.includes('normalizeRecipientAuthIds');
if (!hasModernNormalizer) fail('send-ride-push sem normalização AUTH/DOMAIN de recipients');
for (const marker of [
  'auth_user_id',
  'user_notification_tokens',
]) {
  if (!push.includes(marker)) fail(`send-ride-push perdeu boundary obrigatório: ${marker}`);
}
if (push) ok('send-ride-push: recipients normalizados antes de tokens/FCM');

if (failed) process.exit(1);
ok('Corridas Edge release bundle apto para comparação/deploy controlado por slug.');
