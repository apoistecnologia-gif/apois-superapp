import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

function patch(path, pairs) {
  const full = resolve('.work/corridas', path);
  let source = readFileSync(full, 'utf8');
  for (const [from, to] of pairs) source = source.replaceAll(from, to);
  writeFileSync(full, source, 'utf8');
}

patch('src/routes/_public.tsx', [
  ['min-h-screen bg-zinc-950 flex justify-center selection:bg-yellow-500/30', 'min-h-screen bg-[#EEF1F4] flex justify-center selection:bg-[#E51B23]/20'],
  ['relative w-full max-w-[430px] min-h-[100dvh] bg-black overflow-hidden flex flex-col', 'relative w-full max-w-[430px] min-h-[100dvh] bg-[#F7F7F8] overflow-hidden flex flex-col'],
]);

patch('src/routes/_public.index.tsx', [
  ['min-h-screen bg-black flex items-center justify-center', 'min-h-screen bg-[#F7F7F8] flex items-center justify-center'],
  ['animate-spin text-apois-yellow', 'animate-spin text-[#E51B23]'],
]);

console.log('[OK] Corridas: layout público e tela inicial de decisão usam a identidade clara.');
