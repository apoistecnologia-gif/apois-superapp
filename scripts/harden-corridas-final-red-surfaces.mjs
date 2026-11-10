import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const workspace = process.env.APOIS_CORRIDAS_WORKSPACE || '.work/corridas';

function full(path) {
  return resolve(root, workspace, path);
}

function patch(path, transform, label) {
  const target = full(path);
  if (!existsSync(target)) throw new Error('[FAIL] Corridas final visual: arquivo ausente ' + path);
  const before = readFileSync(target, 'utf8');
  const after = transform(before);
  if (after !== before) writeFileSync(target, after, 'utf8');
  console.log('[OK] Corridas final visual: ' + label + (after === before ? ' (já aplicado)' : ''));
  return after;
}

function replacePairs(source, pairs) {
  let next = source;
  for (const [from, to] of pairs) next = next.replaceAll(from, to);
  return next;
}

function requireMarkers(path, markers) {
  const source = readFileSync(full(path), 'utf8');
  for (const marker of markers) {
    if (!source.includes(marker)) throw new Error('[FAIL] Corridas final visual: ' + path + ' sem ' + marker);
  }
}

patch('src/routes/_authenticated.tsx', (source) => replacePairs(source, [
  ['min-h-[100dvh] bg-zinc-950 flex justify-center selection:bg-yellow-500/30 overflow-hidden', 'min-h-[100dvh] bg-[#EEF1F4] flex justify-center selection:bg-[#E51B23]/20 overflow-hidden'],
  // APOIS_CORRIDAS_AUTH_VIEWPORT_V2: retain full viewport lock while migrating colors.
  ['fixed inset-x-0 top-0 z-0 flex h-[100dvh] justify-center overflow-hidden overscroll-none bg-zinc-950 selection:bg-yellow-500/30', 'fixed inset-x-0 top-0 z-0 flex h-[100dvh] justify-center overflow-hidden overscroll-none bg-[#EEF1F4] selection:bg-[#E51B23]/20'],
  ['relative w-full max-w-[430px] h-[100dvh] bg-black overflow-hidden flex flex-col', 'relative w-full max-w-[430px] h-[100dvh] bg-[#F7F7F8] overflow-hidden flex flex-col'],
]), 'layout autenticado usa base clara');

patch('src/routes/_public.cadastro.tsx', (source) => replacePairs(source, [
  ['flex min-h-screen flex-col overflow-y-auto bg-black p-6 pb-24 pt-8 text-white', 'flex min-h-screen flex-col overflow-y-auto bg-[#F7F7F8] p-6 pb-24 pt-[max(2rem,env(safe-area-inset-top))] text-[#111111]'],
  ['mb-6 inline-flex items-center text-gray-400', 'mb-6 inline-flex min-h-11 items-center text-[#666B73]'],
  ['text-gray-400', 'text-[#666B73]'],
  ['text-gray-300', 'text-[#444A52]'],
  ['text-gray-500', 'text-[#777D85]'],
  ['border-gray-800 bg-[#1e1e1e] text-white', 'border-[#E2E4E8] bg-white text-[#111111]'],
  ['border-gray-800 bg-[#1e1e1e] pr-12 text-white', 'border-[#E2E4E8] bg-white pr-12 text-[#111111]'],
  ['border-gray-800 data-[state=checked]:bg-yellow-500 data-[state=checked]:text-black', 'border-[#D5D8DD] data-[state=checked]:bg-[#E51B23] data-[state=checked]:text-white'],
  ['text-yellow-500', 'text-[#E51B23]'],
  ['bg-[#ffb800] text-base font-black uppercase tracking-widest text-black shadow-lg shadow-[#ffb800]/10', 'bg-[#E51B23] text-base font-black uppercase tracking-widest text-white shadow-lg shadow-[#E51B23]/20'],
]), 'cadastro migra para vermelho/branco');

