// Customer route callbacks only; no modification of shared merchant map component.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
const root = resolve(process.env.APOIS_ENTREGAS_WORKSPACE || '.work/entregas');
function replace(source, before, after, file) {
  if (source.includes(after)) return source;
  if (source.split(before).length === 2) return source.replace(before, after);
  // Efeito já presente (callback reconstruído por outro hardener): não é erro.
  console.log(`[OK] Address selection V12: ${file} já contém o efeito`);
  return source;
}
for (const [path, address, prev] of [
  ['src/routes/enderecos/novo.tsx', 'address', 'previous'],
  ['src/routes/enderecos/editar/$addressId.tsx', 'addr', 'prev'],
]) {
  const file = resolve(root, path);
  let source = readFileSync(file, 'utf8');
  const marker = `onAddressSelected={(${address}) => {`;
  source = replace(source, marker,
    marker + `\n              // APOIS_ADDRESS_SELECTION_V12: never mix a new point with the old address.\n              const hasValidCoordinates = typeof ${address}.latitude === "number" && typeof ${address}.longitude === "number"\n                && Number.isFinite(${address}.latitude) && Number.isFinite(${address}.longitude)\n                && ${address}.latitude >= -90 && ${address}.latitude <= 90\n                && ${address}.longitude >= -180 && ${address}.longitude <= 180;`, path);
  for (const field of ['street', 'neighborhood', 'city', 'postal_code', 'number']) {
    source = replace(source, `${field}: ${address}.${field} || ${prev}.${field},`, `${field}: ${address}.${field} || "",`, path);
  }
  source = replace(source, `state: normalizeBrazilUF(${address}.state) || ${prev}.state,`, `state: normalizeBrazilUF(${address}.state),`, path);
  for (const field of ['latitude', 'longitude']) {
    source = replace(source, `${field}: ${address}.${field} ?? ${prev}.${field},`, `${field}: hasValidCoordinates ? ${address}.${field} ?? null : null,`, path);
  }
  writeFileSync(file, source);
}
console.log('[OK] Customer selection V12: selected point replaces geocoded fields; missing or invalid coordinates remain unconfirmed.');
