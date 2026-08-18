import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const lock = JSON.parse(readFileSync(new URL('../.apois/source-lock.json', import.meta.url), 'utf8'));
const modules = [
  ['entregas', 'apps/entregas'],
  ['corridas_passageiro', 'apps/corridas-passageiro'],
  ['corridas_motorista_admin', 'apps/corridas-motorista-admin'],
];

let failed = false;
for (const [key, path] of modules) {
  const expected = lock.sources[key].observed_commit;
  try {
    const actual = execFileSync('git', ['-C', path, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
    if (actual !== expected) {
      console.error(`[FAIL] ${key}: ${actual} != ${expected}`);
      failed = true;
    } else {
      console.log(`[OK] ${key}: ${actual}`);
    }
  } catch {
    console.error(`[FAIL] ${key}: módulo não inicializado.`);
    failed = true;
  }
}
process.exit(failed ? 1 : 0);
