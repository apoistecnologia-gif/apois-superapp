import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

let failed = false;
const root = process.cwd();
function fail(message) { failed = true; console.error(`[FAIL] ${message}`); }
function ok(message) { console.log(`[OK] ${message}`); }
function read(relative) { const p = resolve(root, relative); return existsSync(p) ? readFileSync(p, 'utf8') : ''; }

const hardener = read('scripts/harden-corridas-auth-profile-resolution.mjs');
for (const marker of ['.eq("auth_user_id", userId)', '"loading_profile"', '"profile_missing"', 'profile?.id ?? null', 'resolvedProfile === undefined']) {
  if (!hardener.includes(marker)) fail(`hardener de profile sem ${marker}`);
}

const googleHardener = read('scripts/harden-corridas-superapp-google-auth.mjs');
for (const marker of ['flowType: "pkce"', 'handledUrlRef.current === rawUrl', 'browserFinished', 'App.getLaunchUrl()', 'browserFinishedListenerRef.current?.remove()']) {
  if (!googleHardener.includes(marker)) fail(`Google OAuth hardener sem ${marker}`);
}
if (!googleHardener.includes('br.com.apois.app://auth/callback')) fail('callback canônico Google ausente');
if (!googleHardener.includes('br.com.apois.app://auth/corridas-google')) fail('callback legado compatível ausente');

const oauthHandoffHardener = read('scripts/harden-corridas-oauth-callback-handoff.mjs');
for (const marker of ['CALLBACK_TTL_MS', 'consumeForwardedCallback', 'google_callback_tokens_rejected', '[CALLBACK, LEGACY_CALLBACK].some']) {
  if (!oauthHandoffHardener.includes(marker)) fail(`hardener final Google Passageiro sem ${marker}`);
}
const buildPipeline = read('scripts/build-isolated-module.mjs');
if (!buildPipeline.includes("harden-corridas-oauth-callback-handoff.mjs")) fail('build Corridas não executa hardener final do callback');
const identityStep = buildPipeline.indexOf("harden-corridas-backend-identity-boundary.mjs");
const cancellationStep = buildPipeline.indexOf("harden-corridas-cancellation-policy.mjs");
const lifecycleStep = buildPipeline.indexOf("harden-corridas-ride-lifecycle.mjs");
const eligibilityStep = buildPipeline.indexOf("harden-corridas-driver-eligibility-no-gateway.mjs");
if (identityStep < 0 || cancellationStep <= identityStep || lifecycleStep <= cancellationStep || eligibilityStep <= lifecycleStep) {
  fail('build Corridas não aplica identity/cancellation/lifecycle/eligibility na ordem segura');
}

const driverGoogleHardener = read('scripts/harden-motorista-auth.mjs');
for (const marker of ['google_callback_tokens_rejected', 'callback.pathname !== "/google"', '}, [finish, handleCallback]);']) {
  if (!driverGoogleHardener.includes(marker)) fail(`hardener Google Motorista sem ${marker}`);
}

const backendIdentity = read('scripts/harden-corridas-backend-identity-boundary.mjs');
for (const marker of [
  'subscriptions.driver_id referencia public.drivers(id)',
  'const driverRecordIds =',
  '.in("driver_id", driverRecordIds)',
  '.eq("auth_user_id", authUserId)',
  'const domainUserId = String(domainUser.id);',
  'const driverRecordId = String(driver.id);',
  'driver_id: driverRecordId',
  'accepted_driver_id: driverRecordId',
  'async function normalizeRecipientAuthIds',
  'callerDomainUserId === String(ride.passenger_id)',
  'callerDriverRecordId === String(ride.driver_id ?? "")',
  'cancellation_reason: "Nenhum motorista disponível no momento."',
]) {
  if (!backendIdentity.includes(marker)) fail(`boundary backend de identidade sem ${marker}`);
}
// The hardener necessarily contains legacy text as exact replacement fixtures.
// Its post-patch assertions (and generated-workspace checks below) prove those
// fixtures do not survive in release code.
for (const assertion of [
  "!source.includes('.in(\"driver_id\", driverIds)')",
  "!source.includes('driver_id: userId')",
  "!source.includes('const isPassenger = callerId === ride.passenger_id;')",
  "!source.includes('const isDriver = callerId === ride.driver_id;')",
  "!source.includes('cancel_reason: \"Nenhum motorista disponível no momento.\"')",
]) {
  if (!backendIdentity.includes(assertion)) fail(`boundary backend sem asserção pós-patch: ${assertion}`);
}

