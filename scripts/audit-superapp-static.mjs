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
  '"audit:static": "node scripts/audit-superapp-static.mjs"',
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
  'APOIS_REFERENCE_HOME_V2',
  'data-apois-reference-home-v2',
  'bun run build:capacitor',
  'harden-entregas-payment-provider-boundary.mjs',
  'bun run build:customer',
], 'módulos são reconstruídos dos pins e recebem hardeners finais antes do build');
forbidText('.apois/modules.json', [
  'ActiveRideMap.tsx', 'RidePixPaymentCard.tsx', 'ActiveJourneyScreen.tsx', 'aguardando_pagamento: 2',
], 'pipeline Corridas não exige componentes ou estados ausentes no pin atual');

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
  'scripts/harden-corridas-native-map.mjs',
  "'apois-superapp-corridas-auth-v1'",
  "'apois-superapp-entregas-auth-v1'",
  "appPlugin.addListener('backButton'",
  "appPlugin.addListener('appStateChange'",
  'harden-entregas-supabase-runtime.mjs',
  'harden-entregas-google-oauth-handoff.mjs',
  "apois:entregas-google-callback",
  "apois-superapp:entregas-google-url",
  "ENTREGAS_CANONICAL_REF = 'ptgkwyyolrdgnqketkjj'",
  'env.VITE_SUPABASE_URL = ENTREGAS_CANONICAL_URL',
], 'build isolado prepara, adapta e integra sessão/back button/OAuth e fixa Supabase Entregas sem editar submódulo');

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
  'JSON.stringify({ product: \\"corridas\\", createdAt: Date.now() })',
  'browserFinished pode chegar',
  'providerError',
], 'Google OAuth Corridas usa PKCE, envelope persistente sem race de browserFinished, callback determinístico, dedupe e cleanup/cancelamento');

requireText('scripts/harden-entregas-supabase-runtime.mjs', [
  'ptgkwyyolrdgnqketkjj',
  'import.meta.env["VITE_SUPABASE_URL"]',
  'import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"]',
  "retiredRef = 'sbvhdgyuuperszlsllji'",
], 'Entregas remove o Supabase aposentado hardcoded antes do build e exige o projeto de produção');

requireText('scripts/harden-entregas-google-oauth-handoff.mjs', [
  'flowType: "pkce"',
  'APOIS_GOOGLE_PENDING_KEY',
  'APOIS_GOOGLE_FORWARD_KEY',
  'consumeForwardedGoogleCallback',
  'product: "entregas"',
  'apois:entregas-google-callback',
], 'Google OAuth Entregas usa PKCE, mantém callback no módulo dono e possui handoff persistente');

requireText('scripts/harden-corridas-superapp-runtime.mjs', [
  'VITE_APOIS_SUPERAPP_RIDES_PUSH_ENABLED', 'RIDE_STATUS_ORDER', 'lastAcceptedStatusRef',
  'await loadRide(currentRideId)', 'PassengerMap',
], 'runtime Corridas mantém lifecycle, recuperação e mapa do pin real');
forbidText('scripts/harden-corridas-superapp-runtime.mjs', [
  'ActiveRideMap.tsx', 'RidePixPaymentCard.tsx', 'aguardando_pagamento',
], 'runtime Corridas não ressuscita componentes/estados obsoletos');

requireText('scripts/fix-corridas-superapp-ui.mjs', [
  "import './harden-corridas-superapp-push-isolation.mjs';",
  'src/components/BottomNavigation.tsx', 'src/routes/_authenticated.perfil.tsx',
  'src/routes/_authenticated.tsx', 'hideBottomNavigation',
], 'UI Corridas adapta navegação e perfil reais');

requireText('scripts/build-isolated-module.mjs', [
  'function peekPendingOAuthProduct()',
  "path === 'callback' && peekPendingOAuthProduct() === 'corridas'",
  "function storeCorridasGoogleCallback(rawUrl)",
  "window.location.replace('../corridas/index.html#/login')",
  "window.location.replace('../entregas/index.html')",
], 'callback Google de Corridas permanece no módulo Corridas e callbacks genéricos de Entregas continuam encaminhados');

requireText('scripts/harden-corridas-native-map.mjs', [
  'APOIS_NATIVE_MAP_FALLBACK_V3',
  '[isStatic, nativeApiKey, reloadKey]',
  'VITE_GOOGLE_MAPS_NATIVE_API_KEY',
  'Capacitor.isNativePlatform()',
  'mapService.createMap',
  'mapService.upsertDriverMarker',
  'PolylineDecoder',
  'PolylineDecoder deve ser importado exatamente uma vez',
  'displayedRoutePoints',
  'encodedPolyline não pôde ser ligado ao PassengerMap',
  'if (encodedPolyline)',
  'bottom: 240',
  'const previousHtml = document.documentElement.style.backgroundColor',
  'const changed: Array<{ element: HTMLElement',
  'document.body.style.backgroundColor = "transparent"',
  'strokeColor: "#E51B23"',
  'styles: []',
  'referência a marker PNG inexistente permaneceu',
], 'Corridas usa mapa nativo claro no Android e mantém fallback web');

