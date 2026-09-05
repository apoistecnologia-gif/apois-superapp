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
  for (const marker of ['exchangeCodeForSession(code)', 'handledUrlRef.current === rawUrl', 'browserFinished', 'App.getLaunchUrl()']) {
    if (!google.includes(marker)) fail(`workspace Google OAuth sem ${marker}`);
  }
}

if (failed) process.exit(1);
ok('Regressões críticas de Auth/Google Corridas verificadas.');
