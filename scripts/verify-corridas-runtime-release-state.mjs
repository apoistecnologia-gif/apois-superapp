import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const state = JSON.parse(readFileSync(resolve('docs/corridas-runtime-release-state.json'), 'utf8'));
const entries = Array.isArray(state.functions) ? state.functions : [];
let failed = false;

for (const slug of ['request-ride', 'driver-ride-action', 'cancel-ride', 'send-ride-push']) {
  const entry = entries.find((item) => item.slug === slug);
  if (!entry) {
    console.error(`[FAIL] runtime state sem função crítica: ${slug}`);
    failed = true;
    continue;
  }
  if (entry.releaseState !== 'RUNTIME_ALIGNED') {
    console.error(`[BLOCK] ${slug}: ${entry.releaseState}`);
    for (const blocker of entry.blockers ?? []) console.error(`        - ${blocker}`);
    failed = true;
  } else {
    console.log(`[OK] ${slug}: runtime alinhado com release aprovado`);
  }
}

if (failed) {
  console.error('[FAIL] Corridas runtime ainda não está alinhado ao bundle de release endurecido.');
  process.exit(1);
}
console.log('[OK] Corridas runtime critical path alinhado.');
