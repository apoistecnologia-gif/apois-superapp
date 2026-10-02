import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
let failed = false;

function read(path) { return readFileSync(resolve(root, path), 'utf8'); }
function requireText(path, markers, label) {
  const source = read(path);
  const missing = markers.filter((marker) => !source.includes(marker));
  if (missing.length) { console.error(`[FAIL] ${label}: ${missing.join(' | ')}`); failed = true; }
  else console.log(`[OK] ${label}`);
}
function forbidText(path, markers, label) {
  const source = read(path);
  const found = markers.filter((marker) => source.includes(marker));
  if (found.length) { console.error(`[FAIL] ${label}: ${found.join(' | ')}`); failed = true; }
  else console.log(`[OK] ${label}`);
}

const expectedPins = {
  entregas: '0a1e0b294f75c97bce903200b57e7a6b482f381a',
  corridas_passageiro: '7b047f75a1a919a5336c0df6e0d60b14b02f2618',
  corridas_motorista_admin: '9fc171050d8b5703540c49d19a8f1e9f5162775f',
};
const lock = JSON.parse(read('.apois/source-lock.json'));
for (const [name, commit] of Object.entries(expectedPins)) {
  const actual = lock.sources?.[name]?.commit;
  if (actual !== commit) { console.error(`[FAIL] snapshot protegido ${name}: ${actual ?? 'ausente'} != ${commit}`); failed = true; }
  else console.log(`[OK] snapshot protegido ${name}: ${commit}`);
}

const workflowsDir = resolve(root, '.github/workflows');
if (existsSync(workflowsDir) && readdirSync(workflowsDir).some((name) => /\.ya?ml$/i.test(name))) {
  console.error('[FAIL] Superapp voltou a conter GitHub Actions; release continua no Codemagic');
  failed = true;
} else console.log('[OK] nenhum GitHub Action ativo no Superapp');

requireText('package.json', [
  '"audit:static": "node scripts/audit-superapp-static.mjs && npm run test:runtime-logging"',
  '"audit:payment-boundary": "node scripts/audit-payment-boundary.mjs"',
  '"verify:corridas-supabase-source": "node scripts/verify-corridas-supabase-source-of-truth.mjs"',
  '"verify:corridas-auth": "node scripts/verify-corridas-auth-regressions.mjs"',
  '"verify:corridas-db-ownership": "node scripts/verify-corridas-database-ownership.mjs"',
  '"verify:release-requirements": "node scripts/verify-superapp-release-requirements.mjs"',
  'node scripts/verify-final-finance-policy.mjs',
], 'pipeline principal registra guards de identidade, ambiente e boundary financeiro');

requireText('.apois/modules.json', [
  '"source": "sources/apois-corridas-passageiro"',
  '"workspace": ".work/corridas"',
  'harden-corridas-ride-lifecycle.mjs',
  'verify-corridas-ride-lifecycle-regressions.mjs',
  'harden-corridas-cancellation-policy.mjs',
  'harden-corridas-superapp-storage.mjs',
  'harden-superapp-module-mobile-ui.mjs corridas',
  'APOIS_VISUAL_KIT_V1',
  'bun run build:capacitor',
  'harden-entregas-payment-provider-boundary.mjs',
  'bun run build:customer',
], 'módulos são reconstruídos dos pins e recebem hardeners finais antes do build');
forbidText('.apois/modules.json', [
  'ActiveRideMap.tsx', 'RidePixPaymentCard.tsx', 'ActiveJourneyScreen.tsx',
], 'pipeline Corridas não exige componentes ausentes no pin atual');

requireText('scripts/prepare-workspace.mjs', [
  'rmSync(workspace, { recursive: true, force: true })',
  'cpSync(source, workspace',
  'request-ride',
  'paymentService.getPaymentMethods()',
], 'workspace continua descartável e solicitação passa pelo roteador request-ride');

requireText('scripts/build-isolated-module.mjs', [
  'scripts/prepare-workspace.mjs',
  'scripts/adapt-module-for-superapp.mjs',
  'scripts/harden-corridas-superapp-runtime.mjs',
  'scripts/fix-corridas-superapp-ui.mjs',
  'scripts/harden-corridas-payment-methods.mjs',
  "'apois-superapp-corridas-auth-v1'",
  "'apois-superapp-entregas-auth-v1'",
  "appPlugin.addListener('backButton'",
  "appPlugin.addListener('appStateChange'",
], 'build isolado prepara, adapta e integra sessão/back button sem editar submódulo');

