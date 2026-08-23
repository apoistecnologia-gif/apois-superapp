import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const workspace = process.env.APOIS_MOTORISTA_WORKSPACE || '.work/partner-motorista';
const cwd = resolve(root, workspace);
const vitePath = resolve(cwd, 'vite.mobile.config.ts');
const indexPath = resolve(cwd, 'index.mobile.html');
const packagePath = resolve(cwd, 'package.json');

for (const path of [vitePath, indexPath, packagePath]) {
  if (!existsSync(path)) throw new Error(`[FAIL] Motorista Parceiro: entrada mobile ausente: ${path}`);
}

// O módulo Motorista é empacotado em modules/motorista/. Qualquer base absoluta
// faz o WebView procurar chunks no diretório raiz do host e cai no ErrorBoundary.
let vite = readFileSync(vitePath, 'utf8');
if (/\bbase\s*:\s*["'][^"']*["']\s*,?/.test(vite)) {
  vite = vite.replace(/\bbase\s*:\s*["'][^"']*["']\s*,?/, 'base: "./",');
} else {
  const returnConfig = /return\s*\{\s*\n/;
  if (!returnConfig.test(vite)) throw new Error('[FAIL] Motorista Parceiro: bloco return do Vite mobile não encontrado.');
  vite = vite.replace(returnConfig, (match) => `${match}    base: "./",\n`);
}
writeFileSync(vitePath, vite, 'utf8');

let html = readFileSync(indexPath, 'utf8');
html = html
  .replace(/<base\s+href=["']\/["']\s*\/?\s*>/gi, '<base href="./">')
  .replace(/(<(?:script|link)\b[^>]*(?:src|href)=["'])\/(?!\/)/gi, '$1./');
if (!/<base\b/i.test(html)) {
  html = html.replace(/<head(\s[^>]*)?>/i, (head) => `${head}\n    <base href="./">`);
}
writeFileSync(indexPath, html, 'utf8');

// Normalização pós-build: além do Vite base relativo, valida os arquivos reais
// antes que o shell copie o módulo para modules/motorista.
const pkg = JSON.parse(readFileSync(packagePath, 'utf8'));
const buildKey = pkg.scripts?.['build:motorista'] ? 'build:motorista' : null;
if (!buildKey) throw new Error('[FAIL] Motorista Parceiro: script build:motorista não encontrado.');
const normalizer = 'node ../../scripts/normalize-partner-motorista-dist.mjs';
if (!pkg.scripts[buildKey].includes('normalize-partner-motorista-dist.mjs')) {
  pkg.scripts[buildKey] = `${pkg.scripts[buildKey]} && ${normalizer}`;
}
writeFileSync(packagePath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');

if (!readFileSync(vitePath, 'utf8').includes('base: "./"')) {
  throw new Error('[FAIL] Motorista Parceiro: Vite mobile não ficou com base relativa.');
}
if (!readFileSync(indexPath, 'utf8').includes('<base href="./">')) {
  throw new Error('[FAIL] Motorista Parceiro: index mobile não ficou ancorado no diretório do módulo.');
}

console.log('[OK] Motorista Parceiro: entrada mobile usa base relativa e terá validação pós-build dos chunks.');
