import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

let failed = false;
function read(path) {
  const full = resolve(path);
  if (!existsSync(full)) {
    console.error(`[FAIL] Mobile UI v16: arquivo ausente ${path}`);
    failed = true;
    return '';
  }
  return readFileSync(full, 'utf8');
}
function requireAll(path, markers, label) {
  const source = read(path);
  if (!source) return;
  const missing = markers.filter((marker) => !source.includes(marker));
  if (missing.length) { console.error(`[FAIL] ${label}: ${missing.join(' | ')}`); failed = true; }
  else console.log(`[OK] ${label}`);
}
function forbidAll(path, markers, label) {
  const source = read(path);
  if (!source) return;
  const found = markers.filter((marker) => source.includes(marker));
  if (found.length) { console.error(`[FAIL] ${label}: ${found.join(' | ')}`); failed = true; }
  else console.log(`[OK] ${label}`);
}

requireAll('scripts/harden-superapp-shell-mobile-ui.mjs', [
  'overflow-x:hidden;overflow-y:auto',
  'object-fit:contain;padding:6px',
  '@media(max-height:720px)',
], 'Seletor Cliente adapta conteúdo e marca a aparelhos baixos');

requireAll('scripts/harden-partner-shell-mobile-ui.mjs', [
  'overflow-x:hidden;overflow-y:auto',
  '@media(max-height:700px)',
  '@media(max-width:360px)',
], 'Seletor Parceiro mantém rolagem e breakpoints móveis');

requireAll('scripts/fix-corridas-superapp-ui.mjs', [
  'src/components/BottomNavigation.tsx',
  'grid-cols-5',
  'min-h-[64px]',
  'hideBottomNavigation',
  'pathname === "/buscar-destino"',
  'pathname.startsWith("/corrida/")',
  'src/routes/_authenticated.perfil.tsx',
], 'Corridas usa rodapé real, seguro e oculto nas jornadas fullscreen');
forbidAll('scripts/fix-corridas-superapp-ui.mjs', [
  'AppShell.tsx',
  'PassengerProfileCenter.tsx',
  'native-password-recovery.ts',
], 'Corridas não audita componentes removidos do pin atual');

requireAll('scripts/harden-corridas-superapp-profile-ui.mjs', [
  'src/routes/_authenticated.perfil.tsx',
  'min-h-[68px]',
  'env(safe-area-inset-top)',
], 'Perfil Passageiro usa rota real, alvos tocáveis e safe area');

requireAll('scripts/harden-corridas-kit-visual.mjs', [
  'APOIS_VISUAL_KIT_V1',
  'apois-kit-home-panel',
  '<HomeWorkShortcuts />',
  'apois-kit-search-results',
  'max-h-[94dvh]',
  'max(16px, env(safe-area-inset-bottom))',
  'grid-cols-[58px_minmax(0,1fr)_auto]',
], 'Corridas aplica kit visual à Home, busca, BottomSheet e categorias');

requireAll('scripts/harden-superapp-module-mobile-ui.mjs', [
  'src/components/BottomNavigation.tsx',
  'mobile-ui/base-complete',
  'pt-[max(env(safe-area-inset-top),0.75rem)]',
  'min-h-[88px]',
  'pb-[max(env(safe-area-inset-bottom),1.25rem)]',
  "await import('./harden-entregas-superapp-cart-mobile-ui.mjs')",
  "await import('./harden-entregas-superapp-viewport.mjs')",
], 'Hardener móvel cobre Corridas atual e Entregas');

requireAll('scripts/harden-entregas-superapp-secondary-mobile-ui.mjs', [
  'addProfileBottomNav',
  '<AppBottomNav activeTab="perfil" />',
  'Forma disponível',
  'O Pix é apresentado automaticamente',
  'pb-32',
], 'Entregas mantém navegação secundária e pagamento disponível explícito');

requireAll('scripts/harden-entregas-superapp-cart-mobile-ui.mjs', [
  'min-h-dvh',
  'grid h-11 w-11 place-items-center rounded-xl',
  'grid h-10 w-10 place-items-center rounded-xl bg-zinc-800',
], 'Sacola Entregas usa controles tocáveis');

requireAll('scripts/harden-entregas-superapp-checkout-mobile-ui.mjs', [
  'grid h-11 w-11 shrink-0 place-items-center',
  'pb-[max(env(safe-area-inset-bottom),1.25rem)]',
  'touchRoutes',
], 'Checkout Entregas respeita toque e safe area');

requireAll('scripts/harden-entregas-superapp-viewport.mjs', [
  "'src/routes/checkout.tsx'",
  "'src/routes/sacola.tsx'",
  "'src/routes/login.tsx'",
  ".replaceAll('h-screen', 'h-dvh')",
], 'Viewport Entregas cobre autenticação e compra');

requireAll('.apois/modules.json', [
  'node scripts/harden-superapp-module-mobile-ui.mjs corridas',
  'node scripts/harden-corridas-superapp-profile-ui.mjs',
  'node scripts/harden-corridas-profile-actions.mjs',
  'node scripts/harden-corridas-password-recovery.mjs',
  'node scripts/harden-corridas-kit-visual.mjs',
  'APOIS_VISUAL_KIT_V1',
  'node scripts/harden-entregas-superapp-checkout-mobile-ui.mjs',
  'node scripts/harden-superapp-module-mobile-ui.mjs entregas',
], 'Hardening visual roda antes dos builds reais');

requireAll(
  'superapp/shell/build.mjs',
  [
    "runShellHardener(hardener);",
    "'scripts/harden-superapp-shell-mobile-ui.mjs'",
    "APOIS_SHELL_HTML_PATH: distIndex",
  ],
  'Shell Cliente aplica hardening visual sobre a cópia dist antes de empacotar',
);
requireAll('scripts/harden-partner-shell-startup.mjs', ["import './harden-partner-shell-mobile-ui.mjs';"], 'Shell Parceiro aplica hardening visual no bootstrap');

if (!failed) console.log('[OK] Mobile UI v16: Cliente, Passageiro, Entregas e Parceiro mantêm safe-area, controles tocáveis e navegação consistente.');
process.exit(failed ? 1 : 0);
