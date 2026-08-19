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
  else ok('Corridas Superapp é PIX-only mesmo se a fonte compartilhada mantiver Dinheiro ativo');
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

process.exit(failed ? 1 : 0);