requireText('scripts/harden-corridas-auth-profile-resolution.mjs', [
  '.eq("auth_user_id", userId)',
  '| "loading_profile"',
  '| "profile_missing"',
  'setAuthState("authenticated")',
  'setAuthState("profile_missing")',
  'profile?.id ?? null',
], 'AuthProvider Corridas distingue Auth UUID do domain user e não autentica antes do profile');

requireText('scripts/harden-corridas-superapp-google-auth.mjs', [
  "import './harden-corridas-auth-profile-resolution.mjs';",
  'flowType: "pkce"',
  'exchangeCodeForSession(code)',
  'handledUrlRef',
  'browserFinished',
  'App.getLaunchUrl()',
  'br.com.apois.app://auth/callback',
  'br.com.apois.app://auth/corridas-google',
], 'Google OAuth Corridas usa PKCE, callback determinístico, dedupe e cleanup/cancelamento');

requireText('scripts/harden-corridas-superapp-runtime.mjs', [
  'VITE_APOIS_SUPERAPP_RIDES_PUSH_ENABLED', 'RIDE_STATUS_ORDER', 'lastAcceptedStatusRef',
  'await loadRide(currentRideId)', 'PassengerMap',
], 'runtime Corridas mantém lifecycle, recuperação e mapa do pin real');
forbidText('scripts/harden-corridas-superapp-runtime.mjs', [
  'ActiveRideMap.tsx', 'RidePixPaymentCard.tsx',
], 'runtime Corridas não ressuscita componentes obsoletos');

requireText('scripts/fix-corridas-superapp-ui.mjs', [
  "import './harden-corridas-superapp-push-isolation.mjs';",
  'src/components/BottomNavigation.tsx', 'src/routes/_authenticated.perfil.tsx',
  'src/routes/_authenticated.tsx', 'hideBottomNavigation',
], 'UI Corridas adapta navegação e perfil reais');

requireText('scripts/harden-corridas-kit-visual.mjs', [
  'APOIS_VISUAL_KIT_V1', 'apois-kit-home-panel', '<HomeWorkShortcuts />',
  'apois-kit-search-results', 'max-h-[94dvh]', 'grid-cols-[58px_minmax(0,1fr)_auto]',
], 'kit visual oficial continua aplicado sem redesign geral');

requireText('scripts/harden-corridas-payment-methods.mjs', [
  "import './harden-corridas-payment-provider-boundary.mjs';",
], 'nome legado do hardener delega para um único boundary financeiro');
requireText('scripts/harden-corridas-payment-provider-boundary.mjs', [
  'code === "cash" || code === "credit"',
  'Pague diretamente ao motorista em dinheiro ao final da corrida.',
  'Pague diretamente ao motorista no cartão de crédito',
], 'Corridas preserva Dinheiro/Crédito direto ao motorista');
requireText('scripts/harden-corridas-safe2pay-payment-flow.mjs', [
  'VITE_APOIS_SAFE2PAY_PIX_ENABLED',
  'const isSafe2PayPix = code === "pix" && safe2PayPixEnabled;',
  'safe2pay-create-ride-pix',
  'safe2pay-payment-status',
  'finance.ride_electronic_payments_enabled',
  'aguardando_pagamento',
], 'Corridas adiciona PIX Safe2Pay atrás de feature flags frontend/backend');

requireText('scripts/harden-corridas-cancellation-policy.mjs', [
  'canCancel: ["procurar_motorista", "motorista_a_caminho"].includes(status)',
  'motorista_chegou não pode oferecer cancelamento se o backend o recusa',
  'em_viagem não pode permitir cancelamento',
  'ensureCancellationFinancialState',
], 'cancelamento Corridas segue exatamente os estados do backend e reconcilia taxa idempotentemente');
requireText('scripts/harden-corridas-ride-lifecycle.mjs', [
  'rollbackFailedDispatch',
  'error_code: "dispatch_failed"',
  'request_key: null',
  'ride.final_price ?? ride.estimated_price',
], 'lifecycle Corridas não deixa ride órfã de matching e não confia em final_price do motorista');

requireText('scripts/harden-corridas-superapp-push-isolation.mjs', [
  'isPushRideEvent', 'const hasDeliveryMarker =', 'if (hasDeliveryMarker) return;',
], 'listener Corridas ignora Push de Entregas no package unificado');
requireText('scripts/inject-superapp-push-routing.mjs', [
  "moduleName: 'entregas'", "corridasBase: '../corridas/index.html'", 'const rideEvents = new Set', 'if (!destination) return;',
], 'roteador global encaminha Push ao módulo correto');

