import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

let failed = false;
const read = (path) => {
  const full = resolve(path);
  if (!existsSync(full)) {
    console.error(`[FAIL] arquivo ausente: ${path}`);
    failed = true;
    return '';
  }
  return readFileSync(full, 'utf8');
};
const requireMarkers = (path, markers, label) => {
  const source = read(path);
  if (!source) return;
  const missing = markers.filter((marker) => !source.includes(marker));
  if (missing.length) {
    console.error(`[FAIL] ${label}: ${missing.join(' | ')}`);
    failed = true;
  } else console.log(`[OK] ${label}`);
};
const forbidMarkers = (path, markers, label) => {
  const source = read(path);
  if (!source) return;
  const found = markers.filter((marker) => source.includes(marker));
  if (found.length) {
    console.error(`[FAIL] ${label}: ${found.join(' | ')}`);
    failed = true;
  } else console.log(`[OK] ${label}`);
};

requireMarkers('.work/entregas/src/lib/customer-push.ts', [
  'remove_superapp_customer_push_devices',
  'Não foi possível encerrar o vínculo de notificações deste aparelho.',
  '`#/pedido/${encodeURIComponent(orderId)}`',
  '"#/notificacoes"',
  'window.location.hash !== target',
], 'Push Entregas abre pedido/feed e preserva registro compartilhado');
forbidMarkers('.work/entregas/src/lib/customer-push.ts', [
  '"#/perfil/notificacoes"',
  'PushNotifications.unregister()',
  'window.location.pathname !== target',
], 'Push Entregas não abre preferências nem invalida FCM compartilhado');

requireMarkers('scripts/inject-superapp-push-routing.mjs', [
  "entregasBase + '#/notificacoes'",
  "entregasBase + '#/pedido/'",
  'if (delivery.isDelivery && ride.isRide) return null;',
], 'bridge global envia Push de Entregas para feed/pedido correto');
forbidMarkers('scripts/inject-superapp-push-routing.mjs', [
  "entregasBase + '#/perfil/notificacoes'",
], 'bridge global não confunde feed com preferências');

requireMarkers('.work/entregas/src/routes/notificacoes.tsx', [
  '<AppBottomNav activeTab="perfil" />',
  'pt-[max(env(safe-area-inset-top),1rem)]',
  'overflow-y-auto p-4 pb-32',
  'onClick={() => void navigate({ to: "/inicio", replace: true })}',
  'get_my_notification_feed',
  'read_my_notification',
  'read_all_my_notifications',
], 'central de notificações está acessível, navegável e pronta para Push');
forbidMarkers('.work/entregas/src/routes/notificacoes.tsx', [
  'window.history.back()',
], 'central de notificações não depende do histórico físico do WebView');

requireMarkers('.work/entregas/src/routes/perfil/index.tsx', [
  'await removeCustomerPushRegistration(true);',
  'Não foi possível sair com segurança. Verifique sua conexão e tente novamente.',
  '{ icon: Bell, label: "Central de notificações", path: "/notificacoes" }',
  '{ icon: Bell, label: "Preferências de notificações", path: "/perfil/notificacoes" }',
], 'perfil separa feed de preferências e mantém logout seguro');

requireMarkers('.work/entregas/src/routes/perfil/dados-pessoais.tsx', [
  'await removeCustomerPushRegistration(true);',
  '<AppBottomNav activeTab="perfil" />',
  'pb-[calc(env(safe-area-inset-bottom)+9rem)]',
  'request_own_account_deletion',
  'Solicitar exclusão da conta',
  'Não foi possível solicitar a exclusão da conta. Tente novamente.',
], 'Dados Pessoais mantém rodapé, safe area e solicitação de exclusão');
forbidMarkers('.work/entregas/src/routes/perfil/dados-pessoais.tsx', [
  'toast.error(error?.message || "Não foi possível salvar as alterações.")',
  'toast.error(error?.message || "Não foi possível desativar sua conta.")',
  'deactivate_own_account',
  'Desativar conta',
], 'Dados Pessoais não expõe erro técnico nem mantém simples desativação no cliente');

