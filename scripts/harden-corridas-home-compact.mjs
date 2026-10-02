import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const workspace = process.env.APOIS_CORRIDAS_WORKSPACE || '.work/corridas';
const homePath = resolve(root, workspace, 'src/routes/_authenticated.inicio.tsx');
const stylesPath = resolve(root, workspace, 'src/styles.css');

function read(path) { return readFileSync(path, 'utf8'); }
function write(path, content) { writeFileSync(path, content, 'utf8'); }
function replaceRequired(source, search, replacement, label) {
  if (source.includes(replacement)) { console.log('[OK] ' + label + ' (já aplicado)'); return source; }
  if (!source.includes(search)) throw new Error('[FAIL] ' + label + ': padrão esperado não encontrado');
  console.log('[OK] ' + label);
  return source.replace(search, replacement);
}

let styles = read(stylesPath);
const cssMarker = '/* APOIS_HOME_COMPACT_V2 */';
if (!styles.includes(cssMarker)) {
  const compactCss = [
    '',
    cssMarker,
    '/* Home Passageiro: composição compacta baseada na referência visual aprovada. */',
    '.apois-home-compact-header{padding-top:calc(env(safe-area-inset-top) + 8px)}',
    '.apois-home-compact-header-card{min-height:52px;background:linear-gradient(180deg,rgb(8 9 11/.90),rgb(8 9 11/.82));border-color:color-mix(in srgb,var(--primary-brand,#F5222D) 34%,transparent);box-shadow:0 12px 30px rgb(0 0 0/.34)}',
    '.apois-home-avatar{border-color:var(--accent,#D9A520);box-shadow:0 0 0 1px rgb(217 165 32/.10),0 8px 20px rgb(0 0 0/.32)}',
    '.apois-home-map-control{box-shadow:0 10px 28px rgb(0 0 0/.36)}',
    '.apois-home-compact-panel{position:relative;padding-top:14px;background:linear-gradient(180deg,rgb(8 9 11/.90),rgb(8 9 11/.98) 38%,var(--background,#08090B) 100%);border-top:1px solid color-mix(in srgb,var(--primary-brand,#F5222D) 40%,transparent);border-radius:28px 28px 0 0;box-shadow:0 -18px 42px rgb(0 0 0/.48);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px)}',
    '.apois-home-compact-panel::before{content:"";position:absolute;top:7px;left:50%;width:42px;height:4px;border-radius:999px;background:rgb(166 168 174/.62);transform:translateX(-50%)}',
    '.apois-home-current-location{background:linear-gradient(180deg,rgb(17 19 24/.96),rgb(12 14 18/.96));border:1px solid rgb(255 255 255/.08);border-radius:17px;box-shadow:0 8px 24px rgb(0 0 0/.22)}',
    '.apois-home-search-compact{min-height:52px;background:linear-gradient(180deg,rgb(17 19 24/.97),rgb(14 16 20/.97));border-color:color-mix(in srgb,var(--primary-brand,#F5222D) 58%,transparent);box-shadow:0 10px 26px rgb(0 0 0/.25)}',
    '.apois-home-shortcut{min-height:48px;background:linear-gradient(180deg,rgb(17 19 24/.96),rgb(13 15 19/.96));border-color:rgb(255 255 255/.08);box-shadow:0 7px 20px rgb(0 0 0/.18)}',
    '.apois-home-shortcut-premium{border-color:color-mix(in srgb,var(--accent,#D9A520) 58%,transparent);background:linear-gradient(180deg,rgb(40 31 10/.42),rgb(17 19 24/.96))}',
    '@media(max-height:700px){.apois-home-compact-panel{padding-top:12px}.apois-home-current-location{min-height:44px}.apois-home-search-compact{min-height:48px}.apois-home-shortcut{min-height:44px}}',
  ].join('\n');
  styles += compactCss + '\n';
  write(stylesPath, styles);
  console.log('[OK] Corridas Home compacta: estilos responsivos registrados');
}