patch('src/routes/_public.recuperar-senha.tsx', (source) => replacePairs(source, [
  ['flex flex-col min-h-screen bg-black text-white p-6 pt-12', 'flex min-h-screen flex-col bg-[#F7F7F8] p-6 pt-[max(3rem,env(safe-area-inset-top))] text-[#111111]'],
  ['text-gray-400', 'text-[#666B73]'],
  ['text-gray-300', 'text-[#444A52]'],
  ['bg-[#1e1e1e] border-gray-800 text-white', 'bg-white border-[#E2E4E8] text-[#111111]'],
  ['bg-yellow-500 hover:bg-yellow-600 text-black', 'bg-[#E51B23] hover:bg-[#C9141B] text-white'],
  ['bg-yellow-500/20', 'bg-[#FFF1F2]'],
  ['bg-yellow-500 rounded-full', 'bg-[#E51B23] rounded-full'],
  ['text-black font-bold">✓', 'text-white font-bold">✓'],
  ['text-yellow-500 font-bold', 'text-[#E51B23] font-bold'],
]), 'recuperação de senha migra para vermelho/branco');

patch('src/routes/_public.redefinir-senha.tsx', (source) => replacePairs(source, [
  ['items-center justify-center bg-black', 'items-center justify-center bg-[#F7F7F8]'],
  ['animate-spin text-yellow-500', 'animate-spin text-[#E51B23]'],
  ['flex flex-col min-h-screen bg-black text-white p-6 pt-12', 'flex min-h-screen flex-col bg-[#F7F7F8] p-6 pt-[max(3rem,env(safe-area-inset-top))] text-[#111111]'],
  ['text-gray-400', 'text-[#666B73]'],
  ['text-gray-300', 'text-[#444A52]'],
  ['bg-[#1e1e1e] border-gray-800 text-white', 'bg-white border-[#E2E4E8] text-[#111111]'],
  ['bg-yellow-500 hover:bg-yellow-600 text-black', 'bg-[#E51B23] hover:bg-[#C9141B] text-white'],
]), 'redefinição de senha migra para vermelho/branco');

patch('src/routes/_authenticated.buscar-destino.tsx', (source) => replacePairs(source, [
  ['text-lg font-medium text-white placeholder:text-gray-500', 'text-lg font-semibold text-[#111111] caret-[#E51B23] placeholder:text-[#9AA0A8]'],

  ['text-orange-400', 'text-[#E51B23]'],
  ['text-yellow-500', 'text-[#E51B23]'],
  ['border-yellow-500/30', 'border-[#E51B23]/25'],
  ['border-yellow-500', 'border-[#E51B23]'],
  ['focus:border-yellow-500', 'focus:border-[#E51B23]'],
  ['bg-apois-yellow/10', 'bg-[#FFF1F2]'],
  ['text-apois-yellow', 'text-[#E51B23]'],
  ['bg-apois-yellow text-black', 'bg-[#E51B23] text-white'],
  ['bg-apois-yellow', 'bg-[#E51B23]'],
]), 'busca remove acentos amarelo/laranja restantes');

patch('src/components/coupons/CouponInput.tsx', (source) => replacePairs(source, [
  ['bg-zinc-900/50 rounded-2xl p-4 border border-white/5', 'bg-white rounded-2xl p-4 border border-[#E2E4E8]'],
  ['text-zinc-400', 'text-[#555B63]'],
  ['text-zinc-500', 'text-[#666B73]'],
  ['text-zinc-600', 'text-[#8A9098]'],
  ['bg-zinc-800 border-none', 'bg-[#F7F7F8] border border-[#E2E4E8]'],
  ['focus:ring-apois-yellow/50', 'focus:ring-[#E51B23]/40'],
  ['bg-zinc-800 hover:bg-zinc-700 text-zinc-300', 'bg-[#FFF1F2] hover:bg-[#FFE4E6] text-[#E51B23]'],
]), 'cupom acompanha painel claro');

patch('src/components/pricing/FareDetails.tsx', (source) => replacePairs(source, [
  ['bg-zinc-900/50 p-4 rounded-2xl border border-white/5', 'bg-white p-4 rounded-2xl border border-[#E2E4E8]'],
  ['text-zinc-400', 'text-[#666B73]'],
  ['text-apois-yellow', 'text-[#E51B23]'],
]), 'estimativa de tarifa acompanha painel claro');

