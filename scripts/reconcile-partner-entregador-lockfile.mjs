import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const workspace = process.env.APOIS_ENTREGAS_WORKSPACE || '.work/partner-entregador';
const cwd = resolve(root, workspace);

if (!existsSync(resolve(cwd, 'package.json'))) {
  throw new Error(`[FAIL] Entregador Parceiro: package.json ausente em ${workspace}`);
}

const bunCommand = process.platform === 'win32'
  ? resolve(process.env.APPDATA || '', 'npm', 'node_modules', 'bun', 'bin', 'bun.exe')
  : 'bun';
const result = spawnSync(bunCommand, ['install', '--lockfile-only'], {
  cwd,
  stdio: 'inherit',
  env: process.env,
});

if (result.error) {
  throw new Error(`[FAIL] Entregador Parceiro: não foi possível reconciliar o bun.lock da cópia .work (${result.error.message})`);
}
if (result.status !== 0) {
  throw new Error(`[FAIL] Entregador Parceiro: reconciliação do bun.lock da cópia .work terminou com código ${result.status}`);
}

console.log('[OK] Entregador Parceiro: bun.lock reconciliado somente na cópia descartável .work; snapshot protegido permanece intacto.');
