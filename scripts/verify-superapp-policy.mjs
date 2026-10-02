import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve('.');
let failed = false;

function fail(message) { console.error(`[FAIL] ${message}`); failed = true; }
function ok(message) { console.log(`[OK] ${message}`); }
function requireFile(path) {
  const full = resolve(root, path);
  if (!existsSync(full)) { fail(`arquivo obrigatório ausente: ${path}`); return null; }
  return readFileSync(full, 'utf8');
}

const paymentMethods = requireFile('.work/corridas/src/hooks/use-payment-methods.tsx');
if (paymentMethods) {
  const hasCanonicalActiveFilter = paymentMethods.includes('(method) => method.isActive && method.enabled');
  const delegatesToPaymentService = paymentMethods.includes('paymentService.getPaymentMethods()');
  if (paymentMethods.includes('method.code === "pix"')) {
    fail('Corridas Superapp regrediu para PIX-only; Dinheiro e Cartão direto ao motorista devem continuar disponíveis');
  } else if (!hasCanonicalActiveFilter && !delegatesToPaymentService) {
    fail('Corridas Superapp não preserva a filtragem canônica dos métodos ativos nem delega ao paymentService');
  } else {
    ok('Corridas delega ao serviço que libera somente Dinheiro + Cartão direto');
  }
}

const paymentService = requireFile('.work/corridas/src/services/payments/payment-service.ts');
if (paymentService) {
  for (const marker of [
    'const isDirectToDriver = code === "cash" || code === "credit";',
    'Pague diretamente ao motorista em dinheiro ao final da corrida.',
    'Pague diretamente ao motorista no cartão de crédito',
  ]) {
    if (!paymentService.includes(marker)) fail(`Corridas não confirmou recebimento direto de Dinheiro/Cartão: ${marker}`);
  }
  if (!failed) ok('Corridas mantém recebimentos diretos fora da custódia da APOIS');
}

const customerPush = requireFile('.work/entregas/src/lib/customer-push.ts');
if (customerPush) {
  if (!customerPush.includes('const isDeliveryPush =')) fail('listener nativo de Entregas não identifica explicitamente o produto do push');
  else if (!customerPush.includes('if (!target) return;')) fail('listener nativo de Entregas não ignora push de outro produto');
  else if (customerPush.includes('PushNotifications.unregister()')) fail('logout de Entregas ainda cancela o token FCM nativo compartilhado pelo package');
  else ok('listener de Entregas filtra o produto e preserva o token FCM nativo compartilhado');
}

const ridesPush = requireFile('.work/corridas/src/services/push/push-service.ts');
if (ridesPush) {
  if (!ridesPush.includes('isPushRideEvent')) fail('listener próprio de Corridas não usa classificador canônico de eventos');
  else if (!ridesPush.includes('const hasDeliveryMarker =')) fail('listener próprio de Corridas não detecta marcadores de Entregas');
  else if (!ridesPush.includes('if (hasDeliveryMarker) return;')) fail('listener próprio de Corridas ainda pode consumir Push de Entregas');
  else if (!ridesPush.includes('if (!isPushRideEvent(data["event"]) && !hasRideId) return;')) fail('listener próprio de Corridas ainda aceita payload Push desconhecido');
  else ok('listener próprio de Corridas permanece restrito a payloads de corrida');
}

