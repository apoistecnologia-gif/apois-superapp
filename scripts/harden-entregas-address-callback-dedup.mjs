// APOIS_ADDRESS_CALLBACK_DEDUP_V14
//
// Defeito real encontrado na auditoria de 07/11: o callback onAddressSelected do
// cadastro de endereço ficou com o bloco de V12 repetido três vezes
// (declaração de `hasValidCoordinates` triplicada). É um SyntaxError de
// JavaScript — "Identifier 'hasValidCoordinates' has already been declared" —
// que quebra a tela de novo endereço em runtime.
//
// Aqui o bloco de seleção é reconstruído a partir de um único template, em vez
// de deduplicar linha a linha: assim o resultado é sempre sintaticamente
// válido, independentemente de quantas cópias existam.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(process.env.APOIS_ENTREGAS_WORKSPACE || '.work/entregas');
const missingFields = '["postal_code", "street", "number", "neighborhood", "city", "state"]';

function buildCallback(parameter) {
  return `onAddressSelected={(${parameter}) => {
              // APOIS_ADDRESS_SELECTION_V12: um novo ponto nunca herda o endereço anterior.
              const hasValidCoordinates = typeof ${parameter}.latitude === "number" && typeof ${parameter}.longitude === "number"
                && Number.isFinite(${parameter}.latitude) && Number.isFinite(${parameter}.longitude)
                && ${parameter}.latitude >= -90 && ${parameter}.latitude <= 90
                && ${parameter}.longitude >= -180 && ${parameter}.longitude <= 180;
              missingLocationFieldsRef.current = new Set(
                ${missingFields}.filter(
                  (field) => !String(${parameter}[field as keyof typeof ${parameter}] ?? "").trim(),
                ),
              );
              ++cepRequestRef.current; // Uma seleção nova cancela consulta de CEP pendente.
              setIsLookingUpCEP(false);
              confirmedUfRef.current = normalizeBrazilUF(${parameter}.state);
              setFormData((previous) => ({
                ...previous,
                street: ${parameter}.street || "",
                neighborhood: ${parameter}.neighborhood || "",
                city: ${parameter}.city || "",
                state: normalizeBrazilUF(${parameter}.state),
                postal_code: ${parameter}.postal_code || "",
                number: ${parameter}.number || "",
                latitude: hasValidCoordinates ? ${parameter}.latitude ?? null : null,
                longitude: hasValidCoordinates ? ${parameter}.longitude ?? null : null,
              }));`;
}

const targets = [
  ['src/routes/enderecos/novo.tsx', 'address'],
  ['src/routes/enderecos/editar/$addressId.tsx', 'addr'],
];

const failures = [];
for (const [path, parameter] of targets) {
  const full = resolve(root, path);
  let source = readFileSync(full, 'utf8');
  const marker = `onAddressSelected={(${parameter}) => {`;
  const start = source.indexOf(marker);
  if (start < 0) {
    console.log(`[OK] Entregas: ${path} sem callback de seleção (não aplicável)`);
    continue;
  }
  const end = source.indexOf('\n            }}', start);
  if (end < 0) {
    failures.push(`${path}: fechamento do callback não localizado`);
    continue;
  }

  const head = source.slice(0, start);
  const tail = source.slice(end);
  const rebuilt = buildCallback(parameter);
  const next = `${head}${rebuilt}${tail}`;
  if (next !== source) writeFileSync(full, next, "utf8");
  source = next;

  const bodyStart = source.indexOf(marker);
  const bodyEnd = source.indexOf('\n            }}', bodyStart);
  const body = source.slice(bodyStart, bodyEnd);

  const declarations = body.split('const hasValidCoordinates =').length - 1;
  if (declarations !== 1) failures.push(`${path}: ${declarations} declaração(ões) de hasValidCoordinates`);
  for (const required of ['missingLocationFieldsRef.current = new Set(', '++cepRequestRef.current', 'confirmedUfRef.current = normalizeBrazilUF(', 'state: normalizeBrazilUF(']) {
    if (!body.includes(required)) failures.push(`${path}: bloco de seleção perdeu "${required}"`);
  }
  console.log(`[OK] Entregas: ${path} — callback de seleção reconstruído e íntegro`);
}

if (failures.length) {
  console.error('[FAIL] Address dedup: callback de seleção inválido:');
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log('[OK] Entregas: seleção de endereço sem declarações duplicadas e com GPS/UF preservados.');
