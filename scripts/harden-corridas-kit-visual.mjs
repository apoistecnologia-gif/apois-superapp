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
  if (!source.includes(search)) {
    throw new Error(`[FAIL] ${label}: padrão esperado não encontrado`);
  }
  console.log(`[OK] ${label}`);
  return source.replace(search, replacement);
}

// Marcador durável para provar que o visual restaurado entrou no bundle final.
{
  const stylesPath = 'src/styles.css';
  let styles = read(stylesPath);
  if (!styles.includes('APOIS_VISUAL_KIT_V1')) {
    styles += `\n\n/* APOIS_VISUAL_KIT_V1 */\n.apois-kit-home { background: #07090d; }\n.apois-kit-home-panel {\n  background: linear-gradient(180deg, rgba(10,12,18,.96) 0%, #07090d 36%, #050608 100%);\n  border-top: 1px solid rgba(246,190,28,.18);\n  border-radius: 30px 30px 0 0;\n  box-shadow: 0 -20px 50px rgba(0,0,0,.55);\n  scrollbar-width: none;\n}\n.apois-kit-home-panel::-webkit-scrollbar { display: none; }\n.apois-kit-search-screen { background: #07090d; }\n.apois-kit-search-screen input { box-shadow: 0 0 0 1px rgba(246,190,28,.08), 0 16px 40px rgba(0,0,0,.28); }\n.apois-kit-search-screen button { -webkit-tap-highlight-color: transparent; }\n`;
    write(stylesPath, styles);
    console.log('[OK] Corridas: marcador e acabamento visual premium adicionados');
  }
}

// Home: mantém toda a lógica já homologada e só reforça hierarquia/branding.
{
  const path = 'src/routes/_authenticated.inicio.tsx';
  let source = read(path);

  if (!source.includes('apois-kit-home')) {
    const rootPattern = /<div className="([^"]*relative flex-1[^"]*)">/;
    if (!rootPattern.test(source)) throw new Error('[FAIL] Corridas visual: raiz da Home não encontrada');
    source = source.replace(rootPattern, '<div className="apois-kit-home $1">');
  }

  if (!source.includes('apois-kit-home-panel')) {
    source = source.replace(
      '<section className="absolute inset-x-0 bottom-0 z-30 max-h-[54dvh] overflow-y-auto',
      '<section className="apois-kit-home-panel absolute inset-x-0 bottom-0 z-30 max-h-[54dvh] overflow-y-auto',
    );
  }

  source = source.replaceAll('bg-white/95', 'bg-[#0b0e14]/96');
  source = source.replaceAll('text-slate-950', 'text-white');
  source = source.replaceAll('text-slate-900', 'text-white');
  source = source.replaceAll('border-slate-200', 'border-white/10');
  source = source.replaceAll('shadow-xl', 'shadow-[0_18px_50px_rgba(0,0,0,.38)]');
  source = source.replaceAll('rounded-2xl', 'rounded-[22px]');

  // Não remover os marcadores exigidos por verify:dist.
  for (const marker of [
    '"./assets/ride-categories/carros.svg"',
    '"./assets/ride-categories/motos.svg"',
    '"./assets/ride-categories/fretes.svg"',
    '"./assets/ride-categories/guincho.svg"',
    '"./assets/ride-categories/envios.svg"',
    'absolute inset-x-0 bottom-0 z-30 max-h-[54dvh]',
  ]) {
    if (!source.includes(marker)) throw new Error(`[FAIL] Corridas visual: Home perdeu marcador obrigatório (${marker})`);
  }

  write(path, source);
  console.log('[OK] Corridas: Home recebeu acabamento visual APOIS sem alterar fluxo funcional');
}

