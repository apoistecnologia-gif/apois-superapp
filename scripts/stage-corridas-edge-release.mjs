import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const sourceRoot = resolve(root, '.work/corridas/supabase/functions');
const outputRoot = resolve(root, '.release/corridas-functions');
const slugs = ['request-ride', 'driver-ride-action', 'cancel-ride', 'send-ride-push'];

if (!existsSync(sourceRoot)) {
  throw new Error('[FAIL] Corridas Edge release: .work/corridas não preparado. Execute build:corridas/prepare:modules antes.');
}

rmSync(outputRoot, { recursive: true, force: true });
mkdirSync(outputRoot, { recursive: true });

for (const slug of slugs) {
  const source = resolve(sourceRoot, slug);
  if (!existsSync(resolve(source, 'index.ts'))) {
    throw new Error(`[FAIL] Corridas Edge release: função ausente no workspace endurecido: ${slug}`);
  }
  cpSync(source, resolve(outputRoot, slug), { recursive: true });
}

const sharedSource = resolve(sourceRoot, '_shared');
if (existsSync(sharedSource)) {
  cpSync(sharedSource, resolve(outputRoot, '_shared'), { recursive: true });
}

writeFileSync(
  resolve(outputRoot, 'RELEASE-MANIFEST.json'),
  JSON.stringify({
    generatedAt: new Date().toISOString(),
    projectRef: 'vqtucstyduxrqjgyigfk',
    source: '.work/corridas/supabase/functions',
    deployPolicy: 'explicit-per-slug-only',
    slugs,
  }, null, 2) + '\n',
  'utf8',
);

console.log('[OK] Corridas Edge release: bundle endurecido materializado em .release/corridas-functions');
console.log('[INFO] Deploy permitido somente por slug explícito; nunca deploy-all.');
