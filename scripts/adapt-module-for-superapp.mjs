import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const name = process.argv[2];

function replaceRequired(path, search, replacement, label) {
  const full = resolve(root, path);
  const before = readFileSync(full, 'utf8');
  if (!before.includes(search)) {
    console.error(`[FAIL] ${label}: padrão esperado não encontrado em ${path}`);
    process.exit(1);
  }
  const after = before.replace(search, replacement);
  writeFileSync(full, after);
  console.log(`[OK] ${label}`);
}

if (name === 'corridas') {
  // Corridas já usa Hash History e base relativa no snapshot protegido.
  console.log('[OK] corridas: createHashHistory + base relativa já são nativos do módulo');
  process.exit(0);
}

if (name === 'entregas') {
  replaceRequired(
    '.work/entregas/src/router.tsx',
    'import { createRouter } from "@tanstack/react-router";',
    'import { createRouter, createHashHistory } from "@tanstack/react-router";',
    'entregas: importar createHashHistory',
  );
  replaceRequired(
    '.work/entregas/src/router.tsx',
    '  const router = createRouter({\n    routeTree,',
    '  const hashHistory = typeof window !== "undefined" ? createHashHistory() : undefined;\n\n  const router = createRouter({\n    routeTree,\n    ...(hashHistory ? { history: hashHistory } : {}),',
    'entregas: usar Hash History apenas no WebView/browser',
  );
  replaceRequired(
    '.work/entregas/vite.config.ts',
    'export default defineConfig({\n',
    'export default defineConfig({\n  vite: { base: "./" },\n',
    'entregas: gerar assets com caminhos relativos',
  );
  process.exit(0);
}

console.error(`Módulo desconhecido: ${name}`);
process.exit(1);
