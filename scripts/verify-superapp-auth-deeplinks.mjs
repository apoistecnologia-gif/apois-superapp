import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const targets = [
  'superapp/shell/dist/index.html',
  'superapp/shell/dist/modules/corridas/index.html',
  'superapp/shell/dist/modules/entregas/index.html',
  'superapp/shell/dist/modules/motorista/index.html',
];
let failed = false;
for (const relative of targets) {
  const source = readFileSync(resolve(relative), 'utf8');
  const hasTemporaryWindow =
    source.includes('Date.now() - Number(previous?.at || 0) < 5000') ||
    source.includes('Date.now()-Number(previous?.at||0)<5000');
  if (!hasTemporaryWindow) {
    console.error(`[FAIL] ${relative}: deep-link dedup não possui janela temporária`);
    failed = true;
  }
  if (source.includes('if(previous===rawUrl)return true') || source.includes('if (previous === rawUrl) return true')) {
    console.error(`[FAIL] ${relative}: callback idêntico continuaria bloqueado por toda a sessão`);
    failed = true;
  }
  if (hasTemporaryWindow) console.log(`[OK] ${relative}: repetição de callback só é bloqueada durante janela curta`);
}
process.exit(failed ? 1 : 0);
