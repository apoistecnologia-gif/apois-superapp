import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
let count = 0;
function verify(name, check) {
  if (!check) throw Error("[FAIL] " + name);
  console.log("[OK] " + name);
  count++;
}
const edge = read("supabase/homologacao/entregas/create-order/index.ts");
const sql = read("supabase/homologacao/entregas/20261029_cash_direct_staging_only.sql");
const labels = read("scripts/harden-entregas-cash-staging-labels.mjs");
const checkout = read("scripts/harden-entregas-payment-provider-boundary.mjs");
const directOps = read("scripts/harden-entregas-direct-payment-operations.mjs");
const build = read("scripts/build-isolated-module.mjs");
verify("Edge: exige URL Supabase de staging e flag interna", edge.includes("isIsolatedHomologation(supabaseUrl") && edge.includes('Deno.env.get("APOIS_ENABLE_CASH_HOMOLOGATION") === "enabled-in-staging"'));
verify("Edge: bloqueia refs de todos os ambientes de produção", ["ptgkwyyolrdgnqketkjj","sbvhdgyuuperszlsllji","tbbzkrfupmqdywnzgnms","vqtucstyduxrqjgyigfk"].every(x=>edge.includes(x)));
verify("Edge: aceita apenas cash, com JWT e idempotência existentes", edge.includes('new Set(["cash"])') && edge.includes('auth.getUser(token)') && edge.includes('create_order_for_checkout_intent_v2'));
verify("Edge: exige snapshot cash/pending e não fabrica paid", edge.includes('snapshot.payment_method !== "cash" || snapshot.payment_status !== "pending"') && !/payment_status:\s*["']paid["']/.test(edge));
verify("Banco: bloqueia migração para base com dados", sql.includes("from auth.users limit 1") && sql.includes("from public.orders limit 1") && sql.includes("from public.merchants limit 1"));
verify("Banco: cash restrito a merchant de teste e pending", sql.includes("private.apois_cash_homologation_merchants") && sql.includes("new.payment_method='cash'") && sql.includes("new.payment_status <> 'pending'"));
verify("Banco: entitlement especial só para lojas whitelist", sql.includes("public.merchant_subscription_in_good_standing") && sql.includes("h.merchant_id=_merchant_id and h.enabled"));
verify("Banco: RLS limita leitura a membros autorizados", sql.includes("create policy \"Merchant staging cash order read\"") && sql.includes("current_user_is_merchant_member") && sql.includes("public.apois_is_homologation_cash_merchant"));
verify("Cliente: checkout mantém cash sem gateway", checkout.includes('const paymentMethod = "cash"') && checkout.includes('paymentMethod: "cash"') && checkout.includes("SEM GATEWAY DA APOIS"));
verify("Painel: cash/pending é operacional, sem converter para paid", directOps.includes('return status === "paid" || (method === "cash" && status === "pending");') && directOps.includes("isAlertableOrderPayment("));
verify("UI: identifica simulação e proíbe cobrança", labels.includes("Pagamento em dinheiro — TESTE (não pagar)") && labels.includes("Nenhum dinheiro deve ser entregue ou cobrado."));
verify("UI: execução de staging falha em refs de produção", labels.includes("production.has(ref)") && labels.includes('mode !== "enabled-in-staging"'));
verify("Pipeline principal não foi conectado a deploy ou modo de teste", !build.includes("harden-entregas-cash-staging-labels.mjs") && !build.includes("supabase/homologacao/entregas/create-order"));
verify("Não há instrução de ativar PIX real ou marcar pedido como pago", !sql.includes("update public.orders set payment_status='paid'") && !edge.includes("safe2pay-create-order-pix"));
console.log("PASS: "+count+" verificações estáticas, SEM APK e SEM alteração no Supabase.");
