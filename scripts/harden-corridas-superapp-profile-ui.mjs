import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const path = resolve('.work/corridas/src/routes/_authenticated.perfil.tsx');
let source = readFileSync(path, 'utf8');

source = source
  .replace('className="p-6 pt-12 flex flex-col items-center border-b border-gray-900"', 'className="border-b border-white/8 px-6 pb-6 pt-[max(env(safe-area-inset-top),1.25rem)] flex flex-col items-center"')
  .replaceAll('bg-[#121212]', 'bg-white')
  .replaceAll('rounded-xl', 'rounded-2xl')
  .replace('className="w-full flex items-center justify-between p-4', 'className="w-full min-h-[68px] flex items-center justify-between p-4')
  .replace('className="text-xs font-bold text-gray-500 px-2 pt-4 pb-2 uppercase tracking-wider"', 'className="px-2 pb-2 pt-4 text-[11px] font-black uppercase tracking-[0.16em] text-zinc-500"')
  .replace('className="text-xs font-bold text-gray-500 px-2 pt-6 pb-2 uppercase tracking-wider"', 'className="px-2 pb-2 pt-6 text-[11px] font-black uppercase tracking-[0.16em] text-zinc-500"')
  .replace('className="text-center text-gray-600 text-xs mt-8"', 'className="mt-8 text-center text-xs text-zinc-600"');

if (!source.includes('min-h-[68px]')) throw new Error('[FAIL] Corridas: Perfil sem alvos de toque adequados');
if (!source.includes('env(safe-area-inset-top)')) throw new Error('[FAIL] Corridas: Perfil sem safe area superior');
if (source.includes('PassengerProfileCenter')) throw new Error('[FAIL] Corridas: Perfil obsoleto reapareceu');

writeFileSync(path, source, 'utf8');
console.log('[OK] Corridas: Perfil real alinhado à viewport móvel e identidade APOIS');

