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
  if (missing.length) {
    console.error(`[FAIL] ${label}: ${missing.join(' | ')}`);
    failed = true;
  } else console.log(`[OK] ${label}`);
}

requireAll('scripts/harden-superapp-shell-mobile-ui.mjs', [
  'overflow-x:hidden;overflow-y:auto',
  'object-fit:contain;padding:6px',
  '@media(max-height:720px)',
  '.service{min-height:265px}',
], 'Seletor Cliente não corta logo/conteúdo em aparelhos baixos');

requireAll('scripts/harden-partner-shell-mobile-ui.mjs', [
  'overflow-x:hidden;overflow-y:auto',
  'object-fit:contain;padding:8px',
  '@media(max-height:700px)',
  '@media(max-width:360px)',
], 'Seletor Parceiro adapta logo, cards e rolagem a telas pequenas');

requireAll('scripts/harden-superapp-module-mobile-ui.mjs', [
  'min-h-[64px]',
  'text-[11px]',
  '<Icon size={24} strokeWidth={2.2} />',
  'pt-[max(env(safe-area-inset-top),0.75rem)]',
  'text-xs font-semibold text-zinc-300',
  'min-h-[88px]',
  'pb-[max(env(safe-area-inset-bottom),1.25rem)]',
  'label: "Meus pedidos"',
  'label: "Favoritos"',
  "await import('./harden-corridas-superapp-profile-ui.mjs')",
  "await import('./harden-entregas-superapp-cart-mobile-ui.mjs')",
  "await import('./harden-entregas-superapp-viewport.mjs')",
  'Perfil remove atalhos duplicados do rodapé',
], 'Módulos Cliente executam hardening dos rodapés, Perfil, Sacola e viewport');

requireAll('scripts/harden-corridas-superapp-profile-ui.mjs', [
  'title="Carteira e pagamentos"',
  'title="Central de notificações"',
  'title="Termos e privacidade"',
  'h-11 w-11',
  'line-clamp-2 text-[11px] leading-4',
  'max-h-[calc(100dvh-max(env(safe-area-inset-top),1rem)-max(env(safe-area-inset-bottom),1rem))]',
], 'Passageiro remove atalhos redundantes do Perfil e ajusta diálogos à viewport');

requireAll('scripts/harden-entregas-superapp-secondary-mobile-ui.mjs', [
  'addProfileBottomNav',
  '<AppBottomNav activeTab="perfil" />',
  'Forma disponível',
  'O Pix é apresentado automaticamente',
  '!source.includes(\'Cartões salvos\')',
  'max-h-[calc(100dvh-max(env(safe-area-inset-top),1rem))]',
  "patch('src/routes/enderecos.tsx'",
  '<AppBottomNav activeTab="inicio" />',
  'bottom-[calc(7rem+env(safe-area-inset-bottom))]',
  'grid h-12 w-12 place-items-center rounded-full',
  '!source.includes(\'window.history.back()\')',
  'pb-32',
], 'Entregas mantém rodapé em Perfil/Endereços/Estabelecimento, evita sobreposição e remove pagamento inexistente');

requireAll('scripts/harden-entregas-superapp-cart-mobile-ui.mjs', [
  'min-h-dvh',
  'grid h-11 w-11 place-items-center rounded-xl',
  'grid h-10 w-10 place-items-center rounded-xl bg-zinc-800',
  'pb-[max(env(safe-area-inset-bottom),1rem)]',
], 'Sacola usa controles de quantidade e exclusão tocáveis em celular');

requireAll('scripts/harden-entregas-superapp-checkout-mobile-ui.mjs', [
  'h-[min(68vw,16rem)]',
  'grid h-11 w-11 shrink-0 place-items-center',
  'break-all font-mono text-[11px]',
  'pb-[max(env(safe-area-inset-bottom),1.25rem)]',
  'pt-[max(env(safe-area-inset-top),1rem)]',
  'touchRoutes',
], 'Checkout Pix e controles secundários de Entregas se adaptam a telas estreitas e toque mínimo');

