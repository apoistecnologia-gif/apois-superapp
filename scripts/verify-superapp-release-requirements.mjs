import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const strict = process.env.APOIS_STRICT_NATIVE_CONFIG === '1';
const canonicalUrl = 'https://vqtucstyduxrqjgyigfk.supabase.co';
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