patch('src/components/pricing/CheckoutSummary.tsx', (source) => replacePairs(source, [
  ['text-zinc-500', 'text-[#666B73]'],
  ['text-zinc-300', 'text-[#33383F]'],
  ['text-zinc-600', 'text-[#777D85]'],
]), 'resumo do checkout usa tipografia clara');

patch('src/components/pricing/ServiceDetailsForm.tsx', (source) => replacePairs(source, [
  ['text-zinc-500', 'text-[#666B73]'],
  ['bg-zinc-900/50 rounded-2xl p-4 border border-white/5', 'bg-white rounded-2xl p-4 border border-[#E2E4E8]'],
  ['text-zinc-400', 'text-[#555B63]'],
]), 'detalhes de serviço acompanham painel claro');

patch('src/components/rides/RideStopsInput.tsx', (source) => replacePairs(source, [
  ['text-apois-yellow', 'text-[#E51B23]'],
  ['bg-apois-yellow/10', 'bg-[#FFF1F2]'],
  ['border-apois-yellow/20', 'border-[#E51B23]/20'],
  ['border-zinc-700', 'border-[#D5D8DD]'],
  ['bg-zinc-900/50', 'bg-white'],
  ['bg-zinc-900', 'bg-[#F1F2F4]'],
  ['bg-zinc-800', 'bg-white'],
  ['border-white/10', 'border-[#E2E4E8]'],
  ['border-white/5', 'border-[#E2E4E8]'],
  ['text-zinc-300', 'text-[#33383F]'],
  ['text-zinc-400', 'text-[#555B63]'],
  ['text-zinc-500', 'text-[#666B73]'],
  ['text-zinc-600', 'text-[#8A9098]'],
  ['text-white', 'text-[#111111]'],
  ['border-yellow-500/30', 'border-[#E51B23]/25'],
  ['text-yellow-500', 'text-[#E51B23]'],
]), 'paradas intermediárias acompanham painel claro');

patch('src/components/route/RouteSummary.tsx', (source) => replacePairs(source, [
  ['bg-[#1e1e1e]/95', 'bg-white/95'],
  ['border-white/5', 'border-[#E2E4E8]'],
  ['bg-zinc-800', 'bg-[#F1F2F4]'],
  ['text-yellow-500', 'text-[#E51B23]'],
  ['bg-yellow-500/10', 'bg-[#FFF1F2]'],
  ['border-yellow-500/20', 'border-[#E51B23]/20'],
  ['text-white', 'text-[#111111]'],
  ['hover:text-white', 'hover:text-[#111111]'],
  ['bg-white/5', 'bg-[#F7F7F8]'],
]), 'resumo de rota acompanha identidade clara');

patch('src/components/location/LocationStatus.tsx', (source) => replacePairs(source, [
  ['bg-zinc-900 border border-white/5', 'bg-white border border-[#E2E4E8]'],
  ['text-zinc-300', 'text-[#33383F]'],
  ['text-zinc-400', 'text-[#555B63]'],
  ['text-apois-yellow', 'text-[#E51B23]'],
  ['bg-apois-yellow text-black', 'bg-[#E51B23] text-white'],
  ['bg-zinc-800 text-white', 'bg-[#F1F2F4] text-[#111111]'],
  ['text-yellow-500', 'text-amber-500'],
]), 'estado de localização usa cards claros');

patch('src/components/payments/PaymentMethodSelector.tsx', (source) => replacePairs(source, [
  ['bg-zinc-900/50 border border-white/5', 'bg-white border border-[#E2E4E8]'],
  ['bg-zinc-800 flex items-center justify-center text-zinc-400', 'bg-[#FFF1F2] flex items-center justify-center text-[#E51B23]'],
  ['text-zinc-500', 'text-[#666B73]'],
  ['text-zinc-600', 'text-[#8A9098]'],
  ['text-white', 'text-[#111111]'],
  ['w-full max-w-lg bg-black rounded-t-[32px] p-6 shadow-2xl animate-in slide-in-from-bottom duration-300 border-t border-zinc-800', 'w-full max-w-lg bg-white rounded-t-[32px] p-6 shadow-2xl animate-in slide-in-from-bottom duration-300 border-t border-[#E2E4E8]'],
  ['bg-zinc-800 border-apois-yellow', 'bg-[#FFF1F2] border-[#E51B23]'],
  ['bg-zinc-900/50 border-transparent', 'bg-white border-[#E2E4E8]'],
  ['bg-apois-yellow text-black', 'bg-[#E51B23] text-white'],
  ['bg-zinc-800 text-zinc-400', 'bg-[#F1F2F4] text-[#666B73]'],
  ['text-apois-yellow', 'text-[#E51B23]'],
]), 'seletor de pagamento usa cards claros');

