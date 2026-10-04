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
    source += `\n\n/* APOIS_VISUAL_KIT_V1 */\n/* APOIS_REFERENCE_HOME_V2 */\n.apois-kit-home { background:#eef1f4; color:#111; }\n.apois-kit-home-panel {\n  background:rgba(255,255,255,.985);\n  border-top:1px solid #e2e4e8;\n  border-radius:32px 32px 0 0;\n  box-shadow:0 -16px 44px rgba(17,17,17,.14);\n}\n.apois-kit-search-screen { background:#f7f7f8; color:#111; }\n.apois-kit-search-results { scrollbar-width:none; }\n.apois-kit-search-results::-webkit-scrollbar { display:none; }\n.apois-kit-category-list { scrollbar-width:none; }\n.apois-kit-category-list::-webkit-scrollbar { display:none; }\n`;
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


  // HOME V2 — aproxima a tela operacional do mock aprovado: mapa claro predominante,
  // cabeçalho enxuto, busca flutuante e painel branco inferior. A lógica de
  // autenticação, GPS, destino, categorias, pagamentos, cupom e solicitação é preservada.
  source = source
    .replace(
      'import { MapPin, ChevronRight, Settings2, RefreshCw, Navigation, AlertCircle, Home, Briefcase } from "lucide-react";',
      'import { MapPin, ChevronRight, Settings2, RefreshCw, Navigation, AlertCircle, Home, Briefcase, Bell } from "lucide-react";',
    )
    .replace('const { route, status: routeStatus, error: routeError } = useRoute();', 'const { route, error: routeError } = useRoute();')
    .replace('const { location, refreshLocation, isLoading: isLocating, permissionState, error: locationError } = useLocation();', 'const { location, refreshLocation, isLoading: isLocating, error: locationError } = useLocation();')
    .replace(
      'bg-zinc-900/80 p-4 rounded-2xl border border-white/5 flex items-center gap-3 cursor-pointer active:scale-95 transition-all',
      'bg-white p-3 rounded-2xl border border-[#E2E4E8] flex items-center gap-3 cursor-pointer active:scale-95 transition-all shadow-sm',
    )
    .replace(
      'bg-zinc-900/80 p-4 rounded-2xl border border-[#E2E4E8] flex items-center gap-3 cursor-pointer active:scale-95 transition-all',
      'bg-white p-3 rounded-2xl border border-[#E2E4E8] flex items-center gap-3 cursor-pointer active:scale-95 transition-all shadow-sm',
    )
    .replaceAll('homeFav ? "bg-blue-500/20 text-blue-400" : "bg-zinc-800 text-zinc-600"', 'homeFav ? "bg-[#FFF1F2] text-[#E51B23]" : "bg-[#F1F2F4] text-[#666B73]"')
    .replaceAll('homeFav ? "bg-blue-500/20 text-blue-400" : "bg-zinc-800 text-[#9CA1A9]"', 'homeFav ? "bg-[#FFF1F2] text-[#E51B23]" : "bg-[#F1F2F4] text-[#666B73]"')
    .replaceAll('workFav ? "bg-orange-500/20 text-orange-400" : "bg-zinc-800 text-zinc-600"', 'workFav ? "bg-[#FFF1F2] text-[#E51B23]" : "bg-[#F1F2F4] text-[#666B73]"')
    .replaceAll('workFav ? "bg-orange-500/20 text-orange-400" : "bg-zinc-800 text-[#9CA1A9]"', 'workFav ? "bg-[#FFF1F2] text-[#E51B23]" : "bg-[#F1F2F4] text-[#666B73]"')
    .replaceAll('text-xs font-black text-white uppercase tracking-tighter', 'text-xs font-black text-[#111111] uppercase tracking-tighter')
    .replaceAll('text-[10px] text-zinc-500 truncate w-[80px]', 'text-[10px] text-[#666B73] truncate w-[80px]');

  const inicioIndex = source.indexOf('function InicioPage() {');
  const returnIndex = source.indexOf('  return (', inicioIndex);
  const returnEnd = source.lastIndexOf('\n  );\n}');
  if (inicioIndex < 0 || returnIndex < 0 || returnEnd < returnIndex) {
    throw new Error('[FAIL] Corridas visual V2: não foi possível localizar o retorno da Home');
  }

  const referenceHome = `  return (
    <div data-apois-reference-home-v2 className="apois-kit-home relative flex min-h-0 flex-1 flex-col overflow-hidden bg-[#EEF1F4] text-[#111111]">
      <div className="absolute inset-0 z-0 bg-[#EEF1F4]">
        <PassengerMap
          origin={location ? { lat: location.latitude, lng: location.longitude } : undefined}
          destination={destination ? { lat: destination.latitude, lng: destination.longitude } : undefined}
          encodedPolyline={route?.encodedPolyline}
          driverLocation={undefined}
          isStatic={false}
        />
      </div>

      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-40 bg-gradient-to-b from-white/95 via-white/70 to-transparent" />

      <header className="relative z-30 flex items-center justify-between px-4 pt-[max(env(safe-area-inset-top),14px)]">
        <div className="flex items-center gap-2.5">
          <img src={brandLogo} alt="APOIS" className="h-12 w-12 rounded-full object-contain shadow-sm" />
          <div className="leading-none">
            <div className="text-[24px] font-black tracking-[-0.05em] text-[#111111]">AP<span className="text-[#E51B23]">O</span>IS</div>
            <div className="mt-1 text-[9px] font-black tracking-[0.34em] text-[#666B73]">VAMOS?</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => navigate({ to: "/notificacoes" })} className="grid h-12 w-12 place-items-center rounded-full border border-[#E2E4E8] bg-white/95 text-[#111111] shadow-[0_8px_22px_rgba(17,17,17,.10)] active:scale-95" aria-label="Notificações">
            <Bell size={21} />
          </button>
          <button type="button" onClick={() => navigate({ to: "/perfil" })} className="h-12 w-12 overflow-hidden rounded-full border-2 border-white bg-[#F1F2F4] shadow-[0_8px_22px_rgba(17,17,17,.12)] active:scale-95" aria-label="Abrir perfil">
            {profile?.avatar_url ? <img src={profile.avatar_url} alt="Foto do passageiro" className="h-full w-full object-cover" /> : <span className="grid h-full w-full place-items-center text-sm font-black text-[#E51B23]">{readString(profile?.full_name || profile?.name, "P")[0]}</span>}
          </button>
        </div>
      </header>

      <button
        type="button"
        onClick={() => navigate({ to: "/buscar-destino", search: { stop: false } })}
        className="relative z-30 mx-4 mt-4 flex min-h-[76px] items-center gap-4 rounded-[24px] border border-[#E2E4E8] bg-white/95 px-4 text-left shadow-[0_14px_34px_rgba(17,17,17,.13)] backdrop-blur-md active:scale-[.99]"
      >
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#FFF1F2] text-[#E51B23]"><MapPin size={27} fill="currentColor" /></div>
        <div className="min-w-0 flex-1">
          <div className="text-[20px] font-black leading-tight text-[#111111]">Para onde vamos?</div>
          <div className="mt-1 truncate text-sm font-medium text-[#666B73]">{destination?.label || destination?.formattedAddress || "Digite seu destino"}</div>
        </div>
        <ChevronRight className="shrink-0 text-[#666B73]" size={25} />
      </button>

      <div className="absolute right-4 top-[43%] z-30 flex flex-col gap-3">
        {locationError ? <div className="rounded-xl bg-white px-2 py-1 text-[10px] font-extrabold text-[#E51B23] shadow-md">GPS</div> : null}
        <button type="button" onClick={() => refreshLocation()} disabled={isLocating} className="grid h-12 w-12 place-items-center rounded-full border border-[#E2E4E8] bg-white/95 text-[#111111] shadow-[0_10px_26px_rgba(17,17,17,.15)] active:scale-90 disabled:opacity-50" aria-label="Centralizar minha localização">
          <Navigation className={cn("h-5 w-5", isLocating && "animate-pulse")} />
        </button>
      </div>

      <section className="apois-kit-home-panel relative z-40 mt-auto max-h-[50dvh] overflow-y-auto overscroll-contain rounded-t-[32px] border-t border-[#E2E4E8] bg-white px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-3 shadow-[0_-16px_44px_rgba(17,17,17,.14)]">
        <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-[#C9CDD3]" />

        <div className="rounded-[22px] border border-[#E2E4E8] bg-white px-4">
          <button type="button" onClick={() => refreshLocation()} className="flex min-h-[68px] w-full items-center gap-3 border-b border-[#ECEEF1] text-left">
            <span className="relative grid h-9 w-9 place-items-center"><span className="h-4 w-4 rounded-full border-[5px] border-[#2563EB] bg-white" /></span>
            <span className="min-w-0 flex-1"><span className="block text-xs font-semibold text-[#7A8088]">Local de partida</span><span className="block truncate text-[16px] font-extrabold text-[#111111]">{currentAddressText}</span></span>
            <ChevronRight size={22} className="text-[#777D85]" />
          </button>
          <button type="button" onClick={() => navigate({ to: "/buscar-destino", search: { stop: false } })} className="flex min-h-[68px] w-full items-center gap-3 text-left">
            <span className="grid h-9 w-9 place-items-center text-[#E51B23]"><MapPin size={29} fill="currentColor" /></span>
            <span className="min-w-0 flex-1"><span className="block text-xs font-semibold text-[#7A8088]">Destino</span><span className="block truncate text-[16px] font-extrabold text-[#111111]">{destination?.label || destination?.formattedAddress || "Digite seu destino"}</span></span>
            <ChevronRight size={22} className="text-[#777D85]" />
          </button>
        </div>

        <div className="mt-4"><CategorySelector /></div>

        {(hasDestination || route) ? (
          <div className="mt-4 space-y-4">
            {routeError ? <div className="flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700"><AlertCircle size={17} />{routeError}</div> : null}
            <RideStopsInput />
            {selectedCategory && ["fretes", "guincho", "envios"].includes(selectedCategory.code) ? (
              <button type="button" onClick={() => setIsFormOpen(true)} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#E2E4E8] bg-white px-3 text-xs font-extrabold text-[#E51B23]"><Settings2 size={15} />Detalhes do serviço</button>
            ) : null}
            <PaymentMethodSelector onOpenList={() => setIsPaymentListOpen(true)} />
            <CouponInput />
            <FareDetails />
            <CheckoutSummary />
          </div>
        ) : null}

        <button
          type="button"
          onClick={handleReview}
          disabled={!checkout.readiness || !!routeError}
          className={cn(
            "mt-4 flex min-h-[58px] w-full items-center justify-center gap-2 rounded-[20px] text-[18px] font-black shadow-[0_12px_30px_rgba(229,27,35,.24)] transition active:scale-[.99]",
            checkout.readiness && !routeError ? "bg-[#E51B23] text-white" : "bg-[#E6E8EB] text-[#9AA0A8]"
          )}
        >
          Solicitar corrida <ChevronRight size={23} strokeWidth={3} />
        </button>

        <div className="mt-4"><HomeWorkShortcuts /></div>
      </section>

      <ServiceDetailsForm isOpen={isFormOpen} onClose={() => setIsFormOpen(false)} />
      <PaymentMethodList isOpen={isPaymentListOpen} onClose={() => setIsPaymentListOpen(false)} />
    </div>
  );`;

  source = source.slice(0, returnIndex) + referenceHome + source.slice(returnEnd + '\n  );'.length);
  if (!source.includes('data-apois-reference-home-v2')) throw new Error('[FAIL] Corridas visual V2 não entrou na Home');
  console.log('[OK] Corridas: Home operacional alinhada ao mock aprovado sem alterar lógica de corrida');

  for (const marker of ['PassengerMap', 'data-apois-reference-home-v2', 'apois-kit-home', 'apois-kit-home-panel', '<HomeWorkShortcuts />', 'Digite seu destino', '<CategorySelector />', 'Solicitar corrida']) {
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
    'className="apois-kit-search-screen flex h-[100dvh] min-h-0 flex-col overflow-hidden bg-[#F7F7F8] text-[#111111] relative"',
    'Corridas visual: busca ocupa viewport dinâmica',
  );
  source = source
    .replaceAll('bg-[#1a1a1a]', 'bg-white/95 backdrop-blur-xl')
    .replaceAll('bg-[#2a2a2a]', 'bg-white')
    .replace('className="sticky top-0 bg-white/95 backdrop-blur-xl pt-2 pb-4 z-30"', 'className="sticky top-0 z-30 bg-white/95 pt-2 pb-3 backdrop-blur-xl"')
    .replace('className="flex-1 mt-2"', 'className="apois-kit-search-results min-h-0 flex-1 mt-2 overflow-y-auto overscroll-contain"')
    .replace('<motion.div key="results" className="space-y-1">', '<motion.div key="results" className="space-y-2 pb-6">')
    .replaceAll('font-bold text-white text-sm truncate', 'font-bold text-[#111111] text-sm whitespace-normal break-words leading-snug')
    .replaceAll('text-xs text-gray-500 truncate', 'text-xs text-[#666B73] whitespace-normal break-words leading-snug')
    .replaceAll('border-b border-white/5', 'border border-[#E2E4E8] bg-white');

  for (const marker of ['apois-kit-search-screen', 'apois-kit-search-results', 'suggestions.map', 'whitespace-normal break-words']) {
    if (!source.includes(marker)) throw new Error(`[FAIL] Corridas visual Busca incompleta (${marker})`);
  }
  write(path, source);
  console.log('[OK] Corridas: sugestões permanecem na área útil sem exigir arrastar a tela');
}

