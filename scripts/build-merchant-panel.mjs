import { existsSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = resolve('.');
const workspace = resolve(root, '.work/entregas');

function run(bin, args, options = {}) {
  const result = spawnSync(bin, args, {
    cwd: options.cwd ?? root,
    env: options.env ?? process.env,
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

if (!existsSync(resolve(workspace, 'package.json'))) {
  console.error('[FAIL] Workspace merchant não encontrado. O build Vercel deve usar a fonte preparada do Superapp.');
  process.exit(1);
}

const env = {
  ...process.env,
  VITE_APOIS_PRODUCT_MODE: 'merchant',
  APOIS_MOBILE_BUILD: '0',
};

run('bun', ['install'], { cwd: workspace, env });
run('bun', ['run', 'build:merchant'], { cwd: workspace, env });

const publicIndex = resolve(workspace, '.output/public/index.html');
if (!existsSync(publicIndex)) {
  console.error('[FAIL] Painel merchant não gerou saída pública.');
  process.exit(1);
}

let html = require('node:fs').readFileSync(publicIndex, 'utf8');
html = html
  .replace(/(src|href)="\/(?!\/)/g, '$1="./')
  .replace(/(src|href)='\/(?!\/)/g, "$1='./");
writeFileSync(publicIndex, html, 'utf8');

for (const forbidden of [
  'Conta para repasse',
  'Salvar chave PIX',
  'Solicitar saque',
  'SOLICITAR ENTREGADOR · PEDIDO',
]) {
  if (html.includes(forbidden)) {
    console.error(`[FAIL] Painel merchant contém UI legada: ${forbidden}`);
    process.exit(1);
  }
}

console.log('[OK] Painel merchant pronto para Vercel.');
