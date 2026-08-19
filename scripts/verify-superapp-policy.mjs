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
  if (!paymentMethods.includes('method.isActive && method.enabled && method.code === "pix"')) fail('Corridas Superapp não está restringindo as formas de pagamento a PIX');
  else ok('Corridas Superapp é PIX-only mesmo se a fonte compartilhada mantiver método legado ativo');
}

const customerPush = requireFile('.work/entregas/src/lib/customer-push.ts');
if (customerPush) {
  if (!customerPush.includes('const isDeliveryPush =')) fail('listener nativo de Entregas não identifica explicitamente o produto do push');
  else if (!customerPush.includes('if (!target) return;')) fail('listener nativo de Entregas não ignora push de outro produto');
  else if (customerPush.includes('PushNotifications.unregister()')) fail('logout de Entregas ainda cancela o token FCM nativo compartilhado pelo package');
  else ok('listener de Entregas filtra o produto e preserva o token FCM nativo compartilhado');
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
  if (!html.includes('const rideEvents = new Set') || !html.includes('const isDeliveryPush =')) { fail(`${name}: bridge global não diferencia Corridas de Entregas`); continue; }
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
  if (!launchSplash.includes('export function ApoisLaunchSplash()') || !launchSplash.includes('return null;')) {
    fail('Entregas ainda exibe uma segunda splash React ao entrar no módulo do Superapp');
  } else if (launchSplash.includes('/apois-app-icon.png') || launchSplash.includes('SPLASH_MS')) {
    fail('splash legada de Entregas ainda contém asset/timer do app separado');
  } else {
    ok('Entregas não duplica a splash nativa/shell ao trocar de módulo');
  }
}

const legacyTelemetry = requireFile('.work/entregas/src/lib/lovable-error-reporting.ts');
if (legacyTelemetry) {
  if (legacyTelemetry.includes('__lovableEvents') || legacyTelemetry.includes('__lovableReportRuntimeError')) {
    fail('bundle Entregas ainda contém hooks de telemetria do editor Lovable');
  } else if (!legacyTelemetry.includes('[APOIS Superapp] erro capturado pelo boundary')) {
    fail('ErrorBoundary de Entregas não possui diagnóstico local após remover telemetria antiga');
  } else {
    ok('Entregas remove telemetria Lovable e mantém diagnóstico local do ErrorBoundary');
  }
}

for (const [path, label, variable] of [
  ['.work/entregas/src/routes/auth.callback.tsx', 'callback OAuth/e-mail', 'params'],
  ['.work/entregas/src/routes/redefinir-senha.tsx', 'recuperação de senha', 'params'],
  ['.work/entregas/src/routes/login.tsx', 'redirect pós-login', 'searchParams'],
]) {
  const authRoute = requireFile(path);
  if (!authRoute) continue;
  if (authRoute.includes(`const ${variable} = new URLSearchParams(window.location.search);`)) {
    fail(`Entregas ${label} ainda ignora query dentro do Hash Router`);
  } else if (
    !authRoute.includes('window.location.hash.includes("?")') ||
    !authRoute.includes(`new URLSearchParams(hashQuery || window.location.search)`)
  ) {
    fail(`Entregas ${label} não possui leitura Hash-aware dos parâmetros`);
  } else {
    ok(`Entregas ${label} lê parâmetros de #/rota?...`);
  }
}

const checkout = requireFile('.work/entregas/src/routes/checkout.tsx');
if (checkout) {
  if (!checkout.includes('const paymentMethod = "pix";')) fail('checkout Entregas não está PIX-only');
  else ok('checkout Entregas está PIX-only');
  if (checkout.includes('payload?.provider?.message') || checkout.includes('payload?.provider?.status_detail')) {
    fail('checkout Entregas ainda pode expor detalhe técnico do provedor ao cliente');
  } else if (!checkout.includes('return fallback;')) {
    fail('checkout Entregas não possui fallback seguro para erro técnico de Edge Function');
  } else {
    ok('checkout Entregas exibe somente mensagens seguras ao cliente');
  }
  if (!checkout.includes('new Set(["openpix", "asaas"]).has(configuredProvider)')) {
    fail('checkout Entregas ainda escolhe função PIX por fallback permissivo');
  } else if (!checkout.includes('O pagamento PIX está temporariamente indisponível. Tente novamente em instantes.')) {
    fail('checkout Entregas não possui erro seguro para provedor PIX inconsistente');
  } else {
    ok('checkout Entregas valida explicitamente o provedor PIX antes de gerar cobrança');
  }
}

const shellSource = requireFile('superapp/shell/index.html');
if (shellSource) {
  if (!shellSource.includes('./assets/apois-brand.png')) fail('shell ainda não usa a arte oficial APOIS');
  else if (shellSource.includes('<div class="logo-mark">A</div>')) fail('shell ainda contém marca provisória em texto');
  else ok('shell usa arte oficial APOIS');
  if (!shellSource.includes("return hasPersistedSession(moduleName)?base+'#/inicio':base+'#/login';")) fail('entrada dos módulos não é determinística por sessão');
  else ok('shell envia sessão válida para Início e sessão ausente para Login');
}

process.exit(failed ? 1 : 0);