patch('src/routes/_authenticated.notificacoes.tsx', (source) => replacePairs(source, [
  ['min-h-screen bg-black px-5 pb-24 pt-8 text-white', 'min-h-screen bg-[#F7F7F8] px-5 pb-24 pt-[max(2rem,env(safe-area-inset-top))] text-[#111111]'],
  ['border border-white/10 bg-zinc-900', 'border border-[#E2E4E8] bg-white'],
  ['border-apois-yellow/20 bg-apois-yellow/10', 'border-[#E51B23]/20 bg-[#FFF1F2]'],
  ['text-apois-yellow', 'text-[#E51B23]'],
  ['bg-apois-yellow px-5 py-3 text-sm font-black text-black', 'bg-[#E51B23] px-5 py-3 text-sm font-black text-white'],
  ['bg-zinc-900', 'bg-[#F1F2F4]'],
  ['border-white/5 bg-zinc-950', 'border-[#E2E4E8] bg-white'],
  ['bg-apois-yellow', 'bg-[#E51B23]'],
  ['bg-zinc-700', 'bg-[#C9CDD3]'],
  ['text-sm font-black text-white', 'text-sm font-black text-[#111111]'],
  ['text-zinc-400', 'text-[#555B63]'],
  ['text-zinc-500', 'text-[#666B73]'],
  ['text-zinc-600', 'text-[#777D85]'],
  ['text-zinc-700', 'text-[#9AA0A8]'],
]), 'central de notificações usa identidade clara');

patch('src/components/notifications/PushStatusCard.tsx', (source) => replacePairs(source, [
  ['text-apois-yellow', 'text-[#E51B23]'],
  ['text-zinc-400', 'text-[#666B73]'],
  ['border border-white/10 bg-zinc-900/70', 'border border-[#E2E4E8] bg-white'],
]), 'status de push usa card claro');

patch('src/routes/_authenticated.revisar-solicitacao.tsx', (source) => replacePairs(source, [
  ['flex flex-col min-h-screen bg-black text-white pb-safe', 'flex min-h-screen flex-col bg-[#F7F7F8] text-[#111111] pb-safe'],
  ['border-b border-white/5 bg-zinc-900/50', 'border-b border-[#E2E4E8] bg-white'],
  ['bg-zinc-900/50 rounded-2xl', 'bg-white rounded-2xl'],
  ['border border-white/5', 'border border-[#E2E4E8]'],
  ['bg-zinc-800/50', 'bg-[#F7F7F8]'],
  ['text-3xl font-black text-white', 'text-3xl font-black text-[#111111]'],
  ['text-zinc-300', 'text-[#33383F]'],
  ['text-zinc-400', 'text-[#555B63]'],
  ['text-zinc-500', 'text-[#666B73]'],
  ['bg-zinc-800 text-zinc-500 grayscale cursor-not-allowed', 'bg-[#E6E8EB] text-[#9AA0A8] cursor-not-allowed'],
  ['px-5 py-6 bg-zinc-900/80 backdrop-blur-xl border-t border-white/5', 'px-5 py-6 bg-white/95 backdrop-blur-xl border-t border-[#E2E4E8]'],
  ['bg-apois-yellow text-black shadow-lg shadow-apois-yellow/10', 'bg-[#E51B23] text-white shadow-lg shadow-[#E51B23]/20'],
  ['text-apois-yellow', 'text-[#E51B23]'],
  ['bg-apois-yellow', 'bg-[#E51B23]'],
]), 'revisão da solicitação usa painel claro e CTA vermelho');

