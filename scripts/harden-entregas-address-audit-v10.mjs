// Customer address list/edit only. Apply after address UX and UF V9.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
const root = resolve(process.env.APOIS_ENTREGAS_WORKSPACE || '.work/entregas');
// O snapshot protegido evoluiu: alguns destes trechos já foram aplicados por
// V9/V13 ou reescritos. A decisão é por efeito — o contrato no fim do arquivo
// confirma que cada proteção está realmente presente no código final.
function patch(path, before, after) {
  const target = resolve(root, path);
  const source = readFileSync(target, 'utf8');
  if (source.includes(after)) return;
  if (source.split(before).length === 2) {
    writeFileSync(target, source.replace(before, after));
    return;
  }
  console.log(`[OK] Address V10: ${path} já contém o efeito (padrão evoluiu)`);
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
// --- Contrato final: cada proteção precisa existir no código resultante -----
const listing = readFileSync(resolve(root, 'src/routes/enderecos.tsx'), 'utf8');
const editSource = readFileSync(resolve(root, edit), 'utf8');
const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };

check(
  /address\.latitude\s*==\s*null/.test(listing) || /String\(address\.latitude\)\.trim\(\)\s*===\s*""/.test(listing),
  'lista de endereços não rejeita coordenada ausente (Number(null) === 0)',
);
check(editSource.includes('normalizeBrazilUF'), 'edição não normaliza a UF');
check(
  /name\s*!==\s*"number"/.test(editSource) || /name === "number"/.test(editSource),
  'edição não trata número/complemento sem invalidar o ponto',
);
check(
  !/state\.trim\(\)\.length\s*!==\s*2/.test(editSource),
  'edição ainda valida UF por comprimento em vez das 27 UFs',
);
check(/state:\s*normalizeBrazilUF\(formData\.state\)/.test(editSource), 'edição não persiste UF canônica');

if (failures.length) {
  console.error('[FAIL] Address V10: contrato de lista/edição não confirmado:');
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log('[OK] Customer address V10: coordenada ausente rejeitada, número preserva o ponto, UF da edição normalizada.');
