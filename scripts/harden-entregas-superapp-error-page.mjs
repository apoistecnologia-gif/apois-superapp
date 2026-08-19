import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const path = resolve('.work/entregas/src/lib/error-page.ts');
const source = readFileSync(path, 'utf8');

if (!source.includes('This page didn\'t load') || !source.includes('href="/"')) {
  console.error('[FAIL] Entregas: error-page do snapshot mudou; revisar adaptação do Superapp.');
  process.exit(1);
}

const replacement = `export function renderErrorPage(): string {
  return \`<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <title>APOIS — Não foi possível carregar</title>
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="theme-color" content="#050505" />
    <style>
      * { box-sizing: border-box; }
      body { font: 15px/1.5 system-ui, -apple-system, sans-serif; background: #050505; color: #fff; display: grid; place-items: center; min-height: 100dvh; margin: 0; padding: max(1.5rem, env(safe-area-inset-top)) 1.5rem max(1.5rem, env(safe-area-inset-bottom)); }
      .card { max-width: 28rem; width: 100%; text-align: center; padding: 2rem; border: 1px solid #27272a; border-radius: 1.5rem; background: #09090b; }
      .brand { color: #f2b414; font-weight: 900; letter-spacing: .14em; font-size: .75rem; }
      h1 { font-size: 1.3rem; margin: .75rem 0 .5rem; }
      p { color: #a1a1aa; margin: 0 0 1.5rem; }
      .actions { display: flex; gap: .75rem; justify-content: center; flex-wrap: wrap; }
      a, button { min-height: 48px; padding: .75rem 1rem; border-radius: 1rem; font: inherit; font-weight: 800; cursor: pointer; text-decoration: none; border: 1px solid transparent; }
      .primary { background: #f2b414; color: #050505; }
      .secondary { background: #18181b; color: #fff; border-color: #3f3f46; }
    </style>
  </head>
  <body>
    <div class="card">
      <div class="brand">APOIS</div>
      <h1>Não foi possível carregar esta tela</h1>
      <p>Verifique sua conexão e tente novamente.</p>
      <div class="actions">
        <button class="primary" onclick="location.reload()">Tentar novamente</button>
        <a class="secondary" href="#/inicio">Ir para o início</a>
      </div>
    </div>
  </body>
</html>\`;
}
`;

writeFileSync(path, replacement, 'utf8');
console.log('[OK] Entregas: fallback de erro usa identidade APOIS, português e navegação Hash do Superapp.');
