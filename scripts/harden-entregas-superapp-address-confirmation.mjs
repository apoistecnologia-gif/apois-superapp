import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const path = resolve('.work/entregas/src/routes/enderecos.tsx');
let source = readFileSync(path, 'utf8');

const startMarker = '  const setDefaultWithFallback = async (addressId: string) => {';
const endMarker = '\n\n  const handleConfirmAddress = async () => {';
const start = source.indexOf(startMarker);
const end = source.indexOf(endMarker, start);

if (start >= 0 && end > start) {
  const replacement = `  const setDefaultAddress = async (addressId: string) => {\n    const { error } = await (supabase.rpc as any)("set_default_customer_address", {\n      _address_id: addressId,\n    });\n    if (error) throw error;\n  };`;
  source = `${source.slice(0, start)}${replacement}${source.slice(end)}`;
}

source = source.replace('await setDefaultWithFallback(selectedAddress.id);', 'await setDefaultAddress(selectedAddress.id);');

for (const marker of [
  'const setDefaultAddress = async (addressId: string)',
  '"set_default_customer_address"',
  'await setDefaultAddress(selectedAddress.id);',
]) {
  if (!source.includes(marker)) throw new Error(`Endereços: confirmação atômica ausente: ${marker}`);
}
for (const forbidden of [
  'setDefaultWithFallback',
  'RPC set_default_customer_address failed, using RLS fallback',
  '.update({ is_default: false })',
]) {
  if (source.includes(forbidden)) throw new Error(`Endereços: fallback não atômico ainda presente: ${forbidden}`);
}

writeFileSync(path, source, 'utf8');
console.log('[OK] Entregas: endereço padrão usa somente a RPC transacional do backend.');
