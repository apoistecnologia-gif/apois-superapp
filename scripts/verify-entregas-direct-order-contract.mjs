import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

let failed = false;
const fail = (m) => { failed = true; console.error(`[FAIL] ${m}`); };
const ok = (m) => console.log(`[OK] ${m}`);
const read = (p) => readFileSync(resolve(p), 'utf8');

const edge = read('supabase/functions/create-order/index.ts');
const hardener = read('scripts/harden-entregas-payment-provider-boundary.mjs');
const migration = read('supabase/entregas-forward-migrations/20260905113000_allow_direct_cash_order_operations.sql');

for (const marker of [
  'const PAYMENT_METHODS = new Set(["cash"]);',
  'p_customer_user_id: userData.user.id',
  'p_payment_method: paymentMethod',
  'snapshot.payment_method !== "cash"',
  'snapshot.payment_status !== "pending"',
  'FINANCIAL_CONTRACT_MISMATCH',
]) if (!edge.includes(marker)) fail(`create-order perdeu contrato: ${marker}`);

const checkoutAclMigration = read('supabase/entregas-forward-migrations/20261104011000_checkout_rpc_service_role_only.sql');
for (const signature of [
  'public.create_order_atomic(uuid,uuid,jsonb,text,jsonb,uuid,text)',
  'public.create_order_atomic_v2(uuid,uuid,jsonb,text,jsonb,uuid,text,text,text)',
  'public.create_order_for_checkout_intent_v2(uuid,uuid,jsonb,text,jsonb,uuid,uuid,text,text,text)',
]) {
 if (!checkoutAclMigration.includes(`REVOKE EXECUTE ON FUNCTION ${signature}\n FROM PUBLIC, anon, authenticated;`)) {
  fail(`RPC sem revogação completa PUBLIC/anon/authenticated: ${signature}`);
 }
 if (!checkoutAclMigration.includes(`GRANT EXECUTE ON FUNCTION ${signature}\n TO service_role;`)) {
  fail(`Backend service-role perdeu acesso RPC: ${signature}`);
 }
}
if (!edge.includes('adminClient.rpc("create_order_for_checkout_intent_v2", {')) {
 fail('Edge create-order deixou de usar client service_role para checkout atômico');
}

for (const marker of [
  'normalized.includes("payment method is not enabled in production")',
  'code: "PAYMENT_METHOD_NOT_CONFIGURED"',
  'normalized.includes("merchant subscription inactive")',
  'code: "MERCHANT_UNAVAILABLE"',
]) if (!edge.includes(marker)) fail(`create-order perdeu mapeamento de indisponibilidade: ${marker}`);

const approvedMigration = read('supabase/entregas-forward-migrations/20261104010000_guard_merchant_subscription_fail_closed.sql');
for (const marker of [
  "m.approval_status='approved' AND m.is_active=true",
  'CREATE OR REPLACE FUNCTION public.merchant_subscription_in_good_standing',
  'REVOKE EXECUTE ON FUNCTION public.merchant_subscription_in_good_standing(uuid) FROM PUBLIC, anon;',
  "ms.current_period_end>now()",
  "COALESCE(ms.last_payment_status,'')='approved'",
]) if (!approvedMigration.includes(marker)) fail(`migration merchant subscription fail-closed incompleta: ${marker}`);
if (/WHEN NOT EXISTS\s*\(/i.test(approvedMigration)) fail('migration de assinatura reintroduziu fail-open');

for (const forbidden of [
  'create-pix-charge',
  'create-merchant-mercadopago-pix',
  'create-asaas-pix-charge',
  'merchant-payment-readiness',
  'sync-payment-status',
  'process-superapp-refund',
]) if (edge.includes(forbidden)) fail(`create-order chama provider aposentado: ${forbidden}`);

if (/PAYMENT_METHODS\s*=\s*new Set\(\[[^\]]*(pix|credit|debit|wallet)/i.test(edge)) {
  fail('create-order permite método eletrônico não configurado');
}
if (/payment_status\s*[:=]\s*["']paid["']/i.test(edge)) {
  fail('create-order contém atribuição que pode fabricar paid');
}

for (const marker of [
  'const paymentMethod = "cash";',
  'const PAYMENT_METHODS = new Set(["cash"]);',
  'Pedido criado. O pagamento será feito diretamente ao estabelecimento.',
]) if (!hardener.includes(marker)) fail(`hardener checkout incompleto: ${marker}`);

for (const marker of [
  "payment_method = 'cash' and payment_status in ('pending','cancelled')",
  "v_order.payment_method = 'cash' and v_order.payment_status = 'pending'",
  'current_user_is_merchant_member',
]) if (!migration.includes(marker)) fail(`migration cash/pending incompleta: ${marker}`);

// A retried cash cancellation must be idempotent and must return a JSON
// boolean, not null. This guard executes after merchant ownership is checked.
if (!/or\s*\(v_order\.payment_method\s*=\s*'cash'\s+and v_order\.status\s*=\s*'cancelled'\s+and v_order\.payment_status\s*=\s*'cancelled'\)/i.test(migration)) {
 fail('merchant cash cancel retry eligibility was removed');
}
if (!migration.includes("'refund_pending', coalesce(v_refund.status in ('pending','processing'), false)")) {
 fail('cash cancellation retry may expose refund_pending=null');
}
const authIndex = migration.indexOf('merchant access required');
const retryIndex = migration.indexOf("and v_order.status = 'cancelled'");
const terminalIndex = migration.indexOf("if v_order.status in ('cancelled','refunded') then");
const financialStart = migration.indexOf("select * into v_job");
if (authIndex<0 || retryIndex<=authIndex || terminalIndex<=retryIndex ||
 financialStart<=terminalIndex) {
 fail('cash cancellation retry bypasses merchant permission or happens after mutating jobs');
}

// A cash order must not fall into the existing electronic refund path, even if
// a legacy payment row or inconsistent payment_status exists.
const guardStart = migration.indexOf('APOIS_CASH_REJECT_NO_GATEWAY_REFUND_V1');
const firstJobMutation = migration.indexOf('select * into v_job');
if (guardStart < 0 || firstJobMutation < 0 || guardStart > firstJobMutation) {
  fail('merchant cash guard is not before delivery-job cancellation');
} else {
  const cashGuard = migration.slice(guardStart, firstJobMutation);
  for (const required of [
    "if v_order.payment_method = 'cash' then",
    "v_order.payment_status is distinct from 'pending'",
    "from public.payments p where p.order_id = _order_id",
    "cash_payment_state_requires_manual_reconciliation",
    "cash_gateway_payment_record_requires_manual_reconciliation",
  ]) if (!cashGuard.includes(required)) fail('merchant cash guard missing: ' + required);
}

if (!failed) {
  ok('create-order aceita somente cash direto e deriva customer da sessão autenticada');
  ok('create-order não chama provider e rejeita snapshot paid fabricado');
  ok('checkout/merchant cash-pending têm contrato versionado coerente');
} else process.exit(1);
