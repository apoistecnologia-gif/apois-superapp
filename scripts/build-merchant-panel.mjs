import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = resolve('.');
const merchant = resolve(root, 'apps/merchant');

function run(bin, args, options = {}) {
  const command = process.platform === 'win32' && bin === 'bun' ? 'bun.cmd' : bin;
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? root,
    env: options.env ?? process.env,
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

if (!existsSync(resolve(merchant, 'package.json'))) {
  console.error('[FAIL] Módulo merchant interno não encontrado em apps/merchant.');
  process.exit(1);
}

const env = {
  ...process.env,
  VITE_APOIS_PRODUCT_MODE: 'merchant',
  APOIS_MOBILE_BUILD: '0',
};

run('bun', ['install'], { cwd: merchant, env });
run('bun', ['run', 'build:merchant'], { cwd: merchant, env });

const publicIndex = resolve(merchant, '.output/public/index.html');
if (!existsSync(publicIndex)) {
  console.error('[FAIL] Painel merchant não gerou saída pública.');
  process.exit(1);
}

let html = readFileSync(publicIndex, 'utf8');
html = html
  .replace(/(src|href)="\/(?!\/)/g, '$1="./')
  .replace(/(src|href)='\/(?!\/)/g, "$1='./");
writeFileSync(publicIndex, html, 'utf8');

console.log('[OK] Painel merchant interno pronto para Vercel.');