// Busca: aumenta área útil com teclado e torna as sugestões imediatamente legíveis.
{
  const path = 'src/routes/_authenticated.buscar-destino.tsx';
  let source = read(path);

  source = replaceRequired(
    source,
    'className="flex flex-col min-h-screen bg-transparent relative"',
    'className="apois-kit-search-screen flex h-[100dvh] min-h-0 flex-col overflow-hidden bg-[#07090d] relative"',
    'Corridas: tela de busca ocupa viewport dinâmico real',
  );
  source = source.replaceAll('bg-[#1a1a1a]', 'bg-[#0b0e14]/95 backdrop-blur-xl');
  source = source.replaceAll('bg-[#2a2a2a]', 'bg-[#11151d]');
  source = source.replaceAll('rounded-xl border border-white/5', 'rounded-2xl border border-white/10');
  source = source.replaceAll('border-b border-white/5', 'border border-white/8 bg-white/[0.025]');
  source = source.replaceAll('text-gray-500 truncate', 'text-zinc-400 whitespace-normal break-words leading-snug');
  source = source.replaceAll('font-bold text-white text-sm truncate', 'font-bold text-white text-sm whitespace-normal break-words leading-snug');
  source = source.replace(
    '<motion.div key="results" className="space-y-1">',
    '<motion.div key="results" className="space-y-2 pb-6">',
  );
  write(path, source);
  console.log('[OK] Corridas: busca recebeu layout premium e resultados sem truncamento forçado');
}

// BottomSheet: o padding antigo reservava 72px mesmo em telas sem rodapé e escondia sugestões com teclado.
{
  const path = 'src/components/ui/bottom-sheet/BottomSheet.tsx';
  let source = read(path);
  source = replaceRequired(
    source,
    '"h-auto max-h-[85vh]",',
    '"h-auto max-h-[94dvh]",',
    'Corridas: BottomSheet usa altura dinâmica maior',
  );
  source = replaceRequired(
    source,
    'style={{ paddingBottom: "calc(72px + env(safe-area-inset-bottom))" }}',
    'style={{ paddingBottom: "max(16px, env(safe-area-inset-bottom))" }}',
    'Corridas: BottomSheet não reserva rodapé fantasma',
  );
  source = source.replace(
    'className="flex-1 overflow-y-auto px-4 pb-8"',
    'className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-5"',
  );
  write(path, source);
}