requireText('scripts/harden-corridas-kit-visual.mjs', [
  'APOIS_VISUAL_KIT_V1', 'APOIS_REFERENCE_HOME_V2', 'data-apois-reference-home-v2',
  'apois-kit-home-panel', '<HomeWorkShortcuts />', 'Solicitar corrida',
  'apois-kit-search-results', 'max-h-[94dvh]', 'max-h-[38dvh]', 'h-10 w-10 rounded-full object-contain', 'Local de partida', 'Destino',
  'bg-transparent text-[#111111]', 'absolute inset-0 z-0 bg-transparent',
], 'kit visual oficial mantém mapa predominante, painel compacto e destino apenas no bottom sheet');

requireText('scripts/build-isolated-module.mjs', [
  "harden-apois-client-red-visual.mjs",
  "harden-corridas-kit-visual.mjs",
  'protectedMapRuntimeBeforeVisual',
  'protectedCorridasMapRuntimeAfterVisual',
  'migração visual preservou byte a byte Maps/GPS/Places',
  'build final preservou byte a byte Maps/GPS/Places',
], 'visual Corridas roda uma vez no pipeline isolado e protege Maps/GPS/Places');


requireText('scripts/harden-apois-client-red-visual.mjs', [
  'APOIS_CATEGORY_STUDIO_V1',
  'vGHP86zk7D_small.jpg',
  'kyjjmkQI3H.jpg',
  'removalist_5ca69cd22a98b.jpg',
  '0250-0020-EQ-OMBRE_2.PNG',
  'Big_Boy_Velocity_150_Cargo_Update.png',
  '"w-28 shrink-0',
  'h-[74px]',
  'object-contain object-center',
  'APOIS',
], 'categorias Corridas usam fotos reais e cards compactos');

requireText('scripts/harden-corridas-payment-methods.mjs', [
  "import './harden-corridas-payment-provider-boundary.mjs';",
], 'nome legado do hardener delega para um único boundary financeiro');
requireText('scripts/harden-corridas-payment-provider-boundary.mjs', [
  'code === "cash" || code === "credit"',
  'if (!isActive || !isDirectToDriver) return [];',
  'Pague diretamente ao motorista em dinheiro ao final da corrida.',
  'Pague diretamente ao motorista no cartão de crédito',
], 'Corridas expõe apenas Dinheiro/Crédito direto ao motorista');

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
  'const paymentMethod = "cash";', 'paymentMethod: "cash"',
  'const PAYMENT_METHODS = new Set(["cash"]);', 'SEM GATEWAY DA APOIS',
  'process-superapp-refund', 'devolução automática por gateway não se aplica',
], 'Entregas finaliza pedido direto sem gateway nem estorno eletrônico automático');

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
], 'release estrito exige Supabase canônico de Corridas e Entregas, chaves Maps e migrations forward obrigatórias');
requireText('scripts/verify-corridas-supabase-source-of-truth.mjs', [
  'tbbzkrfupmqdywnzgnms', 'vqtucstyduxrqjgyigfk', 'zjphbuvcapwyuynadgdt', '.work/corridas',
], 'gate Supabase valida projeto atual, preserva snapshot conhecido e rejeita projeto histórico no runtime/bundle');

requireText('scripts/install-superapp-launcher.mjs', [
  'apois-client-red-logo.b64',
  '89504e470d0a1a0a',
  '@mipmap/ic_launcher_foreground',
  '@android:color/white',
], 'launcher Cliente usa a mesma marca vermelha do shell e não o asset legado');

requireText('superapp/shell/build.mjs', [
  "resolve(root, '../branding/apois-client-red-logo.b64')", "resolve(dist, 'assets/apois-brand.png')",
  'brandDataUri', 'data:image/png;base64,',
], 'shell empacota e embute marca oficial');

forbidText('superapp/shell/build.mjs', [
  'apois-superapp-entregas-back-navigation',
], 'shell não registra segundo handler Android Voltar em Entregas');
requireText('superapp/shell/capacitor.config.ts', [
  "appId: 'br.com.apois.app'", "backgroundColor: '#00000000'", 'overlaysWebView: false',
], 'Capacitor usa package unificado e fundo correto');
requireText('scripts/configure-superapp-android.mjs', [
  'mapsMetaPattern',
  'Google Maps Android key materializada no AndroidManifest.',
  "com.google.android.geo.API_KEY",
], 'Android sempre materializa a Maps key do release no manifest, mesmo se o metadata já existir');
requireText('codemagic.yaml', [
  'android-superapp-experimental:', 'APP_PACKAGE: "br.com.apois.app"',
  'APOIS_STRICT_NATIVE_CONFIG: "1"', 'npm run verify:pins', 'APOIS-Superapp.apk',
], 'Codemagic mantém package, modo estrito, pins e artefato Cliente');
requireText('.env.example', [
  'CORRIDAS_PUBLIC_APP_URL=', 'CORRIDAS_WEB_MAPS_API_KEY=', 'CORRIDAS_ANDROID_MAPS_API_KEY=',
  'FIREBASE_SUPERAPP_GOOGLE_SERVICES_JSON_BASE64=',
], 'ambiente documenta URL pública, Maps e Firebase unificado');

process.exit(failed ? 1 : 0);
