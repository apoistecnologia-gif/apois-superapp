import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = resolve(root, 'superapp/shell/dist');
let failed = false;

function fail(message) {
  console.error(`[FAIL] ${message}`);
  failed = true;
}
function ok(message) { console.log(`[OK] ${message}`); }
function read(path) { return readFileSync(resolve(root, path), 'utf8'); }
function requireFile(path) {
  const full = resolve(root, path);
  if (!existsSync(full)) { fail(`arquivo obrigatório ausente: ${path}`); return null; }
  return readFileSync(full, 'utf8');
}
function requireMarkers(path, markers, label) {
  const source = requireFile(path);
  if (!source) return;
  const missing = markers.filter((marker) => !source.includes(marker));
  if (missing.length) fail(`${label}: ${missing.join(' | ')}`);
  else ok(label);
}
function forbidMarkers(path, markers, label) {
  const source = requireFile(path);
  if (!source) return;
  const found = markers.filter((marker) => source.includes(marker));
  if (found.length) fail(`${label}: ${found.join(' | ')}`);
  else ok(label);
}

const requiredFiles = [
  'superapp/shell/dist/index.html',
  'superapp/shell/dist/assets/apois-brand.png',
  'superapp/shell/dist/modules/corridas/index.html',
  'superapp/shell/dist/modules/corridas/assets/ride-categories/carros.svg',
  'superapp/shell/dist/modules/corridas/assets/ride-categories/motos.svg',
  'superapp/shell/dist/modules/corridas/assets/ride-categories/fretes.svg',
  'superapp/shell/dist/modules/corridas/assets/ride-categories/guincho.svg',
  'superapp/shell/dist/modules/corridas/assets/ride-categories/envios.svg',
  'superapp/shell/dist/modules/entregas/index.html',
];
for (const path of requiredFiles) {
  if (existsSync(resolve(root, path))) ok(path);
  else fail(`ausente: ${path}`);
}

requireMarkers(
  'superapp/shell/index.html',
  [
    './assets/apois-brand.png',
    "PUBLIC_ROUTE_FRAGMENTS=['/login','/register','/cadastro','/recuperar-senha','/redefinir-senha','/auth/callback']",
    "return hasPersistedSession(moduleName)?base+'#/inicio':base+'#/login';",
    'localStorage.removeItem(key)',
    "path==='corridas-reset'",
    "path==='email-change'",
    "#/auth/callback${suffix()}",
  ],
  'shell fonte usa marca oficial, entrada determinística e deep links atuais',
);
forbidMarkers(
  'superapp/shell/index.html',
  ['<div class="logo-mark">A</div>', './modules/entregas/index.html#/perfil/dados-pessoais'],
  'shell não contém branding provisório nem callback de e-mail que pula troca de sessão',
);

