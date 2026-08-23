import { existsSync, readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const cwd = process.cwd();
const distRoot = resolve(cwd, 'dist/client');
const indexPath = resolve(distRoot, 'index.html');
if (!existsSync(indexPath)) throw new Error(`[FAIL] Motorista Parceiro: dist mobile ausente em ${indexPath}`);

let html = readFileSync(indexPath, 'utf8');
html = html
  .replace(/<base\s+href=["'][^"']*["']\s*\/?\s*>/gi, '<base href="./">')
  .replace(/\b(src|href)=["']\/(?!\/)/gi, (match, attr) => `${attr}="./`);
if (!/<base\b/i.test(html)) {
  html = html.replace(/<head(\s[^>]*)?>/i, (head) => `${head}\n    <base href="./">`);
}
writeFileSync(indexPath, html, 'utf8');

// O shell também precisa apontar para o módulo por caminho relativo. Isso evita
// file:///modules/... e https://localhost/modules/... fora do diretório www.
const repoRoot = resolve(cwd, '../..');
const shellPath = resolve(repoRoot, 'superapp/partner-shell/index.html');
if (existsSync(shellPath)) {
  let shell = readFileSync(shellPath, 'utf8');
  shell = shell
    .replaceAll('"/modules/motorista/', '"./modules/motorista/')
    .replaceAll("'/modules/motorista/", "'./modules/motorista/")
    .replaceAll('`/modules/motorista/', '`./modules/motorista/');
  writeFileSync(shellPath, shell, 'utf8');
}

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

// Procura referências de assets emitidas no HTML e garante que cada arquivo
// realmente existe. Falha no Codemagic antes do APK, em vez de entregar a tela
// genérica "Algo deu errado" no aparelho.
const refs = [...html.matchAll(/(?:src|href)=["']([^"'#?]+)["']/gi)]
  .map((match) => match[1])
  .filter((value) => !/^(?:https?:|data:|capacitor:|mailto:|tel:)/i.test(value));
const missing = [];
for (const ref of refs) {
  const clean = ref.replace(/^\.\//, '');
  if (!clean || clean === './') continue;
  const target = resolve(dirname(indexPath), clean);
  if (!existsSync(target)) missing.push(ref);
}
if (missing.length) {
  throw new Error(`[FAIL] Motorista Parceiro: index mobile referencia arquivos inexistentes: ${missing.join(', ')}`);
}

const bundled = walk(distRoot).filter((path) => /\.(?:js|css)$/i.test(path));
if (!bundled.length) throw new Error('[FAIL] Motorista Parceiro: build mobile não emitiu JS/CSS.');
if (/\b(?:src|href)=["']\/(?!\/)/i.test(readFileSync(indexPath, 'utf8'))) {
  throw new Error('[FAIL] Motorista Parceiro: index final ainda contém asset absoluto.');
}

console.log(`[OK] Motorista Parceiro: dist aninhado validado (${bundled.length} assets JS/CSS) e shell usa URL relativa.`);
