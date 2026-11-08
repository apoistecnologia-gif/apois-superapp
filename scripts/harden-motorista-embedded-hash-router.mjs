import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

// O Router do bundle independente usa browser history. Dentro do Superapp
// e do APOIS Parceiro, porém, o módulo roda em /modules/motorista/index.html:
// os links e o shell já usam #/motorista/*, portanto o workspace EMBUTIDO
// precisa de createHashHistory. Nunca alterar o submódulo fonte.
const root = process.cwd();
const workspace = process.env.APOIS_MOTORISTA_WORKSPACE || '.work/motorista';
const path = resolve(root, workspace, 'src/mobile.tsx');

if (!existsSync(path)) {
  throw new Error(`[FAIL] Motorista embutido: src/mobile.tsx não encontrado em ${workspace}`);
}

const original = readFileSync(path, 'utf8');
const originalImport = 'import { createRouter, RouterProvider } from "@tanstack/react-router";';
const patchedImport = 'import { createHashHistory, createRouter, RouterProvider } from "@tanstack/react-router";';
const routerAnchor = '  const router = createRouter({\n';
const historyLine = '    history: createHashHistory(),\n';
let source = original;

if (!source.includes(patchedImport)) {
  if (!source.includes(originalImport)) {
    throw new Error('[FAIL] Motorista embutido: import do roteador não reconhecido');
  }
  source = source.replace(originalImport, patchedImport);
}

const routerStart = source.indexOf(routerAnchor);
if (routerStart < 0) {
  throw new Error('[FAIL] Motorista embutido: createRouter não encontrado');
}
const routerEnd = source.indexOf('\n  });', routerStart);
if (routerEnd < 0) {
  throw new Error('[FAIL] Motorista embutido: bloco de createRouter incompleto');
}
const routerBlock = source.slice(routerStart, routerEnd);
if (!routerBlock.includes(historyLine.trim())) {
  if (/\bhistory\s*:/.test(routerBlock)) {
    throw new Error('[FAIL] Motorista embutido: já existe outra configuração de history');
  }
  source = source.replace(routerAnchor, routerAnchor + historyLine);
}

if (!source.includes(patchedImport) || !source.includes(routerAnchor + historyLine)) {
  throw new Error('[FAIL] Motorista embutido: hash history não foi aplicada corretamente');
}
if (source !== original) {
  writeFileSync(path, source, 'utf8');
  console.log(`[OK] Motorista embutido: createHashHistory configurada em ${workspace}`);
} else {
  console.log(`[OK] Motorista embutido: createHashHistory já configurada em ${workspace}`);
}