requireMarkers('supabase/migrations/20260819143000_account_deletion_requests.sql', [
  'account_deletion_requests',
  'request_own_account_deletion',
  'revoke all on function public.request_own_account_deletion() from public, anon',
  'grant execute on function public.request_own_account_deletion() to authenticated, service_role',
], 'backend versiona solicitação de exclusão com privilégio mínimo');

requireMarkers('.work/entregas/src/routes/pedido/$orderId/index.tsx', [
  'relative flex h-dvh w-full flex-col overflow-hidden',
  '<AppBottomNav activeTab="pedidos" />',
  'overflow-y-auto p-4 pb-32',
  'Não foi possível cancelar este pedido. Tente novamente.',
], 'detalhes do pedido preservam rodapé, espaço inferior, viewport dinâmica e erro seguro');
forbidMarkers('.work/entregas/src/routes/pedido/$orderId/index.tsx', [
  'toast.error(error?.message || "Não foi possível cancelar este pedido.")',
], 'cancelamento de pedido não expõe erro técnico do RPC');

requireMarkers('.work/entregas/src/routes/enderecos.tsx', [
  'const setDefaultAddress = async (addressId: string)',
  '"set_default_customer_address"',
  'await setDefaultAddress(selectedAddress.id);',
  'pt-[max(env(safe-area-inset-top),1rem)]',
], 'confirmação de endereço usa RPC atômica e safe area');
forbidMarkers('.work/entregas/src/routes/enderecos.tsx', [
  'setDefaultWithFallback',
  '.update({ is_default: false })',
], 'confirmação de endereço não replica transação no cliente');

requireMarkers('.work/entregas/src/routes/enderecos/novo.tsx', [
  'Não foi possível salvar este endereço. Confira os dados e tente novamente.',
], 'novo endereço usa mensagem pública segura');
forbidMarkers('.work/entregas/src/routes/enderecos/novo.tsx', [
  'toast.error(`Erro ao salvar: ${error.message}`)',
], 'novo endereço não expõe erro técnico');

requireMarkers('.work/entregas/src/routes/enderecos/editar/$addressId.tsx', [
  'const isCompletingMissingField = locationFields.has(name) && previousValue.length === 0;',
  'const mustReconfirmPoint = locationFields.has(name) && !isCompletingMissingField;',
  'Não foi possível atualizar este endereço. Confira os dados e tente novamente.',
], 'edição preserva GPS ao completar campo ausente e usa erro seguro');
forbidMarkers('.work/entregas/src/routes/enderecos/editar/$addressId.tsx', [
  'toast.error(`Erro ao salvar: ${error.message}`)',
  '...(locationFields.has(name) ? { latitude: null, longitude: null } : {})',
], 'edição não perde GPS sem necessidade nem expõe erro técnico');

requireMarkers('.work/entregas/src/components/CustomerLocationAddressSelector.tsx', [
  'import { Geolocation } from "@capacitor/geolocation";',
  'await Geolocation.checkPermissions()',
  'await Geolocation.requestPermissions({ permissions: ["location", "coarseLocation"] })',
  'await Geolocation.getCurrentPosition({',
], 'localização do novo endereço usa Geolocation nativo');
forbidMarkers('.work/entregas/src/components/CustomerLocationAddressSelector.tsx', [
  'navigator.geolocation',
  'toast.error(error instanceof Error ? error.message',
], 'localização não depende da API Web nem expõe erro técnico');

for (const [path, label] of [
  ['.work/entregas/src/routes/perfil/pagamentos.tsx', 'Pagamentos'],
  ['.work/entregas/src/routes/perfil/notificacoes.tsx', 'Preferências'],
  ['.work/entregas/src/routes/perfil/legal.tsx', 'Legal'],
  ['.work/entregas/src/routes/perfil/ajuda.tsx', 'Ajuda'],
]) {
  requireMarkers(path, ['<AppBottomNav activeTab="perfil" />', 'pb-32'], `${label} mantém rodapé`);
}