requireText('scripts/harden-entregas-superapp-auth-runtime.mjs', [
  'br.com.apois.app://auth/email-change', '_app_package: "br.com.apois.app"', 'const isDeliveryPush =',
], 'Entregas mantém auth/push isolados; boundary financeiro é aplicado depois');
requireText('scripts/harden-entregas-payment-provider-boundary.mjs', [
  'const paymentMethod = "pix";', 'paymentMethod: "pix"',
  'const PAYMENT_METHODS = new Set(["pix"]);',
  '"safe2pay-create-order-pix"', '"safe2pay-payment-status"',
  'configuredProvider = "safe2pay_marketplace"',
], 'Entregas usa PIX Safe2Pay e mantém confirmação server-authoritative');

requireText('scripts/neutralize-entregas-superapp-legacy.mjs', [
  "await import('./harden-entregas-delivery-readiness.mjs');",
  "await import('./harden-entregas-merchant-direct-finance.mjs');",
], 'Entregas preserva logística e financeiro direto');
forbidText('scripts/neutralize-entregas-superapp-legacy.mjs', [
  "await import('./normalize-entregas-merchant-mp-handoff.mjs');",
  "await import('./harden-entregas-merchant-mercadopago-v2.mjs');",
], 'Entregas não reativa integração Mercado Pago no pipeline');

requireText('supabase/corridas-forward-migrations/20260905070000_fix_passenger_identity_rls.sql', [
  'users_auth_user_id_unique', 'u.auth_user_id = auth.uid()',
  'drop policy if exists "users_select_own"', 'drop policy if exists "users_update_own"',
  'drop policy if exists "user_roles_select_own"', 'drop policy if exists "passenger_wallets_select_own"',
], 'migration forward-only corrige ownership AUTH ID -> DOMAIN USER ID');
forbidText('supabase/corridas-forward-migrations/20260905070000_fix_passenger_identity_rls.sql', [
  'EXCLUDED.id', 'USING (auth.uid() = passenger_id)', 'USING (auth.uid() = user_id)',
], 'migration de ownership não usa comparações diretas incorretas nem EXCLUDED');
requireText('supabase/corridas-forward-migrations/20260905131500_harden_driver_wallet_and_cancellation_idempotency.sql', [
  'cancellation_fees_one_per_ride_uidx', 'driver_reads_own_wallet',
  'u.auth_user_id = auth.uid()',
], 'migration forward-only protege idempotência da taxa e ownership da carteira');

requireText('scripts/verify-superapp-release-requirements.mjs', [
  "APOIS_STRICT_NATIVE_CONFIG === '1'", 'tbbzkrfupmqdywnzgnms', 'ptgkwyyolrdgnqketkjj',
  'CORRIDAS_WEB_MAPS_API_KEY', 'CORRIDAS_ANDROID_MAPS_API_KEY',
  '20260905131500_harden_driver_wallet_and_cancellation_idempotency.sql',
], 'release estrito exige Supabase canônico, chaves Maps e migrations forward obrigatórias');
requireText('scripts/verify-corridas-supabase-source-of-truth.mjs', [
  'tbbzkrfupmqdywnzgnms', 'vqtucstyduxrqjgyigfk', 'zjphbuvcapwyuynadgdt', '.work/corridas',
], 'gate Supabase rejeita projeto histórico no runtime/bundle');

requireText('superapp/shell/build.mjs', [
  "resolve(root, '../branding/apois-brand-v2.jpg')", "resolve(dist, 'assets/apois-brand-v2.jpg')",
], 'shell empacota marca oficial');
requireText('superapp/shell/capacitor.config.ts', [
  "appId: 'br.com.apois.app'", "backgroundColor: '#050505'", 'overlaysWebView: false',
], 'Capacitor usa package unificado e fundo correto');
requireText('codemagic.yaml', [
  'android-superapp-experimental:', 'APP_PACKAGE: "br.com.apois.app"',
  'APOIS_STRICT_NATIVE_CONFIG: "1"', 'npm run verify:pins', 'APOIS-Superapp.apk',
], 'Codemagic mantém package, modo estrito, pins e artefato Cliente');
requireText('.env.example', [
  'CORRIDAS_PUBLIC_APP_URL=', 'CORRIDAS_WEB_MAPS_API_KEY=', 'CORRIDAS_ANDROID_MAPS_API_KEY=',
  'FIREBASE_SUPERAPP_GOOGLE_SERVICES_JSON_BASE64=',
], 'ambiente documenta URL pública, Maps e Firebase unificado');

process.exit(failed ? 1 : 0);
