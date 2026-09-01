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
