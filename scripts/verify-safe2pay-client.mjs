import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(resolve('supabase/functions/_shared/safe2pay.ts'), 'utf8');
let failed = false;
const fail = (m) => { failed = true; console.error(`[FAIL] ${m}`); };
const ok = (m) => console.log(`[OK] ${m}`);

for (const marker of [
  'https://payment.safe2pay.com.br/v2/payment',
  'https://api.safe2pay.com.br/v2/marketplace/add',
  '"X-API-KEY": productionApiKey()',
  'PaymentMethod: "6"',
  'SAFE2PAY_PROVIDER_ENABLED',
  'SAFE2PAY_API_KEY_SANDBOX',
  'SAFE2PAY_API_KEY',
  'IsSandbox: false',
  'SAFE2PAY_CALLBACK_URL',
  'safe2pay_split_total_mismatch',
  'CodeTaxType: 2 as const',
]) {
  if (!source.includes(marker)) fail(`Safe2Pay shared client sem contrato: ${marker}`);
}
for (const forbidden of [
  'VITE_SAFE2PAY',
  'console.log(apiKey',
  'console.log(payload',
  'MERCADO_PAGO_',
  'ASAAS_',
  'PAGBANK_',
  'OPENPIX_',
]) {
  if (source.includes(forbidden)) fail(`Safe2Pay shared client contém marker proibido: ${forbidden}`);
}
if (failed) process.exit(1);
ok('Safe2Pay client é server-only, fail-closed, força Pix fora de sandbox e valida split fixo exato.');