// Categorias: substitui cards estreitos/truncados por cards premium verticais e responsivos.
{
  const path = 'src/components/pricing/CategorySelector.tsx';
  const content = `import React from "react";\nimport { useRideCategories } from "@/hooks/use-ride-categories";\nimport { usePricing } from "@/hooks/use-pricing";\nimport { PRICING_CONFIG } from "@/services/pricing/pricing-config";\nimport { cn } from "@/lib/utils";\nimport { Car, Bike, Truck, Anchor, Package, Check } from "lucide-react";\nimport { RideCategoryCode } from "@/types/pricing";\n\nconst IconMap: Record<RideCategoryCode, React.ElementType> = {\n  carro: Car,\n  moto: Bike,\n  fretes: Truck,\n  guincho: Anchor,\n  envios: Package,\n};\n\nconst descriptions: Partial<Record<RideCategoryCode, string>> = {\n  carro: "Conforto para o dia a dia",\n  moto: "Agilidade para chegar mais rápido",\n  fretes: "Volumes, móveis e pequenas mudanças",\n  guincho: "Suporte para transportar seu veículo",\n  envios: "Documentos e pequenos objetos",\n};\n\nexport const CategorySelector: React.FC = () => {\n  const { categories, selectedCategory, selectCategory, isLoading: categoriesLoading } = useRideCategories();\n  const { estimates, status: pricingStatus } = usePricing();\n\n  if (categoriesLoading) {\n    return (\n      <div className="grid gap-3">\n        {[1, 2, 3].map((i) => (\n          <div key={i} className="h-[92px] animate-pulse rounded-[22px] border border-white/8 bg-white/[0.035]" />\n        ))}\n      </div>\n    );\n  }\n\n  if (categories.length === 0) {\n    return (\n      <div className="rounded-[22px] border border-white/8 bg-white/[0.03] px-5 py-6 text-center text-sm text-zinc-400">\n        Não há categorias disponíveis para esta rota no momento.\n      </div>\n    );\n  }\n\n  return (\n    <div className="grid gap-3 pb-1">\n      {categories.map((cat) => {\n        const isSelected = selectedCategory?.id === cat.id;\n        const Icon = IconMap[cat.key] || Car;\n        const categoryLabel = PRICING_CONFIG.LABELS[cat.key] || cat.name;\n        const estimate = estimates.find((e) => e.categoryId === cat.id);\n        const isAvailable = estimate?.available !== false;\n\n        return (\n          <button\n            key={cat.id}\n            type="button"\n            onClick={() => isAvailable && selectCategory(cat)}\n            disabled={!isAvailable}\n            aria-pressed={isSelected}\n            className={cn(\n              "group grid min-h-[92px] w-full grid-cols-[58px_minmax(0,1fr)_auto] items-center gap-3 rounded-[22px] border px-3.5 py-3 text-left transition-all active:scale-[0.985]",\n              isSelected\n                ? "border-apois-yellow/70 bg-apois-yellow/[0.10] shadow-[0_12px_34px_rgba(246,190,28,.10)]"\n                : isAvailable\n                  ? "border-white/8 bg-[#11151d] hover:border-white/15"\n                  : "cursor-not-allowed border-white/5 bg-white/[0.02] opacity-45",\n            )}\n          >\n            <div\n              className={cn(\n                "flex h-[58px] w-[58px] items-center justify-center rounded-[18px] border",\n                isSelected\n                  ? "border-apois-yellow/35 bg-apois-yellow/15 text-apois-yellow"\n                  : "border-white/8 bg-black/30 text-zinc-300",\n              )}\n            >\n              <Icon size={28} strokeWidth={2.1} />\n            </div>\n\n            <div className="min-w-0">\n              <div className="flex items-center gap-2">\n                <span className="text-[15px] font-black leading-tight text-white">{categoryLabel}</span>\n                {isSelected ? (\n                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-apois-yellow text-black">\n                    <Check size={13} strokeWidth={3} />\n                  </span>\n                ) : null}\n              </div>\n              <p className="mt-1 text-[11px] leading-snug text-zinc-500">\n                {descriptions[cat.key] || "Categoria disponível para esta rota"}\n              </p>\n            </div>\n\n            <div className="min-w-[74px] text-right">\n              <span className="block text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-600">Estimativa</span>\n              <span className={cn("mt-1 block text-sm font-black", isSelected ? "text-apois-yellow" : "text-white")}>\n                {!isAvailable\n                  ? "Indisponível"\n                  : pricingStatus === "loading"\n                    ? "..."\n                    : estimate\n                      ? PRICING_CONFIG.CURRENCY_FORMAT.format(estimate.estimatedPrice)\n                      : "..."}\n              </span>\n            </div>\n          </button>\n        );\n      })}\n    </div>\n  );\n};\n`;
  write(path, content);
  console.log('[OK] Corridas: categorias restauradas em cards premium sem truncamento horizontal');
}

for (const [path, marker] of [
  ['src/styles.css', 'APOIS_VISUAL_KIT_V1'],
  ['src/routes/_authenticated.inicio.tsx', 'apois-kit-home'],
  ['src/routes/_authenticated.buscar-destino.tsx', 'apois-kit-search-screen'],
  ['src/components/pricing/CategorySelector.tsx', 'grid-cols-[58px_minmax(0,1fr)_auto]'],
]) {
  if (!read(path).includes(marker)) throw new Error(`[FAIL] Corridas visual: marcador ausente em ${path} (${marker})`);
}

console.log('[OK] APOIS_VISUAL_KIT_V1: Home, busca, BottomSheet e categorias aplicados na camada durável do Superapp');
