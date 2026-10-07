import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

let failed = false;
const fail = (message) => { failed = true; console.error('[FAIL] ' + message); };
const ok = (message) => console.log('[OK] ' + message);

function source(path) {
  const full = resolve(path);
  if (!existsSync(full)) {
    fail('arquivo ausente: ' + path);
    return '';
  }
  return readFileSync(full, 'utf8');
}

function requireAll(path, markers, label) {
  const text = source(path);
  if (!text) return;
  const missing = markers.filter((marker) => !text.includes(marker));
  if (missing.length) fail(label + ': ' + missing.join(' | '));
  else ok(label);
}

function forbidAll(path, markers, label) {
  const text = source(path);
  if (!text) return;
  const found = markers.filter((marker) => text.includes(marker));
  if (found.length) fail(label + ': ' + found.join(' | '));
  else ok(label);
}

// Corridas cliente — os bugs encontrados em aparelho físico precisam ficar
// protegidos por gates duráveis, não somente por inspeção visual manual.
requireAll('scripts/harden-corridas-mobile-proportions.mjs', [
  'APOIS_CORRIDAS_MOBILE_PROPORTIONS_V1',
  'z-[140]',
  'max-h-[78dvh]',
  'overflow-y-auto overscroll-contain',
  'touch-pan-y',
  'pb-[max(52px,env(safe-area-inset-bottom))]',
  'max-h-[46dvh]',
  'status !== "procurar_motorista" ? <RideStatusHeader',
  'max-h-[52dvh]',
  'h-[100dvh] min-h-0 flex-col overflow-hidden',
  'pb-[max(64px,env(safe-area-inset-bottom))]',
], 'Corridas protege pagamento, revisão, Home e busca de motorista em telas Android');

requireAll('scripts/fix-corridas-superapp-ui.mjs', [
  'pathname === "/buscar-destino"',
  'pathname === "/revisar-solicitacao"',
  'pathname.startsWith("/corrida/")',
  'pb-[max(44px,env(safe-area-inset-bottom))]',
], 'Corridas esconde rodapé nas jornadas fullscreen e preserva barra Android');

requireAll('scripts/harden-superapp-module-mobile-ui.mjs', [
  "await import('./harden-corridas-final-red-surfaces.mjs');",
  "await import('./harden-corridas-final-shell-surfaces.mjs');",
  "await import('./harden-corridas-mobile-proportions.mjs');",
], 'Corridas aplica proporções móveis depois do acabamento visual final');

// Entregas cliente — bottom nav fixa precisa considerar aparelho com navegação
// Android de três botões mesmo quando env(safe-area-inset-bottom) retorna zero.
requireAll('scripts/harden-entregas-superapp-auth-runtime.mjs', [
  '<nav className="fixed bottom-0',
  'min-h-[88px]',
  'pb-[max(44px,env(safe-area-inset-bottom))]',
  'pb-32 pt-5',
  'pb-32 pt-2',
], 'Entregas mantém rodapé e conteúdo fora da barra de navegação Android');

requireAll('scripts/harden-entregas-superapp-checkout-mobile-ui.mjs', [
  'min-h-dvh',
  'overflow-y-auto',
  'pb-[max(env(safe-area-inset-bottom),1.25rem)]',
  'pt-[max(env(safe-area-inset-top),1rem)]',
], 'Checkout Entregas é rolável e respeita viewport/safe-area');

requireAll('scripts/harden-entregas-superapp-secondary-mobile-ui.mjs', [
  '<AppBottomNav activeTab="perfil" />',
  'pb-32',
  'bottom-[calc(7rem+env(safe-area-inset-bottom))]',
], 'Telas secundárias Entregas reservam espaço para navegação e ações');

// Parceiro Motorista.
requireAll('scripts/harden-partner-motorista-navigation.mjs', [
  'paddingBottom: "max(env(safe-area-inset-bottom), 44px)"',
  'min-h-[82px]',
  'min-h-[60px]',
], 'Motorista protege navegação inferior em Android com três botões');

// Parceiro Entregador.
requireAll('scripts/harden-partner-entregador-touch-safearea.mjs', [
  'pb-[max(44px,env(safe-area-inset-bottom))]',
  'min-h-[82px]',
  'data-[active-job=true]:pb-[max(env(safe-area-inset-bottom),1.25rem)]',
], 'Entregador protege rodapé e entrega ativa contra sobreposição');

// Shells precisam rolar em telas baixas em vez de prender CTA fora da viewport.
requireAll('scripts/harden-superapp-shell-mobile-ui.mjs', [
  'min-height:100dvh',
  'overflow-x:hidden;overflow-y:auto',
], 'Shell Cliente continua utilizável em telas baixas');

requireAll('scripts/harden-partner-shell-mobile-ui.mjs', [
  'min-height:100dvh',
  'overflow-x:hidden;overflow-y:auto',
  '@media(max-height:700px)',
], 'Shell Parceiro continua utilizável em telas baixas');

forbidAll('scripts/harden-corridas-mobile-proportions.mjs', [
  'z-[70] flex items-end justify-center',
  'pb-[max(16px,env(safe-area-inset-bottom))] pt-4 shadow',
], 'Corridas não reintroduz overlay de pagamento abaixo do rodapé ou sem fallback Android');

if (!failed) console.log('[OK] Mobile critical flows v25: Cliente Corridas, Cliente Entregas, Motorista, Entregador e shells protegidos contra os regressos móveis observados.');
process.exit(failed ? 1 : 0);