patch('src/routes/_authenticated.corrida.$rideId.tsx', (source) => replacePairs(source, [
  ['space-y-6 bg-black p-6', 'space-y-6 bg-[#F7F7F8] p-6'],
  ['rounded-full bg-zinc-900', 'rounded-full bg-[#E6E8EB]'],
  ['w-32 bg-zinc-900', 'w-32 bg-[#E6E8EB]'],
  ['rounded-2xl bg-zinc-900', 'rounded-2xl bg-[#E6E8EB]'],
  ['rounded-3xl bg-zinc-900', 'rounded-3xl bg-[#E6E8EB]'],
  ['justify-center space-y-6 bg-black p-8 text-center', 'justify-center space-y-6 bg-[#F7F7F8] p-8 text-center'],
  ['rounded-full bg-zinc-900">', 'rounded-full bg-[#F1F2F4]">'],
  ['text-xl font-black text-white', 'text-xl font-black text-[#111111]'],
  ['rounded-2xl bg-apois-yellow font-black text-black', 'rounded-2xl bg-[#E51B23] font-black text-white'],
  ['relative flex h-[100dvh] flex-col overflow-hidden bg-black', 'relative flex h-[100dvh] flex-col overflow-hidden bg-[#F7F7F8]'],
  ['rounded-t-[32px] border-t border-white/5 bg-zinc-950 px-6 pb-8 pt-6 shadow-[0_-8px_32px_rgba(0,0,0,0.5)]', 'rounded-t-[32px] border-t border-[#E2E4E8] bg-white px-6 pb-8 pt-6 shadow-[0_-12px_34px_rgba(17,17,17,0.12)]'],
  ['border border-white/5 bg-zinc-900/50', 'border border-[#E2E4E8] bg-white'],
  ['border-apois-yellow/20 border-t-apois-yellow', 'border-[#E51B23]/20 border-t-[#E51B23]'],
  ['text-apois-yellow', 'text-[#E51B23]'],
  ['font-black text-white', 'font-black text-[#111111]'],
  ['text-zinc-500', 'text-[#666B73]'],
  ['text-zinc-600', 'text-[#777D85]'],
  ['text-sm font-black uppercase tracking-tighter text-white', 'text-sm font-black uppercase tracking-tighter text-[#111111]'],
]), 'corrida ativa mantém mapa e usa bottom sheet claro');

patch('src/components/rides/active/DriverCard.tsx', (source) => replacePairs(source, [
  ['bg-zinc-900/50 rounded-2xl p-4 border border-white/5', 'bg-white rounded-2xl p-4 border border-[#E2E4E8] shadow-sm'],
  ['bg-zinc-800 border border-white/10', 'bg-[#F1F2F4] border border-[#E2E4E8]'],
  ['text-zinc-600', 'text-[#8A9098]'],
  ['text-zinc-500', 'text-[#666B73]'],
  ['text-white', 'text-[#111111]'],
  ['text-apois-yellow', 'text-[#E51B23]'],
  ['bg-apois-yellow', 'bg-[#E51B23]'],
  ['<Phone className="text-black"', '<Phone className="text-white"'],
]), 'card do motorista usa vermelho/branco');

patch('src/components/rides/active/VehicleCard.tsx', (source) => replacePairs(source, [
  ['bg-zinc-900/50 rounded-2xl p-4 border border-white/5', 'bg-white rounded-2xl p-4 border border-[#E2E4E8] shadow-sm'],
  ['bg-zinc-800 flex items-center justify-center text-zinc-500', 'bg-[#F1F2F4] flex items-center justify-center text-[#666B73]'],
  ['text-zinc-500', 'text-[#666B73]'],
  ['text-white', 'text-[#111111]'],
]), 'card do veículo usa superfície clara');

patch('src/components/rides/active/RideStopsTimeline.tsx', (source) => replacePairs(source, [
  ['bg-zinc-900/30 rounded-2xl p-4 border border-white/5', 'bg-white rounded-2xl p-4 border border-[#E2E4E8] shadow-sm'],
  ['bg-apois-yellow', 'bg-[#E51B23]'],
  ['rgba(255,184,0,0.4)', 'rgba(229,27,35,0.28)'],
  ['bg-zinc-800', 'bg-[#D5D8DD]'],
  ['border-zinc-600 bg-zinc-900', 'border-[#C9CDD3] bg-white'],
  ['text-zinc-300', 'text-[#33383F]'],
  ['text-zinc-600', 'text-[#777D85]'],
]), 'linha da corrida usa superfície clara');

