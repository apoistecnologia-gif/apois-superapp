import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const files = {
  corridas: resolve('supabase/corridas-forward-migrations/20260921173000_safe2pay_marketplace_foundation.sql'),
  entregas: resolve('supabase/entregas-forward-migrations/20260921173500_safe2pay_marketplace_foundation.sql'),
};
let failed = false;
const fail=(m)=>{ failed=true; console.error(`[FAIL] ${m}`); };
const ok=(m)=>console.log(`[OK] ${m}`);

const corridas=readFileSync(files.corridas,'utf8');
for(const marker of [
  'create table if not exists public.driver_safe2pay_accounts',
  'safe2pay_receiver_id bigint unique',
  'create table if not exists public.safe2pay_ride_transactions',
  'create table if not exists public.safe2pay_webhook_events',
  'unique(event_key)',
  'enable row level security',
  'revoke all on table public.driver_safe2pay_accounts from anon, authenticated',
  'grant select, insert, update, delete on table public.driver_safe2pay_accounts to service_role',
]) if(!corridas.includes(marker)) fail(`Corridas Safe2Pay foundation sem marker: ${marker}`);

const entregas=readFileSync(files.entregas,'utf8');
for(const marker of [
  'create table if not exists public.merchant_safe2pay_accounts',
  'create table if not exists public.safe2pay_order_transactions',
  'create table if not exists public.safe2pay_webhook_events',
  'merchant_amount numeric(12,2)',
  'round(merchant_amount::numeric, 2) = round(amount::numeric, 2)'
  'unique(event_key)',
  'enable row level security',
  'from anon, authenticated',
  'to service_role',
]) if(!entregas.includes(marker)) fail(`Entregas Safe2Pay foundation sem marker: ${marker}`);

for(const [name,sql] of Object.entries({corridas,entregas})){
  for(const forbidden of [
    'encrypted_api_key',
    'access_token',
    'refresh_token',
    'MERCADO_PAGO',
    'ASAAS_',
    'PAGBANK_',
    'OPENPIX_',
  ]) if(sql.includes(forbidden)) fail(`${name}: migration Safe2Pay contém segredo/provider legado: ${forbidden}`);
}

if(failed) process.exit(1);
ok('Safe2Pay marketplace foundation é server-only, RLS-enabled e sem segredo persistido.');
