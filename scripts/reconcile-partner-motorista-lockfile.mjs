import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const workspace = process.env.APOIS_MOTORISTA_WORKSPACE || '.work/partner-motorista';
const cwd = resolve(root, workspace);

if (!existsSync(resolve(cwd, 'package.json'))) {
  throw new Error(`[FAIL] Motorista Parceiro: package.json ausente em ${workspace}`);
}

const result = spawnSync('bun', ['install', '--lockfile-only'], {
  cwd,
  stdio: 'inherit',
  env: process.env,
});

if (result.error) {
  throw new Error(`[FAIL] Motorista Parceiro: não foi possível reconciliar o bun.lock da cópia .work (${result.error.message})`);
}
if (result.status !== 0) {
  throw new Error(`[FAIL] Motorista Parceiro: reconciliação do bun.lock da cópia .work terminou com código ${result.status}`);
}

console.log('[OK] Motorista Parceiro: bun.lock reconciliado somente na cópia descartável .work; snapshot protegido permanece intacto.');
