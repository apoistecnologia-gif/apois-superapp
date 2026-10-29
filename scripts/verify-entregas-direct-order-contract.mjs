import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

let failed = false;
const fail = (m) => { failed = true; console.error(`[FAIL] ${m}`); };
const ok = (m) => console.log(`[OK] ${m}`);
const read = (p) => readFileSync(resolve(p), 'utf8');

if (process.env.APOIS_ENTREGAS_CASH_TEST_MODE !== "1") {
  const build=read(".apois/modules.json");
  const prod=read("scripts/harden-entregas-pix-production-guard.mjs");
  const edgeTest=read("supabase/entregas-cash-test/create-order/index.ts");
  for(const marker of [
    "APOIS_ENTREGAS_CASH_TEST_MODE",
    "harden-entregas-pix-production-guard.mjs",
    "harden-entregas-cash-test-badges.mjs",
  ]) if(!build.includes(marker))fail("separação de build ausente "+marker);
  if(!prod.includes("APOIS_ENTREGAS_PIX_PRODUCTION_GUARD_V1") || !prod.includes("PIX temporariamente indisponível"))
    fail("produção PIX deve falhar fechada enquanto Safe2Pay não está habilitado");
  if(!edgeTest.includes("apois_check_test_cash_access") || !edgeTest.includes("authClient.auth.getUser(token)"))
    fail("cash de teste não está restrito a cliente/estabelecimento autorizado");
  if(failed) process.exit(1);
  ok("Entregas produção: somente PIX, indisponível até homologação Safe2Pay; dinheiro exclusivo do build de teste");
  process.exit(0);
}

const edge = read('supabase/functions/create-order/index.ts');
const hardener = read('scripts/harden-entregas-payment-provider-boundary.mjs');
const migration = read('supabase/entregas-forward-migrations/20260905113000_allow_direct_cash_order_operations.sql');

for (const marker of [
  'const PAYMENT_METHODS = new Set(["cash"]);',
  'p_customer_user_id: userData.user.id',
  'p_payment_method: paymentMethod',
  'snapshot.payment_method !== "cash"',
  'snapshot.payment_status === "paid"',
  'FINANCIAL_CONTRACT_MISMATCH',
]) if (!edge.includes(marker)) fail(`create-order perdeu contrato: ${marker}`);

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

if (!failed) {
  ok('create-order aceita somente cash direto e deriva customer da sessão autenticada');
  ok('create-order não chama provider e rejeita snapshot paid fabricado');
  ok('checkout/merchant cash-pending têm contrato versionado coerente');
} else process.exit(1);
