import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const workspace = process.env.APOIS_CORRIDAS_WORKSPACE || '.work/corridas';

function read(path) {
  return readFileSync(resolve(root, workspace, path), 'utf8');
}
function write(path, content) {
  writeFileSync(resolve(root, workspace, path), content, 'utf8');
}
function replaceRequired(source, search, replacement, label) {
  if (source.includes(replacement)) {
    console.log(`[OK] ${label} (já aplicado)`);
    return source;
  }
  if (!source.includes(search)) throw new Error(`[FAIL] ${label}: padrão esperado não encontrado`);
  console.log(`[OK] ${label}`);
  return source.replace(search, replacement);
}

// Marcador rastreável até o bundle/APK e acabamento compartilhado do kit visual.
{
  const path = 'src/styles.css';
  let source = read(path);
  if (!source.includes('APOIS_VISUAL_KIT_V1')) {
    source += `\n\n/* APOIS_VISUAL_KIT_V1 */\n.apois-kit-home { background:#07090d; }\n.apois-kit-home-panel {\n  background:linear-gradient(180deg,rgba(8,10,14,.82) 0%,rgba(7,9,13,.97) 24%,#050608 100%);\n  border-top:1px solid rgba(255,184,0,.18);\n  border-radius:30px 30px 0 0;\n  box-shadow:0 -20px 50px rgba(0,0,0,.58);\n}\n.apois-kit-search-screen { background:#07090d; }\n.apois-kit-search-results { scrollbar-width:none; }\n.apois-kit-search-results::-webkit-scrollbar { display:none; }\n.apois-kit-category-list { scrollbar-width:none; }\n.apois-kit-category-list::-webkit-scrollbar { display:none; }\n`;
    write(path, source);
  }
  console.log('[OK] Corridas: APOIS_VISUAL_KIT_V1 registrado');
}

// HOME — usa exatamente a estrutura existente do pin 7b047f75; nenhuma tela paralela.
{
  const path = 'src/routes/_authenticated.inicio.tsx';
  let source = read(path);

  if (!source.includes('apois-kit-home ')) {
    if (source.includes('<div className="relative flex-1 bg-[#0A0D14] overflow-hidden flex flex-col">')) {
      source = source.replace(
        '<div className="relative flex-1 bg-[#0A0D14] overflow-hidden flex flex-col">',
        '<div className="apois-kit-home relative flex-1 overflow-hidden bg-[#07090d] flex flex-col">',
      );
      console.log('[OK] Corridas visual: raiz da Home usa kit oficial (tema legado)');
    } else if (source.includes('<div className="relative flex-1 bg-[#F7F7F8] overflow-hidden flex flex-col">')) {
      source = source.replace(
        '<div className="relative flex-1 bg-[#F7F7F8] overflow-hidden flex flex-col">',
        '<div className="apois-kit-home relative flex-1 bg-[#F7F7F8] overflow-hidden flex flex-col">',
      );
      console.log('[OK] Corridas visual: raiz da Home usa kit oficial (tema vermelho/branco)');
    } else {
      throw new Error('[FAIL] Corridas visual: raiz da Home incompatível com os temas suportados');
    }
  }

  source = source
    .replace('bg-[#1A1D24]/80 backdrop-blur-md border border-white/5 rounded-full px-2 py-1.5 shadow-2xl', 'bg-black/75 backdrop-blur-xl border border-white/10 rounded-[22px] px-2.5 py-2 shadow-[0_16px_40px_rgba(0,0,0,.42)]')
    .replace('<span className="text-zinc-400">🌙</span>\n                ', '')
    .replace('<span className="text-[#666B73]">🌙</span>\n                ', '')
    .replaceAll('🌙', '')
    .replaceAll('👋', '')
    .replace('text-green-500 fill-green-500/20', 'text-apois-yellow fill-apois-yellow/20')
    .replace('text-[10px] text-zinc-500 font-medium">1 motorista próximo', 'text-[10px] text-zinc-400 font-semibold">1 motorista próximo')
    .replace('className="w-12 h-12 bg-[#1A1D24] border border-white/10 rounded-full', 'className="w-12 h-12 bg-black/80 backdrop-blur-xl border border-apois-yellow/20 rounded-full')
    .replace(
      '<div className="bg-gradient-to-t from-black via-[#0A0D14] to-transparent pt-8 px-4 pb-4">',
      '<div className="apois-kit-home-panel bg-gradient-to-t from-black via-[#07090d] to-transparent pt-8 px-4 pb-4">',
    )
    .replace(
      '<div className="bg-gradient-to-t from-white via-white/95 to-transparent pt-8 px-4 pb-4">',
      '<div className="apois-kit-home-panel bg-gradient-to-t from-white via-white/95 to-transparent pt-8 px-4 pb-4">',
    )
    .replace('className="text-3xl font-black text-white tracking-tighter leading-tight"', 'className="text-[30px] font-black text-white tracking-[-0.04em] leading-tight"')
    .replace('className="w-full bg-[#1A1D24] border border-white/5 rounded-2xl p-4', 'className="w-full bg-[#11151d]/95 border border-apois-yellow/15 rounded-[22px] p-4')
    .replace('className="w-10 h-10 bg-apois-yellow/10 rounded-xl', 'className="w-10 h-10 bg-apois-yellow/12 rounded-[14px]')
    .replace('className="flex-1 py-3 px-4 bg-[#1A1D24] border border-white/5 rounded-xl', 'className="flex-1 min-h-12 py-3 px-4 bg-[#11151d] border border-white/8 rounded-[16px]')
    .replace('className="flex-1 py-3 px-4 bg-apois-yellow/10 border border-apois-yellow/20 rounded-xl', 'className="flex-1 min-h-12 py-3 px-4 bg-apois-yellow/10 border border-apois-yellow/25 rounded-[16px]');

  // Casa/Trabalho já existiam como componente real, mas não eram renderizados.
  if (!source.includes('<HomeWorkShortcuts />')) {
    const shortcutsEnd = `              </div>\n            </div>\n          </div>\n        </div>\n      </div>\n\n      {/* MODAL DE CATEGORIAS/ROTA (UBER STYLE) */}`;
    const replacement = `              </div>\n\n              <HomeWorkShortcuts />\n            </div>\n          </div>\n        </div>\n      </div>\n\n      {/* MODAL DE CATEGORIAS/ROTA (UBER STYLE) */}`;
    source = replaceRequired(source, shortcutsEnd, replacement, 'Corridas visual: Casa e Trabalho aparecem na Home');
  }

  for (const marker of ['PassengerMap', 'apois-kit-home', 'apois-kit-home-panel', '<HomeWorkShortcuts />', 'Digite um endereço...', '<CategorySelector />']) {
    if (!source.includes(marker)) throw new Error(`[FAIL] Corridas visual Home incompleta (${marker})`);
  }
  if (source.includes('🌙') || source.includes('👋')) throw new Error('[FAIL] Corridas visual: emojis decorativos permaneceram na Home');
  write(path, source);
  console.log('[OK] Corridas: Home restaurada sobre a implementação operacional real');
}

