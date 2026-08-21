import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

let failed = false;
function check(path, markers, label) {
  const full = resolve(path);
  if (!existsSync(full)) {
    console.error(`[FAIL] ${label}: arquivo ausente ${path}`);
    failed = true;
    return;
  }
  const source = readFileSync(full, 'utf8');
  const missing = markers.filter((marker) => !source.includes(marker));
  if (missing.length) {
    console.error(`[FAIL] ${label}: ${missing.join(' | ')}`);
    failed = true;
  } else {
    console.log(`[OK] ${label}`);
  }
}
function forbid(path, markers, label) {
  const full = resolve(path);
  if (!existsSync(full)) {
    console.error(`[FAIL] ${label}: arquivo ausente ${path}`);
    failed = true;
    return;
  }
  const source = readFileSync(full, 'utf8');
  const found = markers.filter((marker) => source.includes(marker));
  if (found.length) {
    console.error(`[FAIL] ${label}: ${found.join(' | ')}`);
    failed = true;
  } else {
    console.log(`[OK] ${label}`);
  }
}

check('scripts/neutralize-entregas-superapp-legacy.mjs', [
  "await import('./normalize-entregas-merchant-mp-handoff.mjs');",
  "await import('./harden-entregas-merchant-mercadopago-v2.mjs');",
  "await import('./harden-entregas-delivery-readiness.mjs');",
  "await import('./harden-entregas-merchant-direct-finance.mjs');",
  "await import('./harden-entregas-superapp-refunds.mjs');",
], 'Entregas executa handoff, Mercado Pago, readiness, financeiro direto e estornos na cópia .work');

check('scripts/normalize-entregas-merchant-mp-handoff.mjs', [
  'postAuthRuntime',
  'merchantHardenerInput',
  'create-merchant-mercadopago-pix',
  'bloco financeiro do checkout mudou',
], 'handoff resolve a ordem dos hardeners sem escolher provedor silenciosamente');

check('scripts/harden-entregas-merchant-mercadopago-v2.mjs', [
  'merchant-payment-readiness',
  'create-merchant-mercadopago-pix',
  'MerchantMercadoPagoConnection',
  'A APOIS não recebe o valor da venda e não cobra percentual por pedido.',
], 'Entregas direciona PIX ao Mercado Pago do estabelecimento com taxa APOIS zero');

check('scripts/harden-entregas-delivery-readiness.mjs', [
  'get_delivery_checkout_readiness',
  'deliveryFinancialReady',
  'delivery-financial-readiness',
  'deliveryFinancialLoading || !deliveryFinancialReady',
], 'checkout bloqueia Entrega antes da cobrança quando repasse do entregador não está pronto');

check('scripts/harden-entregas-merchant-direct-finance.mjs', [
  'Recebimento direto no Mercado Pago',
  'Comissão APOIS',
  'R$ 0,00',
  'A APOIS não oferece saque manual do valor das vendas.',
  'carteira antiga permanece apenas como registro legado',
], 'financeiro do estabelecimento não trata venda direta como saldo custodiado pela APOIS');
forbid('scripts/harden-entregas-merchant-direct-finance.mjs', [
  'onClick={requestPayout}',
  'onClick={savePayoutAccount}',
], 'novo painel financeiro não reintroduz ações de saque/cadastro PIX');

check('supabase/migrations/20260821233000_disable_legacy_courier_payout_until_marketplace_direct_live.sql', [
  'marketplace_direct_pending',
  'revoke execute on function public.request_payout(uuid,numeric,text) from authenticated;',
  'get_courier_payout_readiness',
], 'saque legado fica bloqueado no backend até fluxo direto homologado');

check('supabase/migrations/20260821233200_guard_delivery_orders_until_courier_marketplace_live.sql', [
  'orders_require_delivery_financial_readiness',
  "v_mode <> 'marketplace_direct_live'",
], 'backend impede pedido de Entrega antes do repasse direto do entregador');

check('supabase/migrations/20260821233500_expose_delivery_checkout_readiness.sql', [
  'get_delivery_checkout_readiness',
  "v_mode = 'marketplace_direct_live'",
  'delivery_available',
], 'estado seguro de disponibilidade da entrega está versionado');

check('scripts/harden-entregas-superapp-refunds.mjs', [
  'process-superapp-refund',
  'src/routes/pedido/$orderId/index.tsx',
  'src/components/MerchantOrderControlCenter.tsx',
  'src/routes/merchant.tsx',
  'src/routes/admin.tsx',
], 'Cancelamentos do Superapp usam conciliador compatível com Mercado Pago OAuth');

check('.env.example', [
  'MERCADO_PAGO_OAUTH_CLIENT_ID=',
  'MERCADO_PAGO_OAUTH_CLIENT_SECRET=',
  'MERCADO_PAGO_OAUTH_TOKEN_KEY_BASE64=',
  'MERCADO_PAGO_MERCHANT_REDIRECT_URI=',
  'MERCADO_PAGO_MERCHANT_WEBHOOK_SECRET=',
], 'Segredos externos Mercado Pago necessários estão documentados sem valores reais');

process.exit(failed ? 1 : 0);