const htmlTargets = [
  ['shell', 'superapp/shell/dist/index.html', './modules/corridas/index.html', './modules/entregas/index.html'],
  ['corridas', 'superapp/shell/dist/modules/corridas/index.html', null, '../entregas/index.html'],
  ['entregas', 'superapp/shell/dist/modules/entregas/index.html', '../corridas/index.html', null],
];
for (const [name, path, corridasBase, entregasBase] of htmlTargets) {
  const html = requireFile(path);
  if (!html) continue;
  if (!html.includes('data-apois-superapp-push-routing')) { fail(`${name}: bridge global de Push não foi injetado`); continue; }
  const hasCurrentClassifier = html.includes('const rideEvents = new Set') && html.includes('function deliveryMarker(data)') && html.includes('function rideMarker(data)') && html.includes('const delivery = deliveryMarker(data);') && html.includes('const ride = rideMarker(data);');
  if (!hasCurrentClassifier) { fail(`${name}: bridge global não diferencia Corridas de Entregas`); continue; }
  if (!html.includes('if (delivery.isDelivery && ride.isRide) return null;')) { fail(`${name}: payload de Push ambíguo não é bloqueado`); continue; }
  if (corridasBase && !html.includes(`const corridasBase = ${JSON.stringify(corridasBase)};`)) { fail(`${name}: destino cruzado para Corridas está ausente`); continue; }
  if (entregasBase && !html.includes(`const entregasBase = ${JSON.stringify(entregasBase)};`)) { fail(`${name}: destino cruzado para Entregas está ausente`); continue; }
  ok(`${name}: Push cruzado preserva o módulo correto`);
}

