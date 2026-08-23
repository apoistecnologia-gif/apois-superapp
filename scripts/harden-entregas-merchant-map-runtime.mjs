import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const path = resolve('.work/entregas/src/components/GoogleMapsAddressSelector.tsx');
let source = readFileSync(path, 'utf8');

// The merchant panel must never depend on TanStack server functions for Maps.
// In the static/mobile Superapp there is no TanStack server runtime carrying
// SUPABASE_URL/VITE_SUPABASE_* server credentials, which produced the visible
// "Supabase server authentication is not configured" toast. Maps calls are
// authenticated by the Supabase browser session and sent to our Edge Function.
if (source.includes('useServerFn(') || source.includes('google-maps.functions')) {
  source.split('\n').forEach((line, index) => {
    if (line.includes('useServerFn(') || line.includes('google-maps.functions')) {
      console.error(`[DEBUG] GoogleMapsAddressSelector.tsx:${index + 1}: ${line.trim()}`);
    }
  });
  throw new Error('Merchant map still contains TanStack server-function runtime');
}
if (!source.includes('supabase.functions.invoke("google-maps-address"')) {
  throw new Error('Merchant map is not routed through google-maps-address Edge Function');
}

const rawMerchantError = `        toast.error(\n          error instanceof Error && error.message\n            ? error.message\n            : "Não foi possível validar e salvar o endereço físico da loja.",\n        );`;
const safeMerchantError = `        toast.error("Não foi possível validar o endereço da loja agora. Tente novamente em instantes.");`;
if (source.includes(rawMerchantError)) {
  source = source.replace(rawMerchantError, safeMerchantError);
}

// Do not leak backend/runtime details into merchant-facing notifications.
if (source.includes('Supabase server authentication is not configured')) {
  throw new Error('Merchant map still exposes Supabase server configuration details');
}
if (source.includes('error instanceof Error && error.message')) {
  throw new Error('Merchant map still exposes a raw backend error message');
}

writeFileSync(path, source, 'utf8');
console.log('[OK] Entregas merchant map uses Supabase Edge Function only and hides backend configuration errors.');
