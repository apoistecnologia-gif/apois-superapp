import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const lock = JSON.parse(readFileSync(new URL('../.apois/source-lock.json', import.meta.url), 'utf8'));
const modules = [
  ['entregas', 'sources/apois-entregas'],
  ['corridas_passageiro', 'sources/apois-corridas-passageiro'],
  ['corridas_motorista_admin', 'sources/apois-corridas-motorista-admin'],
];

let failed = false;
for (const [key, path] of modules) {
  const expected = lock.sources[key]?.commit;
  if (!expected) {
    console.error(`[FAIL] ${key}: commit fixado ausente em .apois/source-lock.json`);
    failed = true;
    continue;
  }

  try {
    const actual = execFileSync('git', ['-C', path, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
    if (actual !== expected) {
      console.error(`[FAIL] ${key}: ${actual} != ${expected}`);
      failed = true;
    } else {
      console.log(`[OK] ${key}: ${actual}`);
    }
  } catch {
    console.error(`[FAIL] ${key}: fonte não inicializada. Rode npm run sources:clone.`);
    failed = true;
  }
}

process.exit(failed ? 1 : 0);
