import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve('.work/corridas');

function patch(relativePath, transform, label) {
  const full = resolve(root, relativePath);
  const before = readFileSync(full, 'utf8');
  const after = transform(before);
  if (after === before) {
    console.log('[OK] ' + label + ' (já aplicado)');
  } else {
    writeFileSync(full, after, 'utf8');
    console.log('[OK] ' + label);
  }
  return after;
}

function requireMarkers(source, markers, label) {
  const missing = markers.filter((marker) => !source.includes(marker));
  if (missing.length) throw new Error('[FAIL] ' + label + ': ' + missing.join(' | '));
}

// APOIS_CORRIDAS_MOBILE_PROPORTIONS_V1
// Ajuste exclusivamente visual/mobile. Não altera autenticação, pricing,
// request ride, Maps/GPS/Places, pagamentos ou regras de negócio.

const bottomSheet = patch('src/components/ui/bottom-sheet/BottomSheet.tsx', (source) => {
  let next = source;
  next = next
    .replace(
      '"fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] z-[60]",',
      '"fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] z-[120]",',
    )
    .replace(
      'className="fixed inset-0 bg-black/60 z-40"',
      'className="fixed inset-0 z-[110] bg-black/60"',
    )
    .replace(
      'style={{ paddingBottom: "max(16px, env(safe-area-inset-bottom))" }}',
      'style={{ paddingBottom: "max(52px, env(safe-area-inset-bottom))" }}',
    );
  return next;
}, 'Corridas mobile: BottomSheet fica acima do rodapé e da navegação Android');

requireMarkers(bottomSheet, [
  'z-[120]',
  'z-[110]',
  'max(52px, env(safe-area-inset-bottom))',
], 'BottomSheet mobile');

const payment = patch('src/components/payments/PaymentMethodSelector.tsx', (source) => {
  let next = source;

  // Card resumido da forma de pagamento: menos altura na Home.
  next = next
    .replace(
      'className="w-full bg-white border border-[#E2E4E8] rounded-2xl p-4 flex items-center justify-between active:scale-[0.98] transition-all"',
      'className="w-full bg-white border border-[#E2E4E8] rounded-2xl p-3 flex items-center justify-between active:scale-[0.98] transition-all shadow-sm"',
    )
    .replace(
      'className="w-10 h-10 rounded-xl bg-[#FFF1F2] flex items-center justify-center text-[#E51B23]"',
      'className="w-9 h-9 rounded-xl bg-[#FFF1F2] flex items-center justify-center text-[#E51B23]"',
    )
    .replace(
      'className="text-[10px] font-black uppercase tracking-widest text-[#666B73] mb-0.5"',
      'className="text-[9px] font-black uppercase tracking-widest text-[#666B73] mb-0.5"',
    );

  // A lista precisa ficar acima do rodapé global (z-100) e ter scroll próprio.
  next = next
    .replace(
      'className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"',
      'className="fixed inset-0 z-[140] flex items-end justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200 overscroll-contain"',
    )
    .replace(
      'className="w-full max-w-lg bg-white rounded-t-[32px] p-6 shadow-2xl animate-in slide-in-from-bottom duration-300 border-t border-[#E2E4E8]"',
      'className="flex max-h-[78dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-[28px] border-t border-[#E2E4E8] bg-white px-4 pt-4 pb-[max(52px,env(safe-area-inset-bottom))] shadow-2xl animate-in slide-in-from-bottom duration-300"',
    )
    .replace(
      'className="flex items-center justify-between mb-6"',
      'className="mb-3 flex shrink-0 items-center justify-between"',
    )
    .replace(
      'className="text-xl font-black text-[#111111]"',
      'className="text-[19px] font-black text-[#111111]"',
    )
    .replace(
      'className="space-y-2 mb-6"',
      'className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain pb-1 touch-pan-y"',
    )
    .replaceAll(
      '"w-full p-4 rounded-2xl flex items-center justify-between border-2 transition-all"',
      '"w-full p-3 rounded-2xl flex items-center justify-between border-2 transition-all"',
    )
    .replaceAll(
      '"w-12 h-12 rounded-xl flex items-center justify-center transition-colors"',
      '"w-11 h-11 rounded-xl flex items-center justify-center transition-colors"',
    )
    .replace(
      '<p className="text-[11px] text-[#666B73] font-medium">{method.description}</p>',
      '<p className="line-clamp-2 text-[11px] leading-[1.3] text-[#666B73] font-medium">{method.description}</p>',
    );

  return next;
}, 'Corridas mobile: seletor de pagamento fica acima do rodapé e rola internamente');

requireMarkers(payment, [
  'z-[140]',
  'max-h-[78dvh]',
  'overflow-y-auto overscroll-contain',
  'touch-pan-y',
], 'seletor de pagamento mobile');

const home = patch('src/routes/_authenticated.inicio.tsx', (source) => {
  let next = source;
  next = next
    .replace(
      'max-h-[38dvh] overflow-y-auto overscroll-contain rounded-t-[28px]',
      'max-h-[46dvh] overflow-y-auto overscroll-contain scrollbar-hide rounded-t-[28px]',
    )
    .replaceAll('mt-2.5"><CategorySelector', 'mt-2"><CategorySelector')
    .replace('className="mt-3 space-y-3"', 'className="mt-2 space-y-2.5"')
    .replace('className="mt-3 flex min-h-[52px]', 'className="mt-2 flex min-h-[48px]')
    .replace('className="mt-3"><HomeWorkShortcuts', 'className="mt-2"><HomeWorkShortcuts');
  return next;
}, 'Corridas mobile: Home usa painel mais proporcional e compacto');

