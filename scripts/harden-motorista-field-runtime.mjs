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
  const legacy = `// Chave do Google Maps fornecida pelo conector Lovable (referrer-restricted: *.lovable.app).\nexport const GOOGLE_MAPS_API_KEY =\n  (import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY as string | undefined) ?? "";`;
  const replacement = `// No APK/Superapp usamos a chave browser configurada no ambiente APOIS.\n// Mantemos o conector legado apenas como último fallback para preservar compatibilidade web.\nexport const GOOGLE_MAPS_API_KEY =\n  (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined) ??\n  (import.meta.env.VITE_APOIS_GOOGLE_MAPS_BROWSER_KEY as string | undefined) ??\n  (import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY as string | undefined) ??\n  "";`;
  if (source.includes(replacement)) return source;
  if (!source.includes(legacy)) throw new Error('googleMaps.ts: padrão de chave legado não encontrado');
  return source.replace(legacy, replacement);
}, 'motorista: Google Maps usa chave APOIS do Codemagic');

patch('src/components/AuthShell.tsx', (source) => {
  let next = source;
  next = next.replace('<DSCardHeader>', '<DSCardHeader className="text-center">');
  next = next.replace('<DSCardTitle className="text-2xl">{title}</DSCardTitle>', '<DSCardTitle className="text-center text-2xl">{title}</DSCardTitle>');
  next = next.replace('<DSCardDescription>{description}</DSCardDescription>', '<DSCardDescription className="text-center">{description}</DSCardDescription>');
  return next;
}, 'motorista: cabeçalho do login centralizado');

console.log(`[OK] hardening de campo concluído em ${workspace}`);
