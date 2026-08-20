import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const workspace = process.env.APOIS_MOTORISTA_WORKSPACE || '.work/motorista-test';

function patch(relativePath, transform, label) {
  const path = resolve(root, workspace, relativePath);
  const before = readFileSync(path, 'utf8');
  const after = transform(before);
  if (after === before) {
    console.log(`[OK] ${label} (já aplicado/sem alteração)`);
    return;
  }
  writeFileSync(path, after, 'utf8');
  console.log(`[OK] ${label}`);
}

patch('src/lib/googleMaps.ts', (source) => {
  const replacement = `// No APK/Superapp usamos primeiro a chave browser configurada no ambiente APOIS.\n// Mantemos as variáveis legadas apenas como fallback para preservar compatibilidade web.\nexport const GOOGLE_MAPS_API_KEY =\n  (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined) ??\n  (import.meta.env.VITE_APOIS_GOOGLE_MAPS_BROWSER_KEY as string | undefined) ??\n  (import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY as string | undefined) ??\n  \"\";`;

  if (source.includes(replacement)) return source;

  const exportStart = source.indexOf('export const GOOGLE_MAPS_API_KEY =');
  if (exportStart < 0) throw new Error('googleMaps.ts: export GOOGLE_MAPS_API_KEY não encontrado');

  const statementEnd = source.indexOf(';', exportStart);
  if (statementEnd < 0) throw new Error('googleMaps.ts: fim do export GOOGLE_MAPS_API_KEY não encontrado');

  let commentStart = source.lastIndexOf('\n//', exportStart);
  if (commentStart < 0) commentStart = exportStart;
  else commentStart += 1;

  const beforeBlock = source.slice(0, commentStart);
  const afterBlock = source.slice(statementEnd + 1);
  return `${beforeBlock}${replacement}${afterBlock}`;
}, 'motorista: Google Maps usa chave APOIS do Codemagic');

patch('vite.mobile.config.ts', (source) => {
  if (source.includes('base: "./"')) return source;
  const marker = '  return {\n    appType: "spa",';
  if (!source.includes(marker)) throw new Error('vite.mobile.config.ts: marcador appType não encontrado');
  return source.replace(marker, '  return {\n    base: "./",\n    appType: "spa",');
}, 'motorista: assets relativos para APK/Superapp Parceiro');

patch('src/components/AuthShell.tsx', (source) => {
  let next = source;
  next = next.replace('<DSCardHeader>', '<DSCardHeader className="text-center">');
  next = next.replace('<DSCardTitle className="text-2xl">{title}</DSCardTitle>', '<DSCardTitle className="text-center text-2xl">{title}</DSCardTitle>');
  next = next.replace('<DSCardDescription>{description}</DSCardDescription>', '<DSCardDescription className="text-center">{description}</DSCardDescription>');
  return next;
}, 'motorista: cabeçalho do login centralizado');

console.log(`[OK] hardening de campo concluído em ${workspace}`);
