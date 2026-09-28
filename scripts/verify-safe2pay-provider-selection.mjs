import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
let failed=false;
const fail=(m)=>{failed=true;console.error(`[FAIL] ${m}`)};
const ok=(m)=>console.log(`[OK] ${m}`);

const corridas=readFileSync(resolve('supabase/corridas-forward-migrations/20260921174500_select_safe2pay_provider.sql'),'utf8');
for(const marker of [
  "'finance.target_electronic_payment_provider'",
  `'"safe2pay"'::jsonb`,
  "'finance.ride_electronic_payments_enabled'",
  "'false'::jsonb",
  "'safe2pay'::text",
  "tg_op = 'INSERT'",
  "raise exception 'retired_payment_provider'",
]) if(!corridas.includes(marker)) fail(`Corridas provider selection sem marker: ${marker}`);

const entregas=readFileSync(resolve('supabase/entregas-forward-migrations/20260921175000_select_safe2pay_provider.sql'),'utf8');
for(const marker of [
  "'order_payment_provider'",
  `'"safe2pay_marketplace"'::jsonb`,
  "'safe2pay_provider_enabled'",
  "'false'::jsonb",
]) if(!entregas.includes(marker)) fail(`Entregas provider selection sem marker: ${marker}`);

if (/"mercadopago"'::jsonb|"asaas"'::jsonb|"pagbank"'::jsonb|"openpix"'::jsonb/.test(corridas+entregas)) {
  fail('migration de seleção ainda escolhe provider aposentado');
}
if(failed) process.exit(1);
ok('Safe2Pay selecionado como target sem ativação prematura.');
