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

// APOIS_CORRIDAS_RECOVERY_BACK_HITAREA_V2 — enforce a true content-sized back link
// after all earlier visual transformations, including different link text colors.
{
  const filename=resolve('.work/corridas/src/routes/_public.recuperar-senha.tsx');
  const before=readFileSync(filename,'utf8');
  const match=before.match(/<Link to="\/login" className="([^"]*)">/g);
  if(!match||match.length!==1||!match[0].includes('inline-flex'))throw Error('[FAIL] Corridas recovery back link contract drift');
  const old=match[0];
  const next=old.includes(' w-fit ') ? old : old.replace('inline-flex ','inline-flex w-fit ');
  if(!next.includes('w-fit'))throw Error('[FAIL] Corridas recovery back width not constrained');
  const updated=before.replace(old,next);
  writeFileSync(filename,updated,'utf8');
  if(!readFileSync(filename,'utf8').includes('inline-flex w-fit'))throw Error('[FAIL] Corridas back Link width not persisted');
}

patch('src/routes/_public.index.tsx', [
  ['min-h-screen bg-black flex items-center justify-center', 'min-h-screen bg-[#F7F7F8] flex items-center justify-center'],
  ['animate-spin text-apois-yellow', 'animate-spin text-[#E51B23]'],
]);

console.log('[OK] Corridas: layout público e tela inicial de decisão usam a identidade clara.');
