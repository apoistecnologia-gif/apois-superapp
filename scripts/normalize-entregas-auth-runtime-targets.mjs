import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const path = resolve('scripts/harden-entregas-superapp-auth-runtime.mjs');
let source = readFileSync(path, 'utf8');

const staleSearch = `  '<div className="flex min-h-[56px] min-w-[68px] flex-col items-center justify-center gap-1 px-1 transition-all active:scale-95">',`;
const staleReplacement = `  '<div className="flex min-h-[64px] min-w-[72px] flex-col items-center justify-center gap-1 px-1 transition-all active:scale-95">',`;
const buttonSearch = `  '<button\\n      type="button"\\n      onClick={onClick}\\n      className="flex min-h-[56px] min-w-[68px] flex-col items-center justify-center gap-1 px-1 transition-all active:scale-95">',`;
const buttonReplacement = `  '<button\\n      type="button"\\n      onClick={onClick}\\n      className="flex min-h-[64px] min-w-[72px] flex-col items-center justify-center gap-1 px-1 transition-all active:scale-95">',`;
const classSearch = `  'className="flex min-h-[56px] min-w-[68px] flex-col items-center justify-center gap-1 px-1 transition-all active:scale-95"',`;
const classReplacement = `  'className="flex min-h-[64px] min-w-[72px] flex-col items-center justify-center gap-1 px-1 transition-all active:scale-95"',`;

if (source.includes(staleSearch)) source = source.replace(staleSearch, classSearch);
if (source.includes(staleReplacement)) source = source.replace(staleReplacement, classReplacement);
if (source.includes(buttonSearch)) source = source.replace(buttonSearch, classSearch);
if (source.includes(buttonReplacement)) source = source.replace(buttonReplacement, classReplacement);

const hasCurrentSearch = source.includes(classSearch);
const hasCurrentReplacement = source.includes(classReplacement);
if (!hasCurrentSearch || !hasCurrentReplacement) {
  throw new Error('Auth runtime Entregas: alvo atual do NavButton não foi encontrado no hardener.');
}
if (source.includes(staleSearch) || source.includes(staleReplacement)) {
  throw new Error('Auth runtime Entregas: alvo <div> obsoleto ainda presente.');
}

writeFileSync(path, source, 'utf8');
console.log('[OK] Auth runtime Entregas alinhado ao NavButton real e idempotente antes da adaptação.');