requireAll('scripts/harden-entregas-superapp-viewport.mjs', [
  "'src/routes/checkout.tsx'",
  "'src/routes/sacola.tsx'",
  "'src/routes/pedido/confirmado.tsx'",
  "'src/routes/enderecos.tsx'",
  "'src/routes/login.tsx'",
  "'src/routes/register.tsx'",
  'checked < 20',
  ".replaceAll('h-screen', 'h-dvh')",
], 'Viewport Entregas cobre autenticação, compra, endereços, pedido e telas principais');

requireAll('scripts/harden-entregas-superapp-delivery-map.mjs', [
  'center={',
  'zoom={14}',
  'h-[clamp(15rem,34dvh,20rem)]',
  "forbidden of ['confirmationPin', 'setConfirmationPin', 'KeyRound', 'defaultCenter=', 'defaultZoom=']",
], 'Mapa de entrega acompanha o entregador e adapta altura à viewport');

requireAll('scripts/harden-partner-motorista-navigation.mjs', [
  'min-h-[82px]',
  'min-h-[60px]',
  'h-9 w-11',
  'h-6 w-6',
  'text-xs font-extrabold',
  'paddingBottom: "max(env(safe-area-inset-bottom), 10px)"',
], 'Motorista usa rodapé maior, legível e afastado da barra de gestos');

requireAll('scripts/harden-partner-entregador-touch-safearea.mjs', [
  "'src/components/CourierPanels.tsx'",
  'label: "Entregas"',
  '<PanelHeader title="Entregas"',
  'min-h-[82px]',
  'min-h-[64px]',
  'h-9 w-11',
  'h-6 w-6',
  'pt-[max(env(safe-area-inset-top),0.65rem)]',
], 'Entregador usa nomenclatura Entregas e rodapé grande com safe-area');

requireAll('.apois/modules.json', [
  'node scripts/harden-superapp-module-mobile-ui.mjs corridas',
  'node scripts/harden-entregas-superapp-checkout-mobile-ui.mjs',
  'node scripts/harden-superapp-module-mobile-ui.mjs entregas',
  'node scripts/harden-entregas-superapp-secondary-mobile-ui.mjs',
], 'Hardening visual principal, checkout e secundário roda antes da compilação real de Corridas e Entregas');

requireAll('superapp/shell/build.mjs', [
  "import '../../scripts/harden-superapp-shell-mobile-ui.mjs';",
], 'Shell Cliente aplica hardening visual antes de copiar para dist');
requireAll('scripts/harden-partner-shell-startup.mjs', [
  "import './harden-partner-shell-mobile-ui.mjs';",
], 'Shell Parceiro aplica hardening visual junto ao bootstrap nativo');

requireAll('scripts/harden-entregas-superapp-auth-runtime.mjs', [
  '<nav className="fixed bottom-0',
  'min-h-[88px]',
  'min-h-[64px] min-w-[72px]',
  'h-8 w-8',
  'text-xs leading-none',
  'pb-32',
], 'Entregas mantém rodapé persistente e conteúdo não fica coberto');

requireAll('scripts/fix-corridas-superapp-ui.mjs', [
  'superappJourneyRoutesWithoutBottomNav',
  '!pathname.startsWith("/corrida/")',
  'aria-label="Navegação inferior"',
  'remove menu lateral que duplicava todas as opções do rodapé',
  'Perfil não repete Carteira e Notificações',
  'Termos e privacidade',
], 'Corridas mantém rodapé único e elimina menu paralelo/atalhos duplicados');

if (!failed) console.log('[OK] Mobile UI v16: seletores, Cliente, Passageiro e Parceiro têm safe-area, mapas responsivos, controles tocáveis, navegação consistente e sem atalhos redundantes.');
process.exit(failed ? 1 : 0);
