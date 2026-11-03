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

// APOIS_CORRIDAS_RECOVERY_BACK_HITAREA_V1: a full-width flex-item overlapped
// the top-right service switcher's hit area even though its text fit on the left.
patch('src/routes/_public.recuperar-senha.tsx', [
  ['className="mb-8 inline-flex items-center text-gray-400"', 'className="mb-8 inline-flex w-fit items-center text-gray-400"'],
]);

patch('src/routes/_public.index.tsx', [
  ['min-h-screen bg-black flex items-center justify-center', 'min-h-screen bg-[#F7F7F8] flex items-center justify-center'],
  ['animate-spin text-apois-yellow', 'animate-spin text-[#E51B23]'],
]);

console.log('[OK] Corridas: layout público e tela inicial de decisão usam a identidade clara.');