patch('src/components/rides/active/SecurityCodeCard.tsx', (source) => replacePairs(source, [
  ['bg-zinc-900/50 rounded-2xl p-4 border border-white/5', 'bg-white rounded-2xl p-4 border border-[#E2E4E8] shadow-sm'],
  ['text-zinc-500', 'text-[#666B73]'],
  ['text-zinc-600', 'text-[#8A9098]'],
  ['bg-black/40 rounded-xl p-4 border border-white/5', 'bg-[#F7F7F8] rounded-xl p-4 border border-[#E2E4E8]'],
  ['bg-zinc-800 rounded-lg flex items-center justify-center border border-white/5', 'bg-white rounded-lg flex items-center justify-center border border-[#E51B23]/20'],
  ['text-2xl font-black text-white', 'text-2xl font-black text-[#111111]'],
  ['text-white font-bold', 'text-[#111111] font-bold'],
]), 'PIN de segurança usa card claro');

patch('src/components/rides/active/RideStatusHeader.tsx', (source) => replacePairs(source, [
  ['text-apois-yellow', 'text-[#E51B23]'],
  ['bg-apois-yellow/10 border-apois-yellow/20', 'bg-[#FFF1F2] border-[#E51B23]/20'],
  ['bg-zinc-800 border-white/5', 'bg-white border-[#E2E4E8]'],
  ['rounded-full bg-black/20', 'rounded-full bg-white/70'],
  ['text-lg font-black leading-tight text-white', 'text-lg font-black leading-tight text-[#111111]'],
  ['text-xs font-medium text-zinc-400', 'text-xs font-medium text-[#555B63]'],
  ['bg-apois-yellow', 'bg-[#E51B23]'],
]), 'status da corrida usa tipografia clara sem remover cores semânticas');

patch('src/components/rides/active/CancellationDialog.tsx', (source) => replacePairs(source, [
  ['bg-zinc-950 border-white/10 text-white', 'bg-white border-[#E2E4E8] text-[#111111]'],
  ['text-zinc-400', 'text-[#555B63]'],
  ['bg-zinc-900 rounded-2xl border border-white/5', 'bg-[#F7F7F8] rounded-2xl border border-[#E2E4E8]'],
  ['text-apois-yellow', 'text-amber-500'],
  ['text-zinc-500', 'text-[#666B73]'],
]), 'diálogo de cancelamento usa card claro');

for (const path of ['src/routes/_authenticated.carteira.tsx', 'src/routes/_authenticated.corridas.tsx']) {
  patch(path, (source) => replacePairs(source, [
    ['<div className="p-6 text-white">', '<div className="min-h-full bg-[#F7F7F8] p-6 text-[#111111]">'],
  ]), path.includes('carteira') ? 'placeholder Carteira permanece legível' : 'placeholder Corridas permanece legível');
}

requireMarkers('src/routes/_authenticated.tsx', ['bg-[#F7F7F8]', 'selection:bg-[#E51B23]/20']);
requireMarkers('src/routes/_public.cadastro.tsx', ['bg-[#F7F7F8]', 'bg-[#E51B23]', 'text-white']);
requireMarkers('src/routes/_authenticated.notificacoes.tsx', ['bg-[#F7F7F8]', 'bg-[#FFF1F2]', 'bg-white']);
requireMarkers('src/routes/_authenticated.revisar-solicitacao.tsx', ['bg-[#F7F7F8]', 'bg-[#E51B23] text-white']);
requireMarkers('src/components/payments/PaymentMethodSelector.tsx', ['bg-white', 'border-[#E51B23]']);
requireMarkers('src/routes/_authenticated.corrida.$rideId.tsx', ['bg-white', 'border-[#E2E4E8]']);
requireMarkers('src/components/rides/active/DriverCard.tsx', ['bg-white', 'bg-[#E51B23]']);

console.log('[OK] APOIS_CORRIDAS_FINAL_RED_SURFACES_V1: superfícies finais do Passageiro normalizadas sem tocar Maps/GPS/Places, autenticação ou regras de negócio.');
