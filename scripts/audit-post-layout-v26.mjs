import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

let failed = false;
let warnings = 0;
const fail = (message) => { failed = true; console.error('[FAIL] Post-layout v26: ' + message); };
const ok = (message) => console.log('[OK] Post-layout v26: ' + message);
const warn = (message) => { warnings += 1; console.warn('[WARN] Post-layout v26: ' + message); };

function read(path) {
  const full = resolve(path);
  if (!existsSync(full)) {
    fail('arquivo ausente: ' + path);
    return '';
  }
  return readFileSync(full, 'utf8');
}
function readOptional(path) {
  const full = resolve(path);
  return existsSync(full) ? readFileSync(full, 'utf8') : '';
}
function requireAll(path, markers, label) {
  const source = read(path);
  if (!source) return;
  const missing = markers.filter((marker) => !source.includes(marker));
  if (missing.length) fail(label + ': ' + missing.join(' | '));
  else ok(label);
}

// Cliente / Corridas
requireAll('scripts/harden-corridas-mobile-proportions.mjs', [
  'APOIS_CORRIDAS_MOBILE_PROPORTIONS_V1',
  'z-[120]',
  'z-[110]',
  'max(52px, env(safe-area-inset-bottom))',
  'z-[140]',
  'max-h-[78dvh]',
  'touch-pan-y',
  'max-h-[46dvh]',
  'status !== "procurar_motorista" ? <RideStatusHeader',
  'max-h-[52dvh]',
  'h-[100dvh] min-h-0 flex-col overflow-hidden',
  'pb-[max(64px,env(safe-area-inset-bottom))]',
], 'Corridas protege sheets, pagamento, revisão e corrida ativa');

requireAll('scripts/fix-corridas-superapp-ui.mjs', [
  'pathname === "/buscar-destino"',
  'pathname === "/revisar-solicitacao"',
  'pathname.startsWith("/corrida/")',
  'pb-[max(44px,env(safe-area-inset-bottom))]',
], 'Corridas não deixa rodapé invadir jornadas fullscreen');

requireAll('scripts/harden-superapp-module-mobile-ui.mjs', [
  "await import('./harden-corridas-final-red-surfaces.mjs');",
  "await import('./harden-corridas-final-shell-surfaces.mjs');",
  "await import('./harden-corridas-mobile-proportions.mjs');",
], 'Corridas aplica correções de proporção depois do acabamento visual');

// Cliente / Entregas
const modulesManifest = read('.apois/modules.json');
if (modulesManifest) {
  const entregasPipelineMarkers = [
    'harden-entregas-overlay-layering.mjs',
    'harden-entregas-superapp-cart-mobile-ui.mjs',
    'harden-entregas-order-finish-mobile-ui.mjs',
    'bun run build:customer',
  ];
  const missing = entregasPipelineMarkers.filter((marker) => !modulesManifest.includes(marker));
  if (missing.length) {
    fail('pipeline Entregas aplica layering e ergonomia antes do build: ' + missing.join(' | '));
  } else {
    const positions = entregasPipelineMarkers.map((marker) => modulesManifest.indexOf(marker));
    const ordered = positions.every((position, index) => index === 0 || position > positions[index - 1]);
    if (!ordered) {
      fail('pipeline Entregas aplica layering e ergonomia antes do build: ordem incorreta');
    } else {
      ok('pipeline Entregas aplica layering e ergonomia antes do build');
    }
  }
}
requireAll('scripts/build-merchant-panel.mjs', [
  "'harden-entregas-overlay-layering.mjs'",
], 'painéis Estabelecimento/Admin também recebem layering seguro de dialogs/sheets');

requireAll('scripts/harden-entregas-overlay-layering.mjs', [
  'APOIS_ENTREGAS_OVERLAY_LAYERING_V1',
  'z-[120]',
  'z-[121]',
  'h-[90dvh]',
  'pb-[max(52px,env(safe-area-inset-bottom))]',
], 'Entregas mantém dialog/sheet acima do rodapé e dentro da viewport');

requireAll('scripts/harden-entregas-superapp-auth-runtime.mjs', [
  '<nav className="fixed bottom-0',
  'min-h-[88px]',
  'pb-[max(44px,env(safe-area-inset-bottom))]',
  'pb-32 pt-5',
  'pb-32 pt-2',
], 'Entregas reserva espaço para rodapé fixo e barra Android');

requireAll('scripts/harden-entregas-superapp-cart-mobile-ui.mjs', [
  'min-h-dvh',
  'pb-[max(52px,env(safe-area-inset-bottom))]',
], 'Sacola Entregas mantém CTA fora da navegação do sistema');

requireAll('scripts/harden-entregas-order-finish-mobile-ui.mjs', [
  "patch('src/routes/pedido/confirmado.tsx'",
  "patch('src/routes/pedido/$orderId/avaliar.tsx'",
  'pb-[max(52px,env(safe-area-inset-bottom))]',
], 'Telas finais de pedido preservam CTAs em celulares com três botões');

// Parceiro / Motorista
requireAll('scripts/harden-partner-motorista-navigation.mjs', [
  'paddingBottom: "max(env(safe-area-inset-bottom), 44px)"',
  'min-h-[82px]',
  'min-h-[60px]',
], 'Motorista mantém rodapé acima da barra Android');