const auth = read('.work/corridas/src/hooks/use-auth.tsx');
if (auth) {
  if (!auth.includes('.eq("auth_user_id", userId)')) fail('workspace AuthProvider não resolve users.auth_user_id');
  if (auth.includes('.from("users")\n        .select("*")\n        .eq("id", userId)')) fail('workspace AuthProvider voltou a comparar public.users.id com auth UUID');
  if (!auth.includes('setAuthState("loading_profile")') || !auth.includes('setAuthState("profile_missing")')) fail('workspace AuthProvider não distingue resolução de profile');
}
for (const relative of [
  '.work/corridas/src/hooks/rides/use-active-ride.tsx',
  '.work/corridas/src/hooks/use-wallet.tsx',
  '.work/corridas/src/routes/_authenticated.notificacoes.tsx',
]) {
  const domainConsumer = read(relative);
  if (domainConsumer && !domainConsumer.includes('const userId = profile?.id ?? null;')) {
    fail(`${relative} não usa DOMAIN USER ID do profile`);
  }
}
const client = read('.work/corridas/src/integrations/supabase/client.ts');
if (client && !client.includes('flowType: "pkce"')) fail('workspace Supabase Auth não usa PKCE');
const google = read('.work/corridas/src/components/auth/PassengerGoogleLoginButton.tsx');
if (google) {
  for (const marker of ['exchangeCodeForSession(code)', 'handledUrlRef.current === rawUrl', 'browserFinished', 'App.getLaunchUrl()', 'consumeForwardedCallback', 'google_callback_tokens_rejected']) {
    if (!google.includes(marker)) fail(`workspace Google OAuth sem ${marker}`);
  }
  if (google.includes('auth.setSession(')) fail('workspace Google Passageiro aceita tokens de sessão no callback PKCE');
}

const driverGoogle = read('.work/motorista/src/components/DriverGoogleLoginButton.tsx');
if (driverGoogle) {
  for (const marker of ['exchangeCodeForSession(code)', 'google_callback_tokens_rejected', 'callback.pathname !== "/google"', 'listenerRef.current?.remove()']) {
    if (!driverGoogle.includes(marker)) fail(`workspace Google Motorista sem ${marker}`);
  }
  if (driverGoogle.includes('auth.setSession(')) fail('workspace Google Motorista aceita tokens de sessão no callback PKCE');
}

const requestRide = read('.work/corridas/supabase/functions/request-ride/index.ts');
if (requestRide) {
  for (const marker of [
    'const driverDomainUserIds =',
    '.select("id,auth_user_id")',
    'const domainByAuthUser =',
    'activeByDriver.get(String(d.id))',
    'cancellation_reason: "Nenhum motorista disponível no momento."',
  ]) {
    if (!requestRide.includes(marker)) fail(`workspace request-ride sem ${marker}`);
  }
  if (requestRide.includes('.in("driver_id", driverIds)')) fail('workspace request-ride mistura subscriptions.driver_id com users.id');
  if (requestRide.includes('.from("subscriptions")') || requestRide.includes('entitledDrivers')) {
    fail('workspace request-ride voltou a exigir subscription/provider aposentado');
  }
  if (requestRide.includes('cancel_reason: "Nenhum motorista disponível no momento."')) fail('workspace request-ride usa coluna de cancelamento inexistente');
}

const driverAction = read('.work/corridas/supabase/functions/driver-ride-action/index.ts');
if (driverAction) {
  for (const marker of ['.eq("auth_user_id", authUserId)', 'const domainUserId = String(domainUser.id);', 'const driverRecordId = String(driver.id);', 'driver_id: driverRecordId', 'accepted_driver_id: driverRecordId']) {
    if (!driverAction.includes(marker)) fail(`workspace driver-ride-action sem ${marker}`);
  }
  if (driverAction.includes('.eq("user_id", userId)') || driverAction.includes('driver_id: userId')) {
    fail('workspace driver-ride-action voltou a tratar AUTH ID como driver/domain ID');
  }
}

const push = read('.work/corridas/supabase/functions/send-ride-push/index.ts');
if (push) {
  for (const marker of ['normalizeRecipientAuthIds', 'callerDomainUserId', 'callerDriverRecordId', 'finalUserIds = await normalizeRecipientAuthIds(admin, input.user_ids);']) {
    if (!push.includes(marker)) fail(`workspace send-ride-push sem ${marker}`);
  }
  if (push.includes('const isPassenger = callerId === ride.passenger_id;') || push.includes('const isDriver = callerId === ride.driver_id;')) {
    fail('workspace send-ride-push voltou a comparar AUTH ID com IDs de domínio');
  }
}

if (failed) process.exit(1);
ok('Regressões críticas de Auth/Google/identidade backend Corridas verificadas.');
