import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const path = resolve(process.cwd(), process.env.APOIS_ENTREGAS_WORKSPACE || '.work/partner-entregador', 'src/router.tsx');
const source = readFileSync(path, 'utf8');
const importBefore = 'import { createRouter } from "@tanstack/react-router";';
const importAfter = 'import { createHashHistory, createRouter } from "@tanstack/react-router";';
const routerBefore = `  const router = createRouter({\n    routeTree,`;
const routerAfter = `  const hashHistory = typeof window !== "undefined" ? createHashHistory() : undefined;\n\n  const router = createRouter({\n    ...(hashHistory ? { history: hashHistory } : {}),\n    routeTree,`;

if (source.includes('createHashHistory') && source.includes('history: hashHistory')) {
  console.log('[OK] Entregador Parceiro: router usa Hash History para módulo aninhado');
  process.exit(0);
}
if (!source.includes(importBefore) || !source.includes(routerBefore)) {
  throw new Error('Entregador Parceiro: router.tsx não está no formato esperado.');
}
const next = source.replace(importBefore, importAfter).replace(routerBefore, routerAfter);
writeFileSync(path, next, 'utf8');
console.log('[OK] Entregador Parceiro: Hash History aplicada ao módulo aninhado');
