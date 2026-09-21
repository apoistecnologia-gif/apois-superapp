import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runSourcePreflight } from './lib/source-preflight.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const result = runSourcePreflight({ root, checkPins: true });

if (!result.rootGitMetadata && result.ok) {
  console.log('[OK] preflight de sources concluído em modo export/ZIP; conteúdo validado e pins marcados como não verificáveis sem .git.');
} else if (result.ok) {
  console.log('[OK] preflight de sources concluído com conteúdo e pins Git validados.');
}

process.exit(result.ok ? 0 : 1);
