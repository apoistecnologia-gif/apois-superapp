import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

function patch(path, pairs) {
  const full = resolve('.work/corridas', path);
  let source = readFileSync(full, 'utf8');
  for (const [from, to] of pairs) source = source.replaceAll(from, to);
  writeFileSync(full, source, 'utf8');
}

patch('src/components/pricing/CategorySelector.tsx', [
  ['flex-shrink-0 w-28 h-32 bg-zinc-900/50 rounded-2xl animate-pulse', 'flex-shrink-0 h-32 w-28 animate-pulse rounded-2xl border border-[#E2E4E8] bg-white'],
  ['bg-apois-yellow border-apois-yellow text-black shadow-lg shadow-apois-yellow/20', 'border-[#E51B23] bg-[#E51B23] text-white shadow-lg shadow-[#E51B23]/20'],
  ['bg-zinc-900/80 border-transparent text-zinc-400', 'border-[#E2E4E8] bg-white text-[#33383F]'],
  ['bg-zinc-900/40 border-transparent text-zinc-600 grayscale cursor-not-allowed', 'cursor-not-allowed border-[#E2E4E8] bg-[#F1F2F4] text-[#9AA0A8] grayscale'],
  ['isSelected ? "bg-black/10" : "bg-zinc-800"', 'isSelected ? "bg-white/15" : "bg-[#FFF1F2]"'],
  ['isSelected ? "text-black/70" : "text-apois-yellow"', 'isSelected ? "text-white/85" : "text-[#E51B23]"'],
]);

patch('src/components/ui/bottom-sheet/BottomSheet.tsx', [
  ['bg-[#121212] rounded-t-[32px] overflow-hidden shadow-[0_-12px_40px_rgba(0,0,0,0.6)] border-x border-t border-white/5', 'overflow-hidden rounded-t-[32px] border-x border-t border-[#E2E4E8] bg-white shadow-[0_-12px_40px_rgba(17,17,17,0.14)]'],
  ['w-10 h-1.5 bg-gray-600 rounded-full', 'h-1.5 w-10 rounded-full bg-[#C9CDD3]'],
]);

console.log('[OK] Corridas: categorias e bottom sheet normalizados para a identidade clara.');
