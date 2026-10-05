import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const strict = process.env.APOIS_STRICT_NATIVE_CONFIG === '1';
const canonicalUrl = 'https://tbbzkrfupmqdywnzgnms.supabase.co';
const entregasCanonicalUrl = 'https://ptgkwyyolrdgnqketkjj.supabase.co';
let failed = false;
function fail(message) { failed = true; console.error(`[FAIL] ${message}`); }
function warn(message) { console.warn(`[WARN] ${message}`); }
function ok(message) { console.log(`[OK] ${message}`); }

function requireMigration(path, markers, label) {
  const full = resolve(path);
  if (!existsSync(full)) {
    fail(`${label}: migration obrigatória ausente (${path})`);
    return;
  }
  const source = readFileSync(full, 'utf8');
  const missing = markers.filter((marker) => !source.includes(marker));
  if (missing.length) fail(`${label}: contrato incompleto (${missing.join(' | ')})`);
  else ok(`${label}: migration forward versionada`);
}

const supabaseUrl = process.env.CORRIDAS_VITE_SUPABASE_URL?.trim().replace(/\/$/, '') || '';
if (!supabaseUrl) {
  if (strict) fail('CORRIDAS_VITE_SUPABASE_URL é obrigatória no release');
  else warn('CORRIDAS_VITE_SUPABASE_URL ausente no desenvolvimento');
} else if (supabaseUrl !== canonicalUrl) {
  fail(`CORRIDAS_VITE_SUPABASE_URL deve ser ${canonicalUrl}`);
} else ok('Supabase Corridas canônico configurado');

const entregasRuntimeHardenerPath = resolve('scripts/harden-entregas-supabase-runtime.mjs');
if (!existsSync(entregasRuntimeHardenerPath)) {
  fail('hardener do Supabase runtime de Entregas ausente');
} else {
  const entregasRuntimeHardener = readFileSync(entregasRuntimeHardenerPath, 'utf8');
  for (const marker of ['ptgkwyyolrdgnqketkjj', 'VITE_SUPABASE_URL', 'VITE_SUPABASE_PUBLISHABLE_KEY', 'sbvhdgyuuperszlsllji']) {
    if (!entregasRuntimeHardener.includes(marker)) fail(`hardener Entregas sem marcador obrigatório (${marker})`);
  }
  if (!entregasRuntimeHardener.includes("source.includes(retiredRef)")) {
    fail('hardener Entregas não remove explicitamente o Supabase aposentado do snapshot');
  } else {
    ok('hardener Entregas substitui o Supabase aposentado pelo projeto canônico antes do build');
  }
}

const isolatedBuilderPath = resolve('scripts/build-isolated-module.mjs');
if (!existsSync(isolatedBuilderPath)) {
  fail('builder isolado do Superapp ausente');
} else {
  const isolatedBuilder = readFileSync(isolatedBuilderPath, 'utf8');
  const requiredEntregasBuilderMarkers = [
    "const ENTREGAS_CANONICAL_REF = 'ptgkwyyolrdgnqketkjj'",
    'const ENTREGAS_CANONICAL_URL = `https://${ENTREGAS_CANONICAL_REF}.supabase.co`',
    'env.VITE_SUPABASE_URL = ENTREGAS_CANONICAL_URL',
    'env.VITE_SUPABASE_PUBLISHABLE_KEY = entregasPublishableKey',
  ];
  const missingEntregasBuilderMarkers = requiredEntregasBuilderMarkers.filter(
    (marker) => !isolatedBuilder.includes(marker),
  );
  if (missingEntregasBuilderMarkers.length) {
    fail(`Entregas não está fixado no Supabase canônico (${missingEntregasBuilderMarkers.join(' | ')})`);
  } else if (isolatedBuilder.includes("ENTREGAS_CANONICAL_REF = 'sbvhdgyuuperszlsllji'")) {
    fail('Entregas ainda aponta para projeto Supabase aposentado');
  } else {
    ok('Supabase Entregas canônico fixado no builder do Cliente');
  }
}