requireMarkers(home, [
  'max-h-[46dvh]',
  'overflow-y-auto overscroll-contain scrollbar-hide',
], 'Home compacta');

const activeRide = patch('src/routes/_authenticated.corrida.$rideId.tsx', (source) => {
  let next = source;

  // Durante a procura já existe o card "Buscando motoristas" no painel inferior.
  // Remover o banner superior duplicado evita a mensagem piscando a cada refresh.
  next = next.replace(
    '<RideStatusHeader status={status} isRefreshing={isRefreshing} />',
    '{status !== "procurar_motorista" ? <RideStatusHeader status={status} isRefreshing={isRefreshing} /> : null}',
  );

  // QA217: keep the existing "hide duplicate searching header" behavior
  // when the ETA component receives new road-distance props.
  if (next.includes('APOIS_PASSENGER_QA217_ETA_V1') &&
      !next.includes('status !== "procurar_motorista" ? <RideStatusHeader')) {
    const headerStart=next.indexOf('<RideStatusHeader status={status} isRefreshing={isRefreshing}');
    const headerEnd=headerStart<0?-1:next.indexOf('/>',headerStart);
    if(headerStart<0||headerEnd<0||headerEnd-headerStart>500)
      throw Error('[FAIL] QA217 RideStatusHeader layout drift');
    const header=next.slice(headerStart,headerEnd+2);
    next=next.slice(0,headerStart)+
      '{status !== "procurar_motorista" ? '+header+' : null}'+
      next.slice(headerEnd+2);
  }

  // Mantém mais mapa visível e deixa o conteúdo rolável quando necessário.
  next = next
    .replace(
      'className="max-h-[60vh] space-y-4 overflow-y-auto rounded-t-[32px] border-t border-[#E2E4E8] bg-white px-6 pb-8 pt-6 shadow-[0_-12px_34px_rgba(17,17,17,0.12)] scrollbar-hide"',
      'className="max-h-[52dvh] space-y-3 overflow-y-auto overscroll-contain rounded-t-[28px] border-t border-[#E2E4E8] bg-white px-4 pb-[max(52px,env(safe-area-inset-bottom))] pt-4 shadow-[0_-12px_34px_rgba(17,17,17,0.12)] scrollbar-hide"',
    )
    .replace(
      'className="flex flex-col items-center justify-center space-y-4 rounded-2xl border border-[#E2E4E8] bg-white p-8 text-center"',
      'className="flex flex-col items-center justify-center space-y-3 rounded-2xl border border-[#E2E4E8] bg-white p-4 text-center"',
    )
    .replace(
      'className="h-16 w-16 animate-spin rounded-full border-2 border-[#E51B23]/20 border-t-[#E51B23]"',
      'className="h-12 w-12 animate-spin rounded-full border-2 border-[#E51B23]/20 border-t-[#E51B23]"',
    )
    .replace(
      'size={24}',
      'size={20}',
    )
    .replace(
      '<h4 className="font-black text-[#111111]">Buscando motoristas</h4>',
      '<h4 className="text-[17px] font-black text-[#111111]">Buscando motoristas</h4>',
    );

  return next;
}, 'Corridas mobile: procura de motorista sem banner duplicado/piscando e painel mais compacto');

requireMarkers(activeRide, [
  'status !== "procurar_motorista" ? <RideStatusHeader',
  'max-h-[52dvh]',
  'overscroll-contain',
  'Buscando motoristas',
], 'tela Procurando motorista');

const review = patch('src/routes/_authenticated.revisar-solicitacao.tsx', (source) => {
  let next = source;
  next = next
    .replace(
      'className="flex min-h-screen flex-col bg-[#F7F7F8] text-[#111111] pb-safe"',
      'className="flex h-[100dvh] min-h-0 flex-col overflow-hidden bg-[#F7F7F8] text-[#111111]"',
    )
    .replace(
      'className="px-5 py-6 flex items-center gap-4 border-b border-[#E2E4E8] bg-white backdrop-blur-md sticky top-0 z-10"',
      'className="flex shrink-0 items-center gap-3 border-b border-[#E2E4E8] bg-white px-4 py-3 pt-[max(12px,env(safe-area-inset-top))] backdrop-blur-md"',
    )
    .replace(
      'className="flex-1 px-5 py-6 space-y-6 overflow-y-auto"',
      'className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-4"',
    )
    .replace(
      'className="px-5 py-6 bg-white/95 backdrop-blur-xl border-t border-[#E2E4E8]"',
      'className="shrink-0 border-t border-[#E2E4E8] bg-white/95 px-4 pt-3 pb-[max(64px,env(safe-area-inset-bottom))] backdrop-blur-xl"',
    )
    .replace(
      '"w-full h-16 rounded-2xl font-black text-lg transition-all active:scale-[0.98]"',
      '"h-14 w-full rounded-2xl text-base font-black transition-all active:scale-[0.98]"',
    );
  return next;
}, 'Corridas mobile: revisão reduz rolagem excessiva sem remover informações');

requireMarkers(review, [
  'h-[100dvh] min-h-0 flex-col overflow-hidden',
  'overscroll-contain px-4 py-4',
  'pb-[max(64px,env(safe-area-inset-bottom))]',
  'h-14 w-full rounded-2xl',
], 'revisão compacta e CTA fora da navegação do Android');

console.log('[OK] APOIS_CORRIDAS_MOBILE_PROPORTIONS_V1: pagamento, Home, revisão e procura de motorista ajustados para telas móveis.');