let home = read(homePath);
home = replaceRequired(home, '<div className="relative z-20 pt-[calc(env(safe-area-inset-top)+12px)] px-4">', '<div className="apois-home-compact-header relative z-20 px-3">', 'Corridas Home compacta: cabeçalho ocupa menos altura');
home = replaceRequired(home, 'className="bg-black/75 backdrop-blur-xl border border-white/10 rounded-[22px] px-2.5 py-2 shadow-[0_16px_40px_rgba(0,0,0,.42)] flex items-center justify-between"', 'className="apois-home-compact-header-card flex items-center justify-between rounded-[20px] border px-2 py-1.5 backdrop-blur-xl"', 'Corridas Home compacta: card superior reduzido');
home = replaceRequired(home, 'className="w-10 h-10 rounded-full border-2 border-green-500 overflow-hidden bg-zinc-800"', 'className="apois-home-avatar h-9 w-9 overflow-hidden rounded-full border-2 bg-zinc-800"', 'Corridas Home compacta: avatar menor com acabamento premium');
home = home.replace('className="flex items-center gap-3"', 'className="flex min-w-0 items-center gap-2.5"')
  .replace('className="text-sm font-bold text-white tracking-tight"', 'className="truncate text-[13px] font-bold tracking-tight text-white"')
  .replace('className="text-[10px] text-zinc-400 font-semibold"', 'className="truncate text-[9px] font-semibold text-zinc-400"')
  .replace('className="w-10 h-10 rounded-full flex items-center justify-center text-white active:scale-95 transition-all"', 'className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white transition-all active:scale-95"')
  .replace('className="flex flex-col gap-1 w-5"', 'className="flex w-4 flex-col gap-1"');
home = replaceRequired(home, 'className="absolute right-4 top-1/2 -translate-y-1/2 z-20 flex flex-col gap-3"', 'className="absolute right-3 top-[43%] z-20 flex -translate-y-1/2 flex-col gap-2.5"', 'Corridas Home compacta: controles do mapa liberam área central');
home = replaceRequired(home, 'className="w-12 h-12 bg-black/80 backdrop-blur-xl border border-apois-yellow/20 rounded-full flex items-center justify-center text-apois-yellow shadow-2xl active:scale-90 transition-all disabled:opacity-50"', 'className="apois-home-map-control flex h-10 w-10 items-center justify-center rounded-full border border-apois-yellow/20 bg-black/80 text-apois-yellow backdrop-blur-xl transition-all active:scale-90 disabled:opacity-50"', 'Corridas Home compacta: botão de localização menor');
home = replaceRequired(home, '<div className="apois-kit-home-panel bg-gradient-to-t from-black via-[#07090d] to-transparent pt-8 px-4 pb-4">', '<div className="apois-kit-home-panel apois-home-compact-panel px-3 pb-2.5">', 'Corridas Home compacta: painel inferior sobe menos sobre o mapa');
home = replaceRequired(home, '<div className="max-w-[430px] mx-auto space-y-5">', '<div className="mx-auto max-w-[430px] space-y-3">', 'Corridas Home compacta: espaçamento principal reduzido');
home = replaceRequired(home, 'className="flex items-center gap-3 px-1 cursor-pointer group"', 'className="apois-home-current-location group flex min-h-[46px] cursor-pointer items-center gap-2.5 px-3 py-1.5"', 'Corridas Home compacta: localização atual vira card baixo');
home = home.replace('className="w-8 h-8 rounded-full bg-apois-yellow/10 flex items-center justify-center border border-apois-yellow/20"', 'className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[10px] border border-apois-yellow/20 bg-apois-yellow/10"')
  .replace('<MapPin size={14} className="text-apois-yellow" />', '<MapPin size={13} className="text-apois-yellow" />')
  .replace('className="text-sm font-bold text-white tracking-tight group-active:text-apois-yellow transition-colors truncate"', 'className="truncate text-[13px] font-bold tracking-tight text-white transition-colors group-active:text-apois-yellow"')
  .replace('className="w-6 h-6 rounded-full border border-white/10 flex items-center justify-center"', 'className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/10"');
home = replaceRequired(home, '<div className="space-y-4">', '<div className="space-y-2.5">', 'Corridas Home compacta: bloco principal usa menos espaço vertical');
home = home.replace('className="flex flex-col gap-0.5"', 'className="flex flex-col gap-0"')
  .replace('className="text-sm font-medium text-zinc-400"', 'className="text-xs font-medium text-zinc-400"')
  .replace('className="text-sm font-black text-apois-yellow uppercase tracking-tighter"', 'className="text-xs font-black uppercase tracking-tighter text-apois-yellow"')
  .replace('className="text-[30px] font-black text-white tracking-[-0.04em] leading-tight"', 'className="text-[28px] font-black leading-[1.02] tracking-[-0.045em] text-white"');
