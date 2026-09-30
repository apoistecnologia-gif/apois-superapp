import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const files = {
  helper: 'supabase/functions/_shared/safe2pay.ts',
  onboarding: 'supabase/functions/safe2pay-subaccount-onboarding/index.ts',
  reconcile: 'supabase/functions/safe2pay-subaccount-reconcile/index.ts',
};
let failed = false;
const fail = (m) => { failed = true; console.error('[FAIL] ' + m); };
const ok = (m) => console.log('[OK] ' + m);
const src = {};
for (const [k,p] of Object.entries(files)) src[k] = readFileSync(resolve(p), 'utf8');

for (const marker of [
  'https://api.safe2pay.com.br/v2/marketplace/add',
  'https://api.safe2pay.com.br/v2/marketplace/get?id=',
  'extractSafe2PaySubaccountPublic',
  'ResponseDetail',
]) if (!src.helper.includes(marker)) fail('helper sem contrato de subconta: ' + marker);

for (const marker of [
  'SAFE2PAY_ONBOARDING_PRODUCT',
  'driver_safe2pay_accounts',
  'merchant_safe2pay_accounts',
  'status:"provisioning"',
  'status:"reconciliation_required"',
  'request_fingerprint',
  'safe2pay_receiver_id',
  'IsPanelRestricted:true',
  'driver_safe2pay_profile_incomplete',
  'body: { target_id',
]) if (!src.onboarding.includes(marker) && marker !== 'body: { target_id') fail('onboarding sem proteção: ' + marker);


if (!src.onboarding.includes('targetSelect=product==="rides"')) fail('onboarding de Corridas não hidrata dados do motorista no backend');
if (!src.onboarding.includes('const d=found.data as Record<string,unknown>')) fail('onboarding de Corridas ainda depende de PII enviada pelo cliente');

for (const forbidden of [
  'MerchantSplit:',
  'TokenSandbox',
  'SecretKeySandbox',
  'console.log(provider',
  'console.log(requestBody',
]) if (src.onboarding.includes(forbidden)) fail('onboarding contém configuração/segredo indevido: ' + forbidden);

for (const marker of [
  'SAFE2PAY_ONBOARDING_PRODUCT',
  'getSafe2PaySubaccount(receiver)',
  'safe2pay_receiver_id:receiver',
  'status:"active"',
]) if (!src.reconcile.includes(marker)) fail('reconcile sem proteção: ' + marker);

if (failed) process.exit(1);
ok('Safe2Pay subaccount onboarding/reconciliation é admin-only, fail-closed e não persiste credenciais do receiver.');