requireMarkers('.work/entregas/src/routes/perfil/pagamentos.tsx', [
  'Pagamento direto ao estabelecimento',
  'A APOIS não processa nem confirma eletronicamente o pagamento nesta fase.',
  'No momento, o checkout registra pagamento direto ao estabelecimento.',
], 'Pagamentos explica o fluxo direto sem confirmação eletrônica');
forbidMarkers('.work/entregas/src/routes/perfil/pagamentos.tsx', [
  'provedor de pagamentos integrado',
  'Mercado Pago',
  'PagBank',
  'PIX',
  'cartão',
], 'Pagamentos não oferece gateway ou método eletrônico aposentado');

requireMarkers('.work/entregas/src/components/CustomerDeliveryMap.tsx', ['Acompanhe seu entregador'], 'mapa mantém rastreamento');
forbidMarkers('.work/entregas/src/components/CustomerDeliveryMap.tsx', ['confirmationPin', 'setConfirmationPin', 'KeyRound'], 'mapa não duplica PIN');

requireMarkers('.work/entregas/src/routes/register.tsx', [
  'Não foi possível criar sua conta agora. Confira os dados e tente novamente.',
  '<Link to="/termos" className="inline-flex min-h-11 items-center rounded-lg px-1 font-bold text-primary">',
  '<Link to="/privacidade" className="inline-flex min-h-11 items-center rounded-lg px-1 font-bold text-primary">',
], 'cadastro usa mensagens seguras, documentos internos e links tocáveis');
forbidMarkers('.work/entregas/src/routes/register.tsx', [
  '`Erro ao criar conta: ${error.message}`',
  'to="/termos" target="_blank"',
  'to="/privacidade" target="_blank"',
], 'cadastro não vaza erro técnico nem abre aba paralela');

requireMarkers('.work/entregas/src/routes/perfil/ajuda/chamado/$ticketId.tsx', [
  'import { Browser } from "@capacitor/browser";',
  'await Browser.open({ url: data.signedUrl });',
  'pt-[max(env(safe-area-inset-top),1rem)]',
], 'suporte usa Browser nativo e safe area');
forbidMarkers('.work/entregas/src/routes/perfil/ajuda/chamado/$ticketId.tsx', ['document.createElement("a")'], 'suporte não cria WebView paralela');

requireMarkers('.work/entregas/src/lib/lovable-error-reporting.ts', ['console.error("[APOIS] erro capturado pela interface"'], 'diagnóstico de erro fica local');
forbidMarkers('.work/entregas/src/lib/lovable-error-reporting.ts', ['__lovableEvents', '__lovableReportRuntimeError'], 'bundle não contém telemetria Lovable');

// Fallbacks de imagens e retorno visual do estabelecimento são melhorias de UX.
// Eles deixaram de fazer parte do gate de release porque o hardener cosmético foi
// removido da cadeia após corromper JSX em builds reais. Mantemos aqui apenas
// invariantes funcionais/segurança que não dependem de reescrita frágil da UI.

for (const path of ['.work/entregas/src/routes/termos.tsx', '.work/entregas/src/routes/privacidade.tsx']) {
  requireMarkers(path, [
    'onClick={() => void navigate({ to: "/", replace: true })}',
    'pt-[max(env(safe-area-inset-top),1rem)]',
    'pb-[max(env(safe-area-inset-bottom),3rem)]',
  ], `${path}: rota legal fica no módulo e respeita safe areas`);
  forbidMarkers(path, ['window.history.back()'], `${path}: rota legal não usa histórico físico`);
}
forbidMarkers('.work/entregas/src/routes/privacidade.tsx', ['processamento de PIX Mercado Pago'], 'privacidade não fixa gateway obsoleto');

process.exit(failed ? 1 : 0);