const shell = requireFile('superapp/shell/dist/index.html');
if (shell) {
  if (/\b(?:src|href)=["']\/(?!\/)/.test(shell)) fail('shell final contém asset/rota absoluta incompatível com WebView local');
  else ok('shell final usa recursos relativos');
  if (!shell.includes('data-apois-superapp-push-routing')) fail('shell final não recebeu roteamento global de Push');
  else ok('shell final contém roteamento global de Push');
}

requireMarkers(
  '.work/corridas/src/integrations/supabase/client.ts',
  ['storageKey: "apois-superapp-corridas-auth-v1"'],
  'Corridas usa namespace de sessão próprio',
);
requireMarkers(
  '.work/corridas/src/hooks/use-payment-methods.tsx',
  ['method.isActive && method.enabled && method.code === "pix"'],
  'Corridas final permanece PIX-only',
);
requireMarkers(
  '.work/corridas/src/routes/_authenticated.inicio.tsx',
  [
    '"./assets/ride-categories/carros.svg"',
    '"./assets/ride-categories/motos.svg"',
    '"./assets/ride-categories/fretes.svg"',
    '"./assets/ride-categories/guincho.svg"',
    'absolute inset-x-0 bottom-0 z-30 max-h-[54dvh]',
  ],
  'Home Corridas usa categorias relativas e não reserva rodapé duplicado',
);
forbidMarkers(
  '.work/corridas/src/routes/_authenticated.inicio.tsx',
  ['"/assets/ride-categories/', 'const navItems = [', '{navItems.map('],
  'Home Corridas não contém assets absolutos nem segundo rodapé',
);
requireMarkers(
  '.work/corridas/src/components/layout/AppShell.tsx',
  [
    'aria-label="Navegação inferior"',
    'const showBottomNavigation',
    '!superappJourneyRoutesWithoutBottomNav.includes(pathname)',
    '!pathname.startsWith("/corrida/")',
    '{ label: "Carteira", icon: WalletCards, to: "/carteira" }',
    '{ label: "Notificações", icon: Bell, to: "/notificacoes" }',
  ],
  'rodapé global de Corridas permanece nas telas normais',
);
requireMarkers(
  '.work/corridas/src/lib/auth/native-password-recovery.ts',
  [
    'br.com.apois.app://auth/corridas-reset',
    'apois-superapp:corridas-recovery-url',
    'window.sessionStorage.removeItem(FORWARDED_RECOVERY_KEY)',
  ],
  'recuperação de senha Corridas usa package unificado e consumo único',
);
forbidMarkers(
  '.work/corridas/src/lib/auth/native-password-recovery.ts',
  ['apoispassageiro://auth/redefinir-senha'],
  'recuperação Corridas não contém esquema antigo',
);
requireMarkers(
  '.work/corridas/src/hooks/rides/use-active-ride.tsx',
  ['RIDE_STATUS_ORDER', 'lastAcceptedStatusRef', 'await loadRide(currentRideId)'],
  'Corridas preserva lifecycle monotônico e retomada terminal',
);
requireMarkers(
  '.work/corridas/src/components/map/ActiveRideMap.tsx',
  ['compact?: boolean', '? { top: 24, right: 24, bottom: 24, left: 24 }'],
  'mapa ativo Corridas possui enquadramento compacto',
);
requireMarkers(
  '.work/corridas/src/components/payments/RidePixPaymentCard.tsx',
  ['Pagamento por Pix', 'Assim que o pagamento for confirmado, a busca do motorista começa automaticamente.'],
  'Pix de Corridas usa texto adequado ao cliente',
);
forbidMarkers(
  '.work/corridas/src/components/payments/RidePixPaymentCard.tsx',
  ['Asaas confirmar o pagamento ao backend', 'Valor calculado e persistido pelo backend'],
  'Pix de Corridas não expõe texto técnico',
);

const publicBase = process.env.CORRIDAS_PUBLIC_APP_URL?.trim();
if (publicBase) {
  const normalized = publicBase.replace(/\/#\/?$/, '').replace(/\/+$/, '');
  requireMarkers(
    '.work/corridas/src/routes/_authenticated.corrida.$rideId.tsx',
    [`const configuredBase = ${JSON.stringify(normalized)};`],
    'compartilhamento de Corridas usa URL pública configurada',
  );
}

requireMarkers(
  '.work/entregas/src/integrations/supabase/client.ts',
  ['storageKey: "apois-superapp-entregas-auth-v1"'],
  'Entregas usa namespace de sessão próprio',
);
requireMarkers(
  '.work/entregas/src/components/AuthSessionIsolation.tsx',
  ['window.location.hash.startsWith("#/")', 'window.location.replace(`#${getProductLandingRoute(product)}`)'],
  'isolamento de sessão Entregas entende Hash History',
);
requireMarkers(
  '.work/entregas/src/components/GoogleLoginButton.tsx',
  ['br.com.apois.app://auth/callback', '__APOIS_SUPERAPP_AUTH_BRIDGE__', 'window.location.replace("#/inicio")'],
  'Google OAuth de Entregas retorna ao Superapp sem listener duplicado',
);
requireMarkers(
  '.work/entregas/src/routes/register.tsx',
  ['emailRedirectTo: "br.com.apois.app://auth/callback"'],
  'cadastro Entregas confirma e-mail no callback unificado',
);
requireMarkers(
  '.work/entregas/src/routes/login.tsx',
  ['redirectTo: "br.com.apois.app://auth/reset"'],
  'reset Entregas usa deep link unificado',
);
requireMarkers(
  '.work/entregas/src/routes/perfil/dados-pessoais.tsx',
  ['emailRedirectTo: "br.com.apois.app://auth/email-change"'],
  'troca de e-mail Entregas usa deep link unificado',
);
requireMarkers(
  '.work/entregas/src/lib/customer-push.ts',
  [
    'register_superapp_customer_push_device',
    'remove_superapp_customer_push_devices',
    '_app_package: "br.com.apois.app"',
    'const isDeliveryPush =',
    'if (!target) return;',
  ],
  'Push Entregas filtra produto e usa RPCs do package unificado',
);
forbidMarkers(
  '.work/entregas/src/lib/customer-push.ts',
  ['PushNotifications.unregister()'],
  'logout Entregas não invalida token FCM compartilhado',
);
requireMarkers(
  '.work/entregas/src/routes/checkout.tsx',
  ['const paymentMethod = "pix";'],
  'checkout Entregas permanece PIX-only',
);
requireMarkers(
  '.work/entregas/src/components/AppBottomNav.tsx',
  ['<nav className="fixed bottom-0', 'min-h-[88px]', 'pb-[max(env(safe-area-inset-bottom),1.25rem)]', 'h-8 w-8'],
  'rodapé Entregas é fixo, legível e respeita safe area',
);
for (const [path, marker, label] of [
  ['.work/entregas/src/routes/inicio.tsx', 'overflow-y-auto px-4 pb-32 pt-5', 'Home Entregas'],
  ['.work/entregas/src/routes/buscar.tsx', 'overflow-y-auto px-4 pb-32 pt-2', 'Busca Entregas'],
  ['.work/entregas/src/routes/pedidos.tsx', 'overflow-y-auto p-4 pb-32', 'Pedidos Entregas'],
  ['.work/entregas/src/routes/perfil/index.tsx', 'overflow-y-auto p-4 pb-32 pt-5', 'Perfil Entregas'],
]) requireMarkers(path, [marker], `${label} reserva área do rodapé`);
requireMarkers(
  '.work/entregas/src/lib/lovable-error-reporting.ts',
  ['[APOIS Superapp] erro capturado pelo boundary'],
  'telemetria antiga de editor foi neutralizada no Superapp',
);
forbidMarkers(
  '.work/entregas/src/lib/lovable-error-reporting.ts',
  ['__lovableEvents', '__lovableReportRuntimeError'],
  'bundle Entregas não contém hooks Lovable de editor',
);

for (const path of [
  'superapp/shell/dist/modules/corridas/index.html',
  'superapp/shell/dist/modules/entregas/index.html',
]) {
  const html = requireFile(path);
  if (!html) continue;
  if (/\b(?:src|href)=["']\/(?!\/)/.test(html)) fail(`${path} contém src/href absoluto`);
  else ok(`${path} usa src/href compatíveis com módulo aninhado`);
  if (!html.includes('data-apois-superapp-bridge')) fail(`${path} não contém bridge do Superapp`);
  else ok(`${path} contém bridge do Superapp`);
  if (!html.includes('data-apois-superapp-push-routing')) fail(`${path} não contém roteamento global de Push`);
  else ok(`${path} contém roteamento global de Push`);
}

requireMarkers(
  'superapp/shell/capacitor.config.ts',
  ["appId: 'br.com.apois.app'", "style: 'LIGHT'", "backgroundColor: '#050505'", 'overlaysWebView: false'],
  'Capacitor final preserva package e barras Android',
);

process.exit(failed ? 1 : 0);
