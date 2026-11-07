// Customer address list/edit only. Apply after address UX and UF V9.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
const root = resolve(process.env.APOIS_ENTREGAS_WORKSPACE || '.work/entregas');
function patch(path, before, after) {
  const target = resolve(root, path);
  const source = readFileSync(target, 'utf8');
  if (source.includes(after)) return;
  if (source.split(before).length !== 2) throw new Error(`Address V10: unexpected source in ${path}`);
  writeFileSync(target, source.replace(before, after));
}
patch('src/routes/enderecos.tsx',
  'const hasCoordinates = (address: CustomerAddress) => {\n  const lat = Number(address.latitude);',
  'const hasCoordinates = (address: CustomerAddress) => {\n  // APOIS_ADDRESS_COORDINATES_V10: missing values must not become numeric zero.\n  if (address.latitude == null || address.longitude == null ||\n      String(address.latitude).trim() === "" || String(address.longitude).trim() === "") return false;\n  const lat = Number(address.latitude);');
const edit = 'src/routes/enderecos/editar/$addressId.tsx';
patch(edit,
  'import { GoogleMapsAddressSelector } from "@/components/GoogleMapsAddressSelector";',
  'import { GoogleMapsAddressSelector } from "@/components/GoogleMapsAddressSelector";\nimport { normalizeBrazilUF } from "@/lib/brazil-uf"; // APOIS_ADDRESS_EDIT_V10');
patch(edit,
  '      const mustReconfirmPoint = locationFields.has(name) && !isCompletingMissingField;',
  '      // Match create-address policy: house number/complement do not move the confirmed point.\n      const samePlaceValue = name === "state"\n        ? Boolean(normalizeBrazilUF(previousValue) && normalizeBrazilUF(previousValue) === normalizeBrazilUF(value))\n        : previousValue === value.trim();\n      const mustReconfirmPoint = name !== "number" && locationFields.has(name) && !isCompletingMissingField && !samePlaceValue;');
patch(edit, '          state: data.state,', '          state: normalizeBrazilUF(data.state) || data.state,');
patch(edit, '                state: addr.state || prev.state,', '                state: normalizeBrazilUF(addr.state) || prev.state,');
patch(edit, '    if (formData.state.trim().length !== 2) {', '    if (!normalizeBrazilUF(formData.state)) {');
patch(edit, '      toast.error("O estado (UF) deve ter exatamente 2 letras");', '      toast.error("UF inválida. Confira a sigla do estado, por exemplo PE.");');
patch(edit, '          state: formData.state.toUpperCase(),', '          state: normalizeBrazilUF(formData.state),');
console.log('[OK] Customer address V10: missing coordinates rejected; number editing retains point; edit UF normalized.');
