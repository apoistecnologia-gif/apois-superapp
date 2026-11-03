import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const buildScript = readFileSync(resolve('scripts/build-partner-modules.sh'), 'utf8');
const forbidden = [
  { pattern: /\|\s*xargs\s+-0\s+-r\s+sed\s+-i/, label: 'xargs -r/sed -i' },
  { pattern: /\|\s*xargs\s+-r(?:\s|$)/, label: 'xargs -r' },
  { pattern: /\|\s*[^\n]*\bsed\s+-i(?:\s|['"])/, label: 'sed -i' },
];
const failure = forbidden.find(({ pattern }) => pattern.test(buildScript));
if (failure) {
  console.error(`[FAIL] scripts/build-partner-modules.sh contém ${failure.label} GNU-only`);
  process.exit(1);
}
console.log('[OK] scripts/build-partner-modules.sh não contém opções GNU-only');

const adminBuildScript = readFileSync(resolve('scripts/build-admin-vercel-preview.sh'), 'utf8');
if (/\bcmp\s+-s\b/.test(adminBuildScript)) {
  console.error('[FAIL] Admin Vercel QA requires cmp, which is missing on the Vercel build image.');
  process.exit(1);
}
if (!adminBuildScript.includes('node -e ') || !adminBuildScript.includes('root.equals(preview)')) {
  console.error('[FAIL] Admin QA server-only endpoint must retain a strict byte comparison.');
  process.exit(1);
}
const adminHandler = readFileSync(resolve('api/admin/driver-documents.js'));
const previewHandler = readFileSync(resolve('admin-preview/api/admin/driver-documents.js'));
if (!adminHandler.equals(previewHandler)) {
  console.error('[FAIL] Admin QA endpoint source files differ.');
  process.exit(1);
}
console.log('[OK] Admin Vercel QA: no cmp dependency, byte-for-byte endpoint integrity preserved.');