requireAll('scripts/harden-partner-motorista-mobile-ui.mjs', [
  'calc(max(44px, env(safe-area-inset-bottom)) + 88px)',
  'max(52px, env(safe-area-inset-bottom))',
  'max(52px, calc(env(safe-area-inset-bottom) + 4px))',
  'max(52px, calc(env(safe-area-inset-bottom) + 16px))',
  'max-h-[calc(100dvh-max(env(safe-area-inset-top),12px))]',
  'overflow-y-auto overscroll-contain',
], 'Motorista protege oferta, corrida ativa, PIN, cancelamento e avaliação');

requireAll('scripts/harden-partner-motorista-payment-policy.mjs', [
  "import './harden-partner-motorista-navigation.mjs';",
  "import './harden-partner-motorista-mobile-ui.mjs';",
], 'pipeline Motorista aplica hardening móvel final');

// Parceiro / Entregador
requireAll('scripts/harden-partner-entregador-touch-safearea.mjs', [
  'pb-[max(44px,env(safe-area-inset-bottom))]',
  'data-[active-job=true]:pb-[max(52px,env(safe-area-inset-bottom))]',
  'src/components/CourierCompletionSupport.tsx',
  'max-h-[calc(100dvh-max(env(safe-area-inset-top),12px))]',
  'pb-[max(52px,env(safe-area-inset-bottom))]',
], 'Entregador protege rodapé, entrega ativa e suporte com teclado');

requireAll('scripts/harden-partner-entregador-map.mjs', [
  "import './harden-partner-entregador-touch-safearea.mjs';",
], 'pipeline Entregador aplica ergonomia/safe-area');

// Selectors
requireAll('scripts/harden-superapp-shell-mobile-ui.mjs', [
  'overflow-x:hidden;overflow-y:auto',
  'max(52px,env(safe-area-inset-bottom))',
  '@media(max-height:760px)',
  '--red:#E51B23',
], 'seletor Cliente permanece rolável, fora da barra Android e na identidade vermelha');

requireAll('scripts/harden-partner-shell-mobile-ui.mjs', [
  'overflow-x:hidden;overflow-y:auto',
  'max(52px,env(safe-area-inset-bottom))',
  '@media(max-height:700px)',
  '@media(max-width:360px)',
], 'seletor Parceiro permanece utilizável em telas baixas/estreitas e fora da barra Android');

// Dívidas funcionais expostas pelo layout novo. Não bloqueiam o build porque
// não foram introduzidas por esta migração visual, mas precisam aparecer na auditoria.
const serviceDetails = readOptional('sources/apois-corridas-passageiro/src/components/pricing/ServiceDetailsForm.tsx');
if (serviceDetails.includes('Form implementation for each category would go here')) {
  warn('Corridas: Detalhes do Serviço de Fretes/Guincho/Envios ainda é placeholder e não possui formulário funcional.');
}

const walletRoute = readOptional('sources/apois-corridas-passageiro/src/routes/_authenticated.carteira.tsx');
if (walletRoute.includes('Sua Carteira') && walletRoute.length < 1200) {
  warn('Corridas: rota Carteira exposta no rodapé ainda é uma tela placeholder.');
}

const ridesRoute = readOptional('sources/apois-corridas-passageiro/src/routes/_authenticated.corridas.tsx');
if (ridesRoute.includes('Suas Corridas') && ridesRoute.length < 1200) {
  warn('Corridas: rota Corridas exposta no rodapé ainda é uma tela placeholder.');
}

requireAll('scripts/harden-corridas-request-timeout.mjs', [
  'APOIS_REQUEST_RIDE_TIMEOUT_V1',
  'REQUEST_RIDE_TIMEOUT_MS = 20_000',
  'Promise.race([',
  'invokeRequestRideWithTimeout(payload)',
  'request_timeout',
], 'Corridas impede envio/cancelamento de corrida de ficar pendente indefinidamente');
requireAll('scripts/build-isolated-module.mjs', [
  'harden-corridas-request-timeout.mjs',
], 'pipeline Corridas aplica timeout antes do build visual');

// Achado de auditoria: o parceiro ainda está explicitamente preso à identidade
// preta/dourada, enquanto Cliente Corridas/Entregas usam vermelho/branco.
const driverTheme = read('scripts/harden-partner-motorista-brand-theme.mjs');
const courierTheme = read('scripts/harden-partner-entregador-theme.mjs');
const partnerShell = read('superapp/partner-shell/index.html');
if (
  driverTheme.includes('identidade preto/dourado') &&
  courierTheme.includes('APOIS_PARTNER_COURIER_GOLD_V1') &&
  partnerShell.includes('--gold:#f6be1c')
) {
  warn('Motorista, Entregador e seletor Parceiro continuam explicitamente preto/dourado. Se a nova identidade vermelho/branco deve valer para todo o ecossistema, esta migração ainda não foi aplicada ao APOIS Parceiro.');
} else {
  ok('Parceiro não está integralmente preso ao tema legado preto/dourado');
}

if (!failed) {
  console.log('[OK] Post-layout v26: auditoria estrutural cobre Cliente Corridas, Cliente Entregas, Motorista, Entregador e os dois seletores.');
  if (warnings) console.warn('[WARN] Post-layout v26: ' + warnings + ' pendência visual não bloqueante encontrada.');
}
process.exit(failed ? 1 : 0);
