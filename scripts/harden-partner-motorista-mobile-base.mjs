import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const workspace = process.env.APOIS_MOTORISTA_WORKSPACE || '.work/partner-motorista';
const configPath = resolve(workspace, 'vite.mobile.config.ts');

if (!existsSync(configPath)) {
  throw new Error(`Motorista Parceiro: vite.mobile.config.ts ausente em ${configPath}`);
}

let source = readFileSync(configPath, 'utf8');

// O módulo Motorista é publicado dentro de modules/motorista no shell Capacitor.
// Sem base relativa, Vite gera referências /assets/... que apontam para a raiz
// do WebView e deixam o login sem JS/CSS/chunks, caindo na tela genérica de erro.
if (!/\bbase\s*:\s*["']\.\/["']/.test(source)) {
  const returnAnchor = '  return {\n    appType: "spa",';
  if (!source.includes(returnAnchor)) {
    throw new Error('Motorista Parceiro: âncora do config mobile não encontrada para instalar base relativa.');
  }
  source = source.replace(
    returnAnchor,
    '  return {\n    base: "./",\n    appType: "spa",',
  );
}

if (!/\bbase\s*:\s*["']\.\/["']/.test(source)) {
  throw new Error('Motorista Parceiro: base relativa não foi instalada no Vite mobile.');
}

writeFileSync(configPath, source, 'utf8');
console.log('[OK] Motorista Parceiro: Vite mobile usa base ./ para carregar login e chunks dentro de modules/motorista.');