// BUSCA — viewport dinâmica e lista imediatamente útil com o teclado aberto.
{
  const path = 'src/routes/_authenticated.buscar-destino.tsx';
  let source = read(path);
  source = replaceRequired(
    source,
    'className="flex flex-col min-h-screen bg-transparent relative"',
    'className="apois-kit-search-screen flex h-[100dvh] min-h-0 flex-col overflow-hidden bg-[#07090d] relative"',
    'Corridas visual: busca ocupa viewport dinâmica',
  );
  source = source
    .replaceAll('bg-[#1a1a1a]', 'bg-[#0b0e14]/96 backdrop-blur-xl')
    .replaceAll('bg-[#2a2a2a]', 'bg-[#11151d]')
    .replace('className="sticky top-0 bg-[#0b0e14]/96 backdrop-blur-xl pt-2 pb-4 z-30"', 'className="sticky top-0 z-30 bg-[#0b0e14]/96 pt-2 pb-3 backdrop-blur-xl"')
    .replace('className="flex-1 mt-2"', 'className="apois-kit-search-results min-h-0 flex-1 mt-2 overflow-y-auto overscroll-contain"')
    .replace('<motion.div key="results" className="space-y-1">', '<motion.div key="results" className="space-y-2 pb-6">')
    .replaceAll('font-bold text-white text-sm truncate', 'font-bold text-white text-sm whitespace-normal break-words leading-snug')
    .replaceAll('text-xs text-gray-500 truncate', 'text-xs text-zinc-400 whitespace-normal break-words leading-snug')
    .replaceAll('border-b border-white/5', 'border border-white/8 bg-white/[0.025]');

  for (const marker of ['apois-kit-search-screen', 'apois-kit-search-results', 'suggestions.map', 'whitespace-normal break-words']) {
    if (!source.includes(marker)) throw new Error(`[FAIL] Corridas visual Busca incompleta (${marker})`);
  }
  write(path, source);
  console.log('[OK] Corridas: sugestões permanecem na área útil sem exigir arrastar a tela');
}

// BOTTOM SHEET — remove a reserva fixa de 72px que escondia conteúdo quando o
// rodapé global já estava oculto na jornada de busca/revisão.
{
  const path = 'src/components/ui/bottom-sheet/BottomSheet.tsx';
  let source = read(path);
  source = replaceRequired(source, '"h-auto max-h-[85vh]",', '"h-auto max-h-[94dvh]",', 'Corridas visual: BottomSheet usa altura dinâmica');
  source = replaceRequired(
    source,
    'style={{ paddingBottom: "calc(72px + env(safe-area-inset-bottom))" }}',
    'style={{ paddingBottom: "max(16px, env(safe-area-inset-bottom))" }}',
    'Corridas visual: BottomSheet remove rodapé fantasma',
  );
  source = source.replace('className="flex-1 overflow-y-auto px-4 pb-8"', 'className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-5"');
  write(path, source);
}

// CATEGORIAS — preserve a versão ilustrada vermelho/branco quando ela já foi aplicada.
{
  const path = 'src/components/pricing/CategorySelector.tsx';
  const current = read(path);
  if (current.includes('serviceImage') && current.includes('border-[#E51B23]')) {
    console.log('[OK] Corridas: CategorySelector ilustrado vermelho/branco preservado');
  } else {
    throw new Error('[FAIL] Corridas visual: CategorySelector vermelho/branco esperado não foi encontrado');
  }
}

for (const [path, marker] of [
  ['src/styles.css', 'APOIS_VISUAL_KIT_V1'],
  ['src/routes/_authenticated.inicio.tsx', 'apois-kit-home-panel'],
  ['src/routes/_authenticated.buscar-destino.tsx', 'apois-kit-search-results'],
  ['src/components/ui/bottom-sheet/BottomSheet.tsx', 'max-h-[94dvh]'],
  ['src/components/pricing/CategorySelector.tsx', 'serviceImage'],
]) {
  if (!read(path).includes(marker)) throw new Error(`[FAIL] Corridas visual: marcador ausente em ${path} (${marker})`);
}

console.log('[OK] APOIS_VISUAL_KIT_V1: Home, busca, BottomSheet e categorias compatíveis com a identidade vermelho/branco');
