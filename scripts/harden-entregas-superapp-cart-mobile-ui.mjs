import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const path = resolve('.work/entregas/src/routes/sacola.tsx');
let source = readFileSync(path, 'utf8');

source = source
  .replace('className="flex min-h-screen w-full flex-col overflow-x-hidden', 'className="flex min-h-dvh w-full flex-col overflow-x-hidden')
  .replace('className="grid h-10 w-10 place-items-center rounded-full bg-zinc-900', 'className="grid h-11 w-11 place-items-center rounded-full bg-zinc-900')
  .replace('className="p-1 text-zinc-600 transition-colors hover:text-red-500"', 'className="grid h-11 w-11 place-items-center rounded-xl text-zinc-600 transition-colors active:bg-red-500/10 active:text-red-400"')
  .replaceAll('className="grid h-6 w-6 place-items-center rounded-md bg-zinc-800', 'className="grid h-10 w-10 place-items-center rounded-xl bg-zinc-800')
  .replace('className="flex-1">\n              <h2 className="text-lg font-bold text-white">{merchant.name}</h2>', 'className="min-w-0 flex-1">\n              <h2 className="truncate text-lg font-bold text-white">{merchant.name}</h2>')
  .replace('pb-[max(env(safe-area-inset-bottom),2.75rem)]', 'pb-[max(52px,env(safe-area-inset-bottom))]');

for (const marker of [
  'min-h-dvh',
  'grid h-11 w-11 place-items-center rounded-full',
  'grid h-11 w-11 place-items-center rounded-xl text-zinc-600',
  'grid h-10 w-10 place-items-center rounded-xl bg-zinc-800',
  'min-w-0 flex-1',
  'pb-[max(52px,env(safe-area-inset-bottom))]',
]) {
  if (!source.includes(marker)) throw new Error(`[FAIL] Sacola: hardening mobile incompleto (${marker})`);
}
if (source.includes('grid h-6 w-6 place-items-center rounded-md bg-zinc-800')) {
  throw new Error('[FAIL] Sacola: controle de quantidade pequeno permaneceu no app.');
}

writeFileSync(path, source, 'utf8');
console.log('[OK] Entregas: sacola usa alvos de toque confortáveis, nomes sem overflow e footer compatível com safe-area.');
