import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

let failed = false;
function fail(message) { console.error(`[FAIL] ${message}`); failed = true; }
function ok(message) { console.log(`[OK] ${message}`); }
function read(path) {
  const full = resolve(path);
  if (!existsSync(full)) { fail(`arquivo ausente: ${path}`); return ''; }
  return readFileSync(full, 'utf8');
}

const rideMethods = read('.work/corridas/src/hooks/use-payment-methods.tsx');
const rideService = read('.work/corridas/src/services/payments/payment-service.ts');
if (rideMethods) {
  const hasCanonicalActiveFilter = rideMethods.includes('(method) => method.isActive && method.enabled');
  const delegatesToPaymentService = rideMethods.includes('paymentService.getPaymentMethods()');
  if (rideMethods.includes('method.code === "pix"')) fail('Corridas voltou a PIX-only');
  else if (!hasCanonicalActiveFilter && !delegatesToPaymentService) fail('Corridas perdeu filtro/delegação dos meios ativos');
  else ok('Corridas preserva os meios ativos');
}
if (rideService) {
  const markers = [
    'const isDirectToDriver = code === "cash" || code === "credit";',
    'Pague diretamente ao motorista ao final da corrida.',
    'Pague diretamente ao motorista com cartão de crédito.',
  ];
  for (const marker of markers) if (!rideService.includes(marker)) fail(`Corridas: política direta ausente (${marker})`);
  if (!markers.some((marker) => !rideService.includes(marker))) ok('Corridas: PIX eletrônico + Dinheiro/Cartão direto ao motorista confirmado');
}

const checkout = read('.work/entregas/src/routes/checkout.tsx');
if (checkout) {
  if (!checkout.includes('const paymentMethod = "pix";')) fail('Entregas: checkout deixou de ser PIX-only');
  if (!checkout.includes('merchant-payment-readiness')) fail('Entregas: checkout não valida recebedor Mercado Pago');
  if (!checkout.includes('const pixFunction = "create-merchant-mercadopago-pix";')) fail('Entregas: checkout não usa Mercado Pago direto do estabelecimento');
  if (checkout.includes('new Set(["openpix", "asaas"])') || /create-(?:asaas-)?pix-charge/.test(checkout)) fail('Entregas: caminho legado OpenPix/Asaas permaneceu no checkout final');
  if (!checkout.includes('get_delivery_checkout_readiness')) fail('Entregas: checkout não valida readiness de repasse direto ao entregador');
  if (!checkout.includes('deliveryPlatformAvailable')) fail('Entregas: bloqueio de entrega sem payout direto não está ativo');
  if (!failed) ok('Entregas: novos pedidos usam Mercado Pago do estabelecimento e entrega fica bloqueada sem payout direto homologado');
}

const merchantHardener = read('scripts/harden-entregas-merchant-mercadopago-v2.mjs');
if (merchantHardener) {
  if (!merchantHardener.includes('create-merchant-mercadopago-pix')) fail('Hardener Mercado Pago perdeu função direta do estabelecimento');
  if (!merchantHardener.includes('merchant-payment-readiness')) fail('Hardener Mercado Pago perdeu readiness do recebedor');
}

process.exit(failed ? 1 : 0);
