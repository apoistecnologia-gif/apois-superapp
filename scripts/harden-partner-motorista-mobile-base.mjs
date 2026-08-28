import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const workspace = process.env.APOIS_MOTORISTA_WORKSPACE || '.work/partner-motorista';
const configPath = resolve(workspace, 'vite.mobile.config.ts');
const rootRoutePath = resolve(workspace, 'src/routes/__root.tsx');

if (!existsSync(configPath)) {
  throw new Error(`Motorista Parceiro: vite.mobile.config.ts ausente em ${configPath}`);
}
if (!existsSync(rootRoutePath)) {
  throw new Error(`Motorista Parceiro: src/routes/__root.tsx ausente em ${rootRoutePath}`);
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

// O documento client-only (index.mobile.html) já fornece html/head/body/#root.
// O RootShell do TanStack Start é apenas para SSR; mantê-lo na árvore mobile
// faz o RouterProvider tentar reconciliar um segundo documento inteiro dentro de
// #root, podendo travar foco e eventos de formulário no WebView/browser.
let rootRoute = readFileSync(rootRoutePath, 'utf8');
const shellMarker = 'function RootShell({ children }: { children: ReactNode }) {';
const shellStart = rootRoute.indexOf(shellMarker);
let shellBlock = '';

if (shellStart >= 0) {
  const shellEnd = rootRoute.indexOf('\n\nfunction RootComponent()', shellStart);
  if (shellEnd < 0) throw new Error('Motorista Parceiro: fim do RootShell não encontrado para isolamento mobile.');
  shellBlock = rootRoute.slice(shellStart, shellEnd);
  if (!rootRoute.includes('shellComponent: RootShell')) {
    throw new Error('Motorista Parceiro: RootShell presente sem shellComponent; estado SSR inconsistente.');
  }

  // Remove o bloco pelo conteúdo original, não por offsets calculados antes de
  // remover a linha shellComponent (a remoção altera todos os offsets seguintes).
  rootRoute = rootRoute.replace('  shellComponent: RootShell,\n', '');
  rootRoute = rootRoute.replace(`${shellBlock}\n`, '');
  rootRoute = rootRoute.replace('  HeadContent,\n', '').replace('  Scripts,\n', '');
  rootRoute = rootRoute.replace('import { useEffect, useRef, useState, type ReactNode } from "react";', 'import { useEffect, useRef, useState } from "react";');
  rootRoute = rootRoute.replace('import appCss from "../styles.css?url";\n', '');
  rootRoute = rootRoute.replace('import { ThemeProvider, THEME_INIT_SCRIPT } from "../lib/theme";', 'import { ThemeProvider } from "../lib/theme";');
  rootRoute = rootRoute.replace(/^\s*\{ rel: ["']stylesheet["'], href: appCss \},\r?\n/gm, '');
  rootRoute = rootRoute.replace('  { rel: "stylesheet", href: appCss },\n', '');
  rootRoute = rootRoute.replace('  { rel: "stylesheet", href: appCss },\r\n', '');
} else if (rootRoute.includes('shellComponent:') || rootRoute.includes('HeadContent') || rootRoute.includes('Scripts') || rootRoute.includes('THEME_INIT_SCRIPT') || rootRoute.includes('<html')) {
  throw new Error('Motorista Parceiro: RootShell ausente, mas há shell SSR residual na árvore mobile.');
}

if (rootRoute.includes('function RootShell') || rootRoute.includes('HeadContent') || rootRoute.includes('<html') || rootRoute.includes('shellComponent:') || rootRoute.includes('THEME_INIT_SCRIPT') || rootRoute.includes('ReactNode')) {
  throw new Error('Motorista Parceiro: shell SSR ainda presente após isolamento mobile.');
}
writeFileSync(rootRoutePath, rootRoute, 'utf8');
if (shellBlock) {
  console.log('[OK] Motorista Parceiro: RootShell SSR removido da árvore client-only; documento externo fornece html/head/body/#root.');
  console.log(`[OK] Motorista Parceiro: bloco SSR isolado (${shellBlock.length} bytes) sem editar o documento WEB da fonte.`);
} else {
  console.log('[OK] Motorista Parceiro: árvore client-only já estava isolada; estado final validado de forma idempotente.');
}