home = replaceRequired(home, 'className="w-full bg-[#11151d]/95 border border-apois-yellow/15 rounded-[22px] p-4 flex items-center gap-4 active:scale-[0.98] transition-all cursor-pointer shadow-2xl"', 'className="apois-home-search-compact flex w-full cursor-pointer items-center gap-3 rounded-[17px] border px-3 py-2 transition-all active:scale-[0.985]"', 'Corridas Home compacta: campo de destino menor');
home = home.replace('className="w-10 h-10 bg-apois-yellow/12 rounded-[14px] flex items-center justify-center"', 'className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[11px] bg-apois-yellow/12"')
  .replace('className="w-5 h-5 border-2 border-apois-yellow rounded-full flex items-center justify-center"', 'className="flex h-[18px] w-[18px] items-center justify-center rounded-full border-2 border-apois-yellow"')
  .replace('className="text-zinc-500 font-medium text-base"', 'className="truncate text-sm font-medium text-zinc-400"');
home = replaceRequired(home, '<div className="flex items-center gap-3">', '<div className="flex items-center gap-2">', 'Corridas Home compacta: linha Favorito/Serviços mais enxuta');
home = home.replace('className="flex-1 min-h-12 py-3 px-4 bg-[#11151d] border border-white/8 rounded-[16px] flex items-center justify-center gap-2 font-bold text-white text-xs active:scale-95 transition-all"', 'className="apois-home-shortcut flex min-h-11 flex-1 items-center justify-center gap-2 rounded-[14px] border px-3 py-2 text-xs font-bold text-white transition-all active:scale-95"')
  .replace('className="flex-1 min-h-12 py-3 px-4 bg-apois-yellow/10 border border-apois-yellow/25 rounded-[16px] flex items-center justify-center gap-2 font-bold text-apois-yellow text-xs active:scale-95 transition-all"', 'className="apois-home-shortcut apois-home-shortcut-premium flex min-h-11 flex-1 items-center justify-center gap-2 rounded-[14px] border px-3 py-2 text-xs font-bold text-apois-yellow transition-all active:scale-95"')
  .replace('className="w-4 h-4 bg-apois-yellow flex items-center justify-center rounded-sm"', 'className="flex h-4 w-4 items-center justify-center rounded-[5px] bg-apois-yellow"');
home = home.replace('className="grid grid-cols-2 gap-3"', 'className="grid grid-cols-2 gap-2"')
  .replaceAll('className="bg-zinc-900/80 p-4 rounded-2xl border border-white/5 flex items-center gap-3 cursor-pointer active:scale-95 transition-all"', 'className="apois-home-shortcut flex min-h-11 cursor-pointer items-center gap-2 rounded-[14px] border px-3 py-2 transition-all active:scale-95"')
  .replaceAll('"w-8 h-8 rounded-lg flex items-center justify-center",', '"flex h-7 w-7 shrink-0 items-center justify-center rounded-[9px]",')
  .replace('homeFav ? "bg-blue-500/20 text-blue-400" : "bg-zinc-800 text-zinc-600"', 'homeFav ? "bg-apois-yellow/12 text-apois-yellow" : "bg-zinc-800 text-zinc-500"')
  .replace('workFav ? "bg-orange-500/20 text-orange-400" : "bg-zinc-800 text-zinc-600"', 'workFav ? "bg-white/8 text-white" : "bg-zinc-800 text-zinc-500"')
  .replace('<Home size={18} />', '<Home size={16} />')
  .replace('<Briefcase size={18} />', '<Briefcase size={16} />')
  .replaceAll('className="text-xs font-black text-white uppercase tracking-tighter"', 'className="text-[11px] font-black uppercase tracking-tight text-white"')
  .replaceAll('className="text-[10px] text-zinc-500 truncate w-[80px]"', 'className="w-[92px] truncate text-[9px] text-zinc-500"');

for (const marker of ['apois-home-compact-header','apois-home-compact-header-card','apois-home-avatar','apois-home-compact-panel','apois-home-current-location','apois-home-search-compact','apois-home-shortcut-premium','text-[28px]','min-h-11']) {
  if (!home.includes(marker)) throw new Error('[FAIL] Corridas Home compacta: marcador ausente (' + marker + ')');
}
if (!read(stylesPath).includes('APOIS_HOME_COMPACT_V2')) throw new Error('[FAIL] Corridas Home compacta: CSS não registrado');
if (!home.includes('<PassengerMap') || !home.includes('navigate({ to: "/buscar-destino"')) throw new Error('[FAIL] Corridas Home compacta: mapa/navegação funcional ausentes');
if (!home.includes('<HomeWorkShortcuts />') || !home.includes('<CategorySelector />')) throw new Error('[FAIL] Corridas Home compacta: componentes funcionais obrigatórios desapareceram');

write(homePath, home);
console.log('[OK] APOIS_HOME_COMPACT_V2: Home Passageiro mais baixa, mapa mais exposto e fluxos preservados');