const searchRoute = requireFile('.work/entregas/src/routes/buscar.tsx');
if (searchRoute) {
  if (!searchRoute.includes('overflow-y-auto px-4 pb-32 pt-2')) fail('Busca de Entregas ainda pode ficar encoberta pelo rodapé fixo');
  else ok('Busca de Entregas reserva espaço para rodapé e safe area');
}
const landingRoute = requireFile('.work/entregas/src/routes/index.tsx');
if (landingRoute) {
  if (landingRoute.includes('src="/apois-logo.svg"')) fail('landing de Entregas ainda usa logo absoluto e quebra dentro de modules/entregas');
  else if (!landingRoute.includes('src="./apois-logo.svg"')) fail('landing de Entregas não aponta para o logo público relativo');
  else ok('landing de Entregas resolve o logo dentro do módulo aninhado');
}
const launchSplash = requireFile('.work/entregas/src/components/ApoisLaunchSplash.tsx');
if (launchSplash) {
  if (!launchSplash.includes('export function ApoisLaunchSplash()') || !launchSplash.includes('return null;')) fail('Entregas ainda exibe uma segunda splash React ao entrar no módulo do Superapp');
  else if (launchSplash.includes('/apois-app-icon.png') || launchSplash.includes('SPLASH_MS')) fail('splash legada de Entregas ainda contém asset/timer do app separado');
  else ok('Entregas não duplica a splash nativa/shell ao trocar de módulo');
}
const legacyTelemetry = requireFile('.work/entregas/src/lib/lovable-error-reporting.ts');
if (legacyTelemetry) {
  if (legacyTelemetry.includes('__lovableEvents') || legacyTelemetry.includes('__lovableReportRuntimeError')) fail('bundle Entregas ainda contém hooks de telemetria do editor Lovable');
  else if (!legacyTelemetry.includes('[APOIS Superapp] erro capturado pelo boundary')) fail('ErrorBoundary de Entregas não possui diagnóstico local após remover telemetria antiga');
  else ok('Entregas remove telemetria Lovable e mantém diagnóstico local do ErrorBoundary');
}
for (const [path, label, variable] of [
  ['.work/entregas/src/routes/auth.callback.tsx', 'callback OAuth/e-mail', 'params'],
  ['.work/entregas/src/routes/redefinir-senha.tsx', 'recuperação de senha', 'params'],
  ['.work/entregas/src/routes/login.tsx', 'redirect pós-login', 'searchParams'],
]) {
  const authRoute = requireFile(path);
  if (!authRoute) continue;
  if (authRoute.includes(`const ${variable} = new URLSearchParams(window.location.search);`)) fail(`Entregas ${label} ainda ignora query dentro do Hash Router`);
  else if (!authRoute.includes('window.location.hash.includes("?")') || !authRoute.includes(`new URLSearchParams(hashQuery || window.location.search)`)) fail(`Entregas ${label} não possui leitura Hash-aware dos parâmetros`);
  else ok(`Entregas ${label} lê parâmetros de #/rota?...`);
}
const authCallback = requireFile('.work/entregas/src/routes/auth.callback.tsx');
if (authCallback) {
  if (!authCallback.includes('const { data: beforeExchange } = await supabase.auth.getSession();') || !authCallback.includes('if (!beforeExchange.session)')) fail('callback Google Entregas ainda pode trocar o mesmo PKCE duas vezes');
  else ok('callback Google Entregas reutiliza sessão já criada antes de trocar PKCE');
  if (authCallback.includes('setErrorMessage(providerError)')) fail('callback Entregas ainda exibe erro bruto do provedor');
  else if (!authCallback.includes('Não foi possível confirmar este acesso. Solicite um novo link ou tente entrar novamente.')) fail('callback Entregas não possui mensagem pública segura');
  else ok('callback Entregas sanitiza falhas externas antes de exibir ao usuário');
}
const resetPassword = requireFile('.work/entregas/src/routes/redefinir-senha.tsx');
if (resetPassword) {
  if (resetPassword.includes('toast.error(error.message || "Não foi possível atualizar sua senha.")')) fail('redefinição de senha Entregas ainda exibe erro bruto do provedor');
  else if (!resetPassword.includes('toast.error("Não foi possível atualizar sua senha. Tente novamente.")')) fail('redefinição de senha Entregas não possui mensagem pública segura');
  else ok('redefinição de senha Entregas mantém detalhe técnico somente no console local');
}
const checkout = requireFile('.work/entregas/src/routes/checkout.tsx');
if (checkout) {
  if (!checkout.includes('const paymentMethod = "pix";') || !checkout.includes('paymentMethod: "pix"')) fail('checkout Entregas não está PIX Safe2Pay'); else ok('checkout Entregas usa PIX Safe2Pay');
  if (checkout.includes('payload?.provider?.message') || checkout.includes('payload?.provider?.status_detail')) fail('checkout Entregas ainda pode expor detalhe técnico do provedor ao cliente');
  else if (!checkout.includes('return fallback;')) fail('checkout Entregas não possui fallback seguro para erro técnico de Edge Function'); else ok('checkout Entregas exibe somente mensagens seguras ao cliente');
  if (/mercadopago|openpix|pagbank|asaas|create-(?:asaas-)?pix-charge/i.test(checkout)) fail('checkout Entregas ainda contém gateway aposentado executável');
  else if (!checkout.includes('"safe2pay-create-order-pix"')) fail('checkout Entregas não cria PIX pela Safe2Pay');
  else if (!checkout.includes('"safe2pay-payment-status"')) fail('checkout Entregas não consulta status Safe2Pay');
  else ok('checkout Entregas usa somente Safe2Pay para novos pagamentos PIX');
  if (!checkout.includes('get_delivery_checkout_readiness')) fail('checkout Entregas não consulta readiness do repasse direto do entregador'); else ok('checkout Entregas bloqueia entrega quando o repasse direto ao entregador ainda não está homologado');
}
const shellSource = requireFile('superapp/shell/index.html');
if (shellSource) {
  if (!shellSource.includes('./assets/apois-mark-v3.svg') || !shellSource.includes('class="brand-lockup"')) fail('shell ainda não usa o lockup oficial APOIS');
  else if (shellSource.includes('<div class="logo-mark">A</div>')) fail('shell ainda contém marca provisória em texto'); else ok('shell usa arte oficial APOIS');
  if (!shellSource.includes("return hasPersistedSession(moduleName)?base+'#/inicio':base+'#/login';")) fail('entrada dos módulos não é determinística por sessão'); else ok('shell envia sessão válida para Início e sessão ausente para Login');
}
process.exit(failed ? 1 : 0);
