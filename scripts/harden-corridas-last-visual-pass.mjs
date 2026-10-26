import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const target = resolve('.work/corridas/src/routes/_authenticated.perfil.tsx');
let source = readFileSync(target, 'utf8');
source = source.replaceAll('bg-[#121212]', 'bg-white');
source = source.replaceAll('bg-[#11151d]', 'bg-white');
source = source.replaceAll('text-yellow-500', 'text-[#E51B23]');
source = source.replaceAll('group-hover:text-yellow-500', 'group-hover:text-[#C9141B]');
source = source.replaceAll('focus-visible:ring-yellow-500', 'focus-visible:ring-[#E51B23]');
source = source.replaceAll('hover:bg-[#1a1a1a]', 'hover:bg-[#FFF7F7]');
source = source.replaceAll('text-gray-700', 'text-[#8A9098]');
source = source.replaceAll('text-gray-500', 'text-[#666B73]');
source = source.replaceAll('rounded-2xl bg-white p-4 text-left transition-colors', 'rounded-2xl border border-[#E2E4E8] bg-white p-4 text-left shadow-sm transition-colors');
source = source.replaceAll('rounded-2xl bg-white p-4 text-left', 'rounded-2xl border border-[#E2E4E8] bg-white p-4 text-left shadow-sm');
writeFileSync(target, source, 'utf8');
console.log('[OK] Corridas: acabamento vermelho/branco do Perfil aplicado no fim do pipeline.');