// RODAPÉ — mantém os cinco destinos funcionais, mas em branco/vermelho.
{
  const path = 'src/components/BottomNavigation.tsx';
  let source = read(path);
  source = source
    .replace('border-t border-white/10 bg-black', 'border-t border-[#E2E4E8] bg-white')
    .replace('shadow-[0_-10px_30px_rgba(0,0,0,0.55)]', 'shadow-[0_-8px_26px_rgba(17,17,17,0.10)]')
    .replaceAll('text-zinc-500', 'text-[#8A9098]');
  write(path, source);
  console.log('[OK] Corridas visual: rodapé funcional usa superfície branca e destaque vermelho');
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
  ['src/styles.css', 'APOIS_REFERENCE_HOME_V2'],
  ['src/routes/_authenticated.inicio.tsx', 'data-apois-reference-home-v2'],
  ['src/routes/_authenticated.inicio.tsx', 'apois-kit-home-panel'],
  ['src/routes/_authenticated.buscar-destino.tsx', 'apois-kit-search-results'],
  ['src/components/ui/bottom-sheet/BottomSheet.tsx', 'max-h-[94dvh]'],
  ['src/components/pricing/CategorySelector.tsx', 'serviceImage'],
]) {
  if (!read(path).includes(marker)) throw new Error(`[FAIL] Corridas visual: marcador ausente em ${path} (${marker})`);
}

console.log('[OK] APOIS_VISUAL_KIT_V1: Home, busca, BottomSheet e categorias compatíveis com a identidade vermelho/branco');
