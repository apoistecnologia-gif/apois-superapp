import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const policy = JSON.parse(readFileSync(resolve('docs/payment-provider-policy.json'), 'utf8'));
let failed = false;
const fail = (m) => { failed = true; console.error(`[FAIL] ${m}`); };
const ok = (m) => console.log(`[OK] ${m}`);

if (policy.provider !== 'safe2pay') fail(`provider oficial inesperado: ${policy.provider}`);
if (policy.mode !== 'marketplace_split') fail(`modo Safe2Pay inesperado: ${policy.mode}`);
if (policy.activation !== 'fail_closed_until_sandbox_e2e') fail('Safe2Pay deve permanecer fail-closed até sandbox E2E');

const legacy = new Set(policy.legacyProviders ?? []);
for (const name of ['mercadopago','asaas','pagbank','openpix']) {
  if (!legacy.has(name)) fail(`provider legado não classificado como aposentado: ${name}`);
}

const corridas = policy.products?.corridas;
if (!corridas) fail('política de Corridas ausente');
else {
  if (!corridas.electronicMethods?.includes('pix')) fail('Corridas deve declarar Pix Safe2Pay');
  if (Number(corridas.platformCommissionPercent) !== 0) fail('Corridas: comissão por corrida deve permanecer 0%');
  if (corridas.receiver !== 'driver') fail('Corridas: recebedor eletrônico esperado é motorista');
}

const entregas = policy.products?.entregas;
if (!entregas) fail('política de Entregas ausente');
else {
  if (!entregas.electronicMethods?.includes('pix')) fail('Entregas deve declarar Pix Safe2Pay');
  if (Number(entregas.platformCommissionPercent) !== 0) fail('Entregas: comissão por pedido deve permanecer 0%');
  const receivers = new Set(entregas.receivers ?? []);
  for (const name of ['merchant','courier']) if (!receivers.has(name)) fail(`Entregas: receiver ausente: ${name}`);
}

const cfg = policy.safe2pay ?? {};
if (cfg.authHeader !== 'X-API-KEY') fail('Safe2Pay: header de autenticação divergente da documentação');
if (cfg.paymentEndpoint !== 'https://payment.safe2pay.com.br/v2/payment') fail('Safe2Pay: endpoint de cobrança inesperado');
if (cfg.marketplaceSubaccountEndpoint !== 'https://api.safe2pay.com.br/v2/marketplace/add') fail('Safe2Pay: endpoint de subconta inesperado');
if (String(cfg.pixPaymentMethodCode) !== '6') fail('Safe2Pay: PaymentMethod Pix deve ser código 6');

for (const field of ['IdReceiver','CodeTaxType','Amount','IsPayTax']) {
  if (!cfg.splitFields?.includes(field)) fail(`Safe2Pay: campo obrigatório de split ausente: ${field}`);
}

const fee = policy.unresolvedCommercialDecision;
if (!fee || fee.key !== 'SAFE2PAY_PIX_FEE_PAYER') fail('Safe2Pay: decisão de fee payer não está explicitamente modelada');
else ok('fee payer permanece decisão comercial explícita, sem valor inventado');

if (failed) process.exit(1);
ok('Safe2Pay é o único provider eletrônico alvo e providers legados permanecem aposentados.');
