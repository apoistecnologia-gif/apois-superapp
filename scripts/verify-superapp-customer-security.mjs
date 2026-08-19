import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

let failed = false;
function read(path) {
  const full = resolve(path);
  if (!existsSync(full)) {
    console.error(`[FAIL] arquivo ausente: ${path}`);
    failed = true;
    return '';
  }
  return readFileSync(full, 'utf8');
}
function requireMarkers(path, markers, label) {
  const source = read(path);
  if (!source) return;
  const missing = markers.filter((marker) => !source.includes(marker));
  if (missing.length) {
    console.error(`[FAIL] ${label}: ${missing.join(' | ')}`);
    failed = true;
  } else console.log(`[OK] ${label}`);
}
function forbidMarkers(path, markers, label) {
  const source = read(path);
  if (!source) return;
  const found = markers.filter((marker) => source.includes(marker));
  if (found.length) {
    console.error(`[FAIL] ${label}: ${found.join(' | ')}`);
    failed = true;
  } else console.log(`[OK] ${label}`);
}

requireMarkers('.work/entregas/src/lib/customer-push.ts', [
  'remove_superapp_customer_push_devices',
  'Não foi possível encerrar o vínculo de notificações deste aparelho.',
  '`#/pedido/${encodeURIComponent(orderId)}`',
  '"#/perfil/notificacoes"',
  'window.location.hash !== target',
], 'Push e logout de Entregas ficam seguros dentro do Superapp');
forbidMarkers('.work/entregas/src/lib/customer-push.ts', [
  ': "/notificacoes";',
  'window.location.pathname !== target',
], 'Push de Entregas não usa rota inexistente nem sai do hash router');

requireMarkers('.work/entregas/src/routes/perfil/index.tsx', [
  'await removeCustomerPushRegistration(true);',
  'Não foi possível sair com segurança. Verifique sua conexão e tente novamente.',
], 'perfil Entregas não encerra sessão silenciosamente com Push antigo');

requireMarkers('.work/entregas/src/routes/perfil/dados-pessoais.tsx', [
  'await removeCustomerPushRegistration(true);',
  '<AppBottomNav activeTab="perfil" />',
  'pb-[calc(env(safe-area-inset-bottom)+7rem)]',
  'Não foi possível desativar sua conta com segurança. Tente novamente.',
], 'Dados Pessoais mantém rodapé, safe area e desativação segura');
forbidMarkers('.work/entregas/src/routes/perfil/dados-pessoais.tsx', [
  'toast.error(error?.message || "Não foi possível salvar as alterações.")',
  'toast.error(error?.message || "Não foi possível desativar sua conta.")',
], 'Dados Pessoais não expõe erros técnicos do backend');

requireMarkers('.work/entregas/src/routes/pedido/$orderId/index.tsx', [
  'relative flex h-screen w-full flex-col overflow-hidden',
  '<AppBottomNav activeTab="pedidos" />',
  'overflow-y-auto p-4 pb-32',
  'Não foi possível cancelar este pedido. Tente novamente.',
], 'detalhes do pedido preservam rodapé ancorado e espaço inferior');
forbidMarkers('.work/entregas/src/routes/pedido/$orderId/index.tsx', [
  'toast.error(error?.message || "Não foi possível cancelar este pedido.")',
], 'cancelamento de pedido não expõe erro técnico do RPC');

requireMarkers('.work/entregas/src/routes/enderecos.tsx', [
  'const setDefaultAddress = async (addressId: string)',
  '"set_default_customer_address"',
  'await setDefaultAddress(selectedAddress.id);',
], 'confirmação de endereço usa RPC atômica do backend');
forbidMarkers('.work/entregas/src/routes/enderecos.tsx', [
  'setDefaultWithFallback',
  'RPC set_default_customer_address failed, using RLS fallback',
  '.update({ is_default: false })',
], 'confirmação de endereço não replica transação do backend no cliente');

for (const [path, label] of [
  ['.work/entregas/src/routes/perfil/pagamentos.tsx', 'Pagamentos'],
  ['.work/entregas/src/routes/perfil/notificacoes.tsx', 'Notificações'],
  ['.work/entregas/src/routes/perfil/legal.tsx', 'Legal'],
  ['.work/entregas/src/routes/perfil/ajuda.tsx', 'Ajuda'],
]) {
  requireMarkers(path, [
    '<AppBottomNav activeTab="perfil" />',
    'pb-32',
  ], `${label} mantém rodapé e espaço inferior`);
}

requireMarkers('.work/entregas/src/routes/perfil/notificacoes.tsx', [
  'pt-[max(env(safe-area-inset-top),1rem)]',
], 'Notificações respeita safe area superior');
requireMarkers('.work/entregas/src/routes/perfil/legal.tsx', [
  'pt-[max(env(safe-area-inset-top),1rem)]',
], 'Legal respeita safe area superior');
requireMarkers('.work/entregas/src/routes/perfil/ajuda.tsx', [
  'pt-[max(env(safe-area-inset-top),1rem)]',
], 'Ajuda respeita safe area superior');
requireMarkers('.work/entregas/src/routes/perfil/pagamentos.tsx', [
  'No momento, os pedidos são pagos somente por PIX.',
  'O pedido só é confirmado depois que',
], 'Pagamentos mantém PIX-only em linguagem simples');
forbidMarkers('.work/entregas/src/routes/perfil/pagamentos.tsx', [
  'provedor de pagamentos integrado',
], 'Pagamentos não exibe detalhe técnico do gateway');

requireMarkers('.work/entregas/src/components/CustomerDeliveryMap.tsx', [
  'Acompanhe seu entregador',
], 'mapa do pedido mantém rastreamento do entregador');
forbidMarkers('.work/entregas/src/components/CustomerDeliveryMap.tsx', [
  'confirmationPin',
  'setConfirmationPin',
  'KeyRound',
], 'mapa não duplica o PIN que já existe nos detalhes do pedido');

requireMarkers('scripts/inject-superapp-push-routing.mjs', [
  "entregasBase + '#/perfil/notificacoes'",
], 'roteamento cruzado de Push abre a central de notificações válida de Entregas');
forbidMarkers('scripts/inject-superapp-push-routing.mjs', [
  "entregasBase + '#/notificacoes'",
], 'roteamento cruzado não aponta para rota inexistente de Entregas');

process.exit(failed ? 1 : 0);
