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
    source = replaceRequired(
      source,
      '<div className="relative flex-1 bg-[#0A0D14] overflow-hidden flex flex-col">',
      '<div className="apois-kit-home relative flex-1 overflow-hidden bg-[#07090d] flex flex-col">',
      'Corridas visual: raiz da Home usa kit oficial',
    );
  }

  source = source
    .replace('bg-[#1A1D24]/80 backdrop-blur-md border border-white/5 rounded-full px-2 py-1.5 shadow-2xl', 'bg-black/75 backdrop-blur-xl border border-white/10 rounded-[22px] px-2.5 py-2 shadow-[0_16px_40px_rgba(0,0,0,.42)]')
    .replace('<span className="text-zinc-400">🌙</span>\n                ', '')
    .replace('{readString(profile?.full_name || profile?.name, "Franciel").split(" ")[0]} 👋', '{readString(profile?.full_name || profile?.name, "Franciel").split(" ")[0]}')
    .replace('text-green-500 fill-green-500/20', 'text-apois-yellow fill-apois-yellow/20')
    .replace('text-[10px] text-zinc-500 font-medium">1 motorista próximo', 'text-[10px] text-zinc-400 font-semibold">1 motorista próximo')
    .replace('className="w-12 h-12 bg-[#1A1D24] border border-white/10 rounded-full', 'className="w-12 h-12 bg-black/80 backdrop-blur-xl border border-apois-yellow/20 rounded-full')
    .replace(
      '<div className="bg-gradient-to-t from-black via-[#0A0D14] to-transparent pt-8 px-4 pb-4">',
      '<div className="apois-kit-home-panel bg-gradient-to-t from-black via-[#07090d] to-transparent pt-8 px-4 pb-4">',
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
  {
    const legacy = 'className="flex flex-col min-h-screen bg-transparent relative"';
    const current = 'className="relative min-h-0 flex-1 overflow-hidden bg-transparent"';
    const desired = 'className="apois-kit-search-screen relative min-h-0 flex-1 overflow-hidden bg-[#07090d]"';
    if (source.includes(desired)) {
      console.log('[OK] Corridas visual: busca ocupa viewport dinâmica (já aplicado)');
    } else if (source.includes(current)) {
      source = source.replace(current, desired);
      console.log('[OK] Corridas visual: busca ocupa viewport dinâmica');
    } else if (source.includes(legacy)) {
      source = source.replace(
        legacy,
        'className="apois-kit-search-screen flex h-[100dvh] min-h-0 flex-col overflow-hidden bg-[#07090d] relative"',
      );
      console.log('[OK] Corridas visual: busca ocupa viewport dinâmica');
    } else {
      throw new Error('[FAIL] Corridas visual: busca ocupa viewport dinâmica: padrão esperado não encontrado');
    }
  }
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

// BOTTOM SHEET — compatível com o shell atual. O adapter de Corridas já
// posiciona o sheet acima da navegação global e limita sua altura à área útil.
// Este hardener aceita tanto snapshots legados quanto o formato endurecido.
{
  const path = 'src/components/ui/bottom-sheet/BottomSheet.tsx';
  let source = read(path);

  const legacyHeight = '"h-auto max-h-[85vh]",';
  const visualHeight = '"h-auto max-h-[94dvh]",';
  const hardenedHeight = '"h-auto max-h-[calc(100dvh-82px-env(safe-area-inset-bottom)-12px)]",';

  if (source.includes(legacyHeight)) {
    source = source.replace(legacyHeight, visualHeight);
    console.log('[OK] Corridas visual: BottomSheet usa altura dinâmica');
  } else if (source.includes(visualHeight) || source.includes(hardenedHeight)) {
    console.log('[OK] Corridas visual: BottomSheet usa altura dinâmica (já endurecido)');
  } else {
    throw new Error('[FAIL] Corridas visual: BottomSheet usa altura dinâmica: padrão esperado não encontrado');
  }

  const legacyPadding = 'style={{ paddingBottom: "calc(72px + env(safe-area-inset-bottom))" }}';
  const visualPadding = 'style={{ paddingBottom: "max(16px, env(safe-area-inset-bottom))" }}';
  const hardenedPadding = 'style={{ paddingBottom: 0 }}';

  if (source.includes(legacyPadding)) {
    source = source.replace(legacyPadding, visualPadding);
    console.log('[OK] Corridas visual: BottomSheet remove rodapé fantasma');
  } else if (source.includes(visualPadding) || source.includes(hardenedPadding)) {
    console.log('[OK] Corridas visual: BottomSheet remove rodapé fantasma (já endurecido)');
  } else {
    throw new Error('[FAIL] Corridas visual: BottomSheet remove rodapé fantasma: padrão esperado não encontrado');
  }

  source = source
    .replace(
      'className="flex-1 overflow-y-auto px-4 pb-8"',
      'className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-5"',
    )
    .replace(
      'className="min-h-0 flex-1 overflow-y-auto px-4 pb-6"',
      'className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-6"',
    );

  for (const marker of [
    'overflow-y-auto',
    'min-h-0 flex-1',
  ]) {
    if (!source.includes(marker)) {
      throw new Error(`[FAIL] Corridas visual: BottomSheet incompleto (${marker})`);
    }
  }

  write(path, source);
}

// CATEGORIAS — cinco modalidades em cards verticais, sem corte horizontal.
{
  const path = 'src/components/pricing/CategorySelector.tsx';
  const content = `import React from "react";\nimport { useRideCategories } from "@/hooks/use-ride-categories";\nimport { usePricing } from "@/hooks/use-pricing";\nimport { PRICING_CONFIG } from "@/services/pricing/pricing-config";\nimport { cn } from "@/lib/utils";\nimport { Car, Bike, Truck, Wrench, Package, Check } from "lucide-react";\nimport { RideCategoryCode } from "@/types/pricing";\n\nconst IconMap: Record<RideCategoryCode, React.ElementType> = {\n  carro: Car,\n  moto: Bike,\n  fretes: Truck,\n  guincho: Wrench,\n  envios: Package,\n};\n\nconst descriptions: Partial<Record<RideCategoryCode, string>> = {\n  carro: "Conforto para o dia a dia",\n  moto: "Agilidade para chegar mais rápido",\n  fretes: "Fretes e mudanças com espaço para volumes",\n  guincho: "Transporte e apoio para o seu veículo",\n  envios: "Documentos e pequenos objetos",\n};\n\nexport const CategorySelector: React.FC = () => {\n  const { categories, selectedCategory, selectCategory, isLoading: categoriesLoading } = useRideCategories();\n  const { estimates, status: pricingStatus } = usePricing();\n\n  if (categoriesLoading) {\n    return <div className="grid gap-3">{[1,2,3].map((i) => <div key={i} className="h-[92px] animate-pulse rounded-[22px] border border-white/8 bg-white/[0.035]" />)}</div>;\n  }\n  if (categories.length === 0) {\n    return <div className="rounded-[22px] border border-white/8 bg-white/[0.03] px-5 py-6 text-center text-sm text-zinc-400">Não há categorias disponíveis para esta rota no momento.</div>;\n  }\n\n  return (\n    <div className="apois-kit-category-list grid gap-3 pb-1">\n      {categories.map((cat) => {\n        const isSelected = selectedCategory?.id === cat.id;\n        const Icon = IconMap[cat.key] || Car;\n        const categoryLabel = PRICING_CONFIG.LABELS[cat.key] || cat.name;\n        const estimate = estimates.find((e) => e.categoryId === cat.id);\n        const isAvailable = estimate?.available !== false;\n        return (\n          <button key={cat.id} type="button" onClick={() => isAvailable && selectCategory(cat)} disabled={!isAvailable} aria-pressed={isSelected}\n            className={cn("group grid min-h-[92px] w-full grid-cols-[58px_minmax(0,1fr)_auto] items-center gap-3 rounded-[22px] border px-3.5 py-3 text-left transition-all active:scale-[0.985]", isSelected ? "border-apois-yellow/70 bg-apois-yellow/[0.10] shadow-[0_12px_34px_rgba(246,190,28,.10)]" : isAvailable ? "border-white/8 bg-[#11151d]" : "cursor-not-allowed border-white/5 bg-white/[0.02] opacity-45")}>\n            <div className={cn("flex h-[58px] w-[58px] items-center justify-center rounded-[18px] border", isSelected ? "border-apois-yellow/35 bg-apois-yellow/15 text-apois-yellow" : "border-white/8 bg-black/30 text-zinc-300")}><Icon size={28} strokeWidth={2.1} /></div>\n            <div className="min-w-0">\n              <div className="flex items-center gap-2"><span className="text-[15px] font-black leading-tight text-white">{categoryLabel}</span>{isSelected ? <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-apois-yellow text-black"><Check size={13} strokeWidth={3} /></span> : null}</div>\n              <p className="mt-1 text-[11px] leading-snug text-zinc-500">{descriptions[cat.key] || "Categoria disponível para esta rota"}</p>\n            </div>\n            <div className="min-w-[78px] text-right"><span className="block text-[9px] font-bold uppercase tracking-[0.12em] text-zinc-600">Estimativa</span><span className={cn("mt-1 block text-sm font-black", isSelected ? "text-apois-yellow" : "text-white")}>{!isAvailable ? "Indisponível" : pricingStatus === "loading" ? "..." : estimate ? PRICING_CONFIG.CURRENCY_FORMAT.format(estimate.estimatedPrice) : "..."}</span></div>\n          </button>\n        );\n      })}\n    </div>\n  );\n};\n`;
  write(path, content);
  console.log('[OK] Corridas: categorias oficiais renderizadas sem overflow horizontal');
}

for (const [path, markers] of [
  ['src/styles.css', ['APOIS_VISUAL_KIT_V1']],
  ['src/routes/_authenticated.inicio.tsx', ['apois-kit-home-panel']],
  ['src/routes/_authenticated.buscar-destino.tsx', ['apois-kit-search-results']],
  ['src/components/ui/bottom-sheet/BottomSheet.tsx', [
    'max-h-[94dvh]',
    'max-h-[calc(100dvh-82px-env(safe-area-inset-bottom)-12px)]',
  ]],
  ['src/components/pricing/CategorySelector.tsx', ['grid-cols-[58px_minmax(0,1fr)_auto]']],
]) {
  const source = read(path);
  if (!markers.some((marker) => source.includes(marker))) {
    throw new Error(`[FAIL] Corridas visual: marcador ausente em ${path} (${markers.join(' | ')})`);
  }
}

console.log('[OK] APOIS_VISUAL_KIT_V1: Home, busca, BottomSheet e categorias aplicados no snapshot real');
