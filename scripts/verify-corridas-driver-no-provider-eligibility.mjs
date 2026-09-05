import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const path = resolve('supabase/corridas-forward-migrations/20260905162500_remove_retired_driver_subscription_gates.sql');
const sql = readFileSync(path, 'utf8');
let failed = false;
const fail = (m) => { failed = true; console.error(`[FAIL] ${m}`); };
const ok = (m) => console.log(`[OK] ${m}`);

for (const marker of [
  'create or replace function apois_rpc_private.driver_set_presence',
  'create or replace function apois_rpc_private.driver_accept_ride(_ride_id uuid)',
  'create or replace function apois_rpc_private.driver_accept_ride_candidate_legacy(_ride_id uuid)',
  'create or replace function private.enforce_driver_operational_stage_transition()',
  'create or replace function public.append_nearby_busy_driver_candidates()',
  'create or replace function apois_rpc_private.driver_finish_ride(_ride_id uuid)',
  "v_driver.approval_status = 'aprovado'",
  'v_driver.suspended_at is null',
  'v_driver.blocked_at is null',
  'private.driver_kyc_is_ready(v_driver.id)',
  "raise exception 'driver_offline'",
  "raise exception 'electronic_payment_not_configured'",
  "set status='motorista_a_caminho'",
]) {
  if (!sql.includes(marker)) fail(`migration perdeu contrato obrigatório: ${marker}`);
}

// Inspect only each dollar-quoted function body. A trailing COMMENT mentioning
// the historical helper is audit evidence, not an operational subscription call.
const functionSections = sql.match(/create or replace function[\s\S]*?\$function\$;/gi) ?? [];
for (const section of functionSections) {
  const header = section.split('\n', 1)[0];
  if (section.includes('driver_subscription_allows_rides(') && !header.includes('driver_subscription_allows_rides')) {
    fail(`gate de subscription ainda presente em função operacional: ${header}`);
  }
  if (/payment_provider\s*=\s*'mercadopago'|v_requires_marketplace_payment|v_marketplace\s+boolean/i.test(section)) {
    fail(`provider eletrônico ainda altera lifecycle do motorista: ${header}`);
  }
}

for (const functionName of ['driver_accept_ride', 'driver_accept_ride_candidate_legacy']) {
  const section = functionSections.find((candidate) => candidate.toLowerCase().includes(`${functionName.toLowerCase()}(`)) ?? '';
  for (const marker of [
    "not in ('cash','dinheiro','money','credit','credit_card','cartao_credito')",
    "in ('mercadopago_marketplace','asaas','pagbank','openpix')",
    "raise exception 'electronic_payment_not_configured'",
  ]) {
    if (!section.includes(marker)) fail(`${functionName} não bloqueia fluxo aposentado: ${marker}`);
  }
}

if (!failed) {
  ok('driver online/accept/lifecycle/queued matching não dependem de subscription/provider aposentado');
  ok('aprovação, bloqueio, suspensão, KYC, online e ownership continuam backend-authoritative');
  ok('accept rejeita método eletrônico em vez de fabricar pagamento ou converter provider');
} else process.exit(1);