const googleOauthGeneratorPath = resolve('scripts/harden-corridas-superapp-google-auth.mjs');
const oauthHandoffPath = resolve('scripts/harden-corridas-oauth-callback-handoff.mjs');
if (!existsSync(googleOauthGeneratorPath) || !existsSync(oauthHandoffPath)) {
  fail('hardener OAuth Corridas ausente');
} else {
  const googleOauthGenerator = readFileSync(googleOauthGeneratorPath, 'utf8');
  const oauthHandoff = readFileSync(oauthHandoffPath, 'utf8');
  const requiredOauthMarkers = [
    'JSON.stringify({ product: "corridas", createdAt: Date.now() })',
    'const pendingEnvelope =',
    'const pendingEnvelopeHardened =',
    'if (source.includes(pendingEnvelope))',
  ];
  const combinedOauth = googleOauthGenerator + '\n' + oauthHandoff;
  const missingOauthMarkers = requiredOauthMarkers.filter((marker) => !combinedOauth.includes(marker));
  if (missingOauthMarkers.length) {
    fail(`OAuth Corridas hardeners incompatíveis (${missingOauthMarkers.join(' | ')})`);
  } else {
    ok('OAuth Corridas hardeners compatíveis com envelope pendente idempotente');
  }
}

const nativeMapHardenerPath = resolve('scripts/harden-corridas-native-map.mjs');
if (!existsSync(nativeMapHardenerPath)) {
  fail('hardener mapa nativo Corridas ausente');
} else {
  const nativeMapHardener = readFileSync(nativeMapHardenerPath, 'utf8');
  for (const marker of [
    'APOIS_NATIVE_MAP_FALLBACK_V2',
    'VITE_GOOGLE_MAPS_NATIVE_API_KEY',
    'Capacitor.isNativePlatform()',
    'mapService.createMap',
    'PolylineDecoder',
    'displayRoutePoints',
    'upsertDriverMarker',
    'document.body.style.backgroundColor = "transparent"',
    'strokeColor: "#E51B23"',
    'assets/markers/',
  ]) {
    if (!nativeMapHardener.includes(marker)) fail(`hardener mapa nativo Corridas sem marcador obrigatório (${marker})`);
  }
  if (!nativeMapHardener.includes("referências a marker PNG inexistente permaneceram")) {
    fail('hardener mapa nativo não bloqueia assets de marcador inexistentes');
  } else {
    ok('hardener mapa nativo Corridas versionado com transparência, rota ativa e fallback seguro');
  }
}

for (const name of ['CORRIDAS_WEB_MAPS_API_KEY', 'CORRIDAS_ANDROID_MAPS_API_KEY']) {
  const value = process.env[name]?.trim() || '';
  if (!value) {
    if (strict) fail(`${name} é obrigatória no release estrito`);
    else warn(`${name} ausente; mapa pode ficar indisponível em desenvolvimento`);
    continue;
  }
  if (!/^AIza[A-Za-z0-9_-]{20,}$/.test(value)) fail(`${name} não tem formato plausível de chave Google`);
  else ok(`${name} presente com formato plausível`);
}

// CODE + REQUIRED FORWARD MIGRATIONS formam uma única unidade de release.
// Este gate não afirma que produção já foi migrada; apenas impede que o código seja
// considerado publicável sem as migrations que dão suporte às invariantes atuais.
requireMigration(
  'supabase/corridas-forward-migrations/20260905070000_fix_passenger_identity_rls.sql',
  ['users_auth_user_id_unique', 'rides_select_passenger', 'rides_select_driver'],
  'Corridas AUTH/DOMAIN RLS',
);
requireMigration(
  'supabase/corridas-forward-migrations/20260905131500_harden_driver_wallet_and_cancellation_idempotency.sql',
  ['cancellation_fees_one_per_ride_uidx', 'driver_reads_own_wallet', 'auth_user_id = auth.uid()'],
  'Corridas wallet/cancelamento idempotente',
);
requireMigration(
  'supabase/corridas-forward-migrations/20260905143000_harden_driver_document_ownership.sql',
  ['driver_update_document', 'invalid_document_mime', 'apois_driver_storage_insert_own', '10485760'],
  'Corridas ownership/MIME de documentos do motorista',
);
requireMigration(
  'supabase/corridas-forward-migrations/20260905162500_remove_retired_driver_subscription_gates.sql',
  ['driver_set_presence', 'driver_accept_ride_candidate_legacy', 'driver_finish_ride', 'electronic_payment_not_configured', 'driver_kyc_is_ready'],
  'Corridas eligibility/lifecycle sem provider aposentado',
);
requireMigration(
  'supabase/entregas-forward-migrations/20260905113000_allow_direct_cash_order_operations.sql',
  ['cash', 'pending'],
  'Entregas cash/pending operacional',
);
requireMigration(
  'supabase/entregas-forward-migrations/20260905114500_enable_merchant_manual_courier_mode.sql',
  ['merchant_manual'],
  'Entregas settlement merchant_manual',
);

if (failed) process.exit(1);
console.log(`[OK] Gate mínimo de release concluído${strict ? ' em modo estrito' : ' em modo desenvolvimento'}.`);
