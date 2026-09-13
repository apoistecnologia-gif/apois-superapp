import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runSourcePreflight } from './lib/source-preflight.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const result = runSourcePreflight({ root, checkPins: true });

if (!result.rootGitMetadata && result.ok) {
  console.log('[OK] verify:pins: export/ZIP sem .git; sources completos, pins não verificáveis neste ambiente.');
}

process.exit(result.ok ? 0 : 1);
