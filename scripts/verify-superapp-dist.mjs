import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = resolve(root, 'superapp/shell/dist');
const required = [
  'index.html',
  'modules/corridas/index.html',
  'modules/corridas/assets/ride-categories/carros.svg',
  'modules/corridas/assets/ride-categories/motos.svg',
  'modules/corridas/assets/ride-categories/fretes.svg',
  'modules/corridas/assets/ride-categories/guincho.svg',
  'modules/corridas/assets/ride-categories/envios.svg',
  'modules/entregas/index.html',
];
const AUTH_DEEP_LINK_KEY = 'apois-superapp:last-auth-deeplink';
const CORRIDAS_RECOVERY_KEY = 'apois-superapp:corridas-recovery-url';
const ENTREGAS_AUTH_FORWARD_KEY = 'apois-superapp:entregas-auth-url';

let failed = false;
for (const relative of required) {
  const path = resolve(dist, relative);
  if (!existsSync(path)) {
    console.error(`[FAIL] ausente: ${relative}`);
    failed = true;
  } else {
    console.log(`[OK] ${relative}`);
  }
}

const packageJson = readFileSync(resolve(root, 'package.json'), 'utf8');
for (const obsolete of [
  'normalize-corridas-superapp-input',
  'normalize-entregas-superapp-build',
  'route-corridas-recovery-deeplink',
  'harden-superapp-auth-deeplink-race',
]) {
  if (packageJson.includes(obsolete)) {
    console.error(`[FAIL] pipeline ainda depende de patcher obsoleto: ${obsolete}`);
    failed = true;
  }
}
if (!failed) console.log('[OK] pipeline principal não depende de scripts que se autoalteram ou patches pós-build de auth');

const capacitorConfig = readFileSync(resolve(root, 'superapp/shell/capacitor.config.ts'), 'utf8');
if (!capacitorConfig.includes("appId: 'br.com.apois.app'")) {
  console.error('[FAIL] package Android do shell não é br.com.apois.app');
  failed = true;
}
if (!capacitorConfig.includes("style: 'LIGHT'") || !capacitorConfig.includes("backgroundColor: '#050505'")) {
  console.error('[FAIL] StatusBar não está configurada para ícones claros no fundo escuro');
  failed = true;
} else {
  console.log('[OK] shell Android usa package unificado e StatusBar legível');
}

if (!failed) {
  const shell = readFileSync(resolve(dist, 'index.html'), 'utf8');
  if (!shell.includes('./modules/corridas/index.html') || !shell.includes('./modules/entregas/index.html')) {
    console.error('[FAIL] shell não aponta para os dois módulos locais');
    failed = true;
  } else {
    console.log('[OK] shell aponta para Corridas e Entregas locais');
  }

  if (!shell.includes(AUTH_DEEP_LINK_KEY)) {
    console.error('[FAIL] shell não protege callback OAuth/reset contra reprocessamento do launch URL');
    failed = true;
  } else {
    console.log('[OK] shell deduplica deep links de autenticação');
  }

  if (!shell.includes("path==='corridas-reset'") || !shell.includes(CORRIDAS_RECOVERY_KEY)) {
    console.error('[FAIL] shell não encaminha recuperação de senha de Corridas');
    failed = true;
  } else {
    console.log('[OK] shell encaminha recuperação de senha para Corridas');
  }

  if (!shell.includes("path==='email-change'") || !shell.includes('./modules/entregas/index.html#/perfil/dados-pessoais')) {
    console.error('[FAIL] shell não encaminha confirmação de troca de e-mail para Entregas');
    failed = true;
  } else {
    console.log('[OK] shell encaminha troca de e-mail para o perfil de Entregas');
  }

  if (
    !shell.includes("'apois-superapp:last-route:'+moduleName") ||
    !shell.includes('function resumableRoute(moduleName)') ||
    !shell.includes("route.includes('/auth/callback')") ||
    !shell.includes("route.includes('/redefinir-senha')")
  ) {
    console.error('[FAIL] shell não retoma rotas autenticadas com filtro de rotas públicas');
    failed = true;
  } else {
    console.log('[OK] shell retoma somente rotas persistidas seguras de sessões ativas');
  }

  const corridas = readFileSync(resolve(dist, 'modules/corridas/index.html'), 'utf8');
  if (/\b(?:src|href)="\/assets\//.test(corridas)) {
    console.error('[FAIL] Corridas contém asset absoluto /assets/');
    failed = true;
  } else {
    console.log('[OK] Corridas usa assets HTML compatíveis com pasta aninhada');
  }

  if (
    !corridas.includes(ENTREGAS_AUTH_FORWARD_KEY) ||
    !corridas.includes("path === 'reset' || path === 'callback' || path === 'email-change'") ||
    !corridas.includes("window.location.replace('../entregas/index.html')")
  ) {
    console.error('[FAIL] Corridas não preserva callbacks de autenticação pertencentes a Entregas');
    failed = true;
  } else {
    console.log('[OK] Corridas encaminha OAuth/reset/e-mail de Entregas sem perder o appUrlOpen');
  }

  if (
    !corridas.includes('notificationType') ||
    !corridas.includes('if (!destination) return;') ||
    !corridas.includes('const isDeliveryPush')
  ) {
    console.error('[FAIL] listener de Push no módulo Corridas pode interceptar notificações de outro produto');
    failed = true;
  } else {
    console.log('[OK] listener de Entregas ignora Push de Corridas no módulo compartilhado');
  }

  const corridasHomeSource = readFileSync(
    resolve(root, '.work/corridas/src/routes/_authenticated.inicio.tsx'),
    'utf8',
  );
  if (corridasHomeSource.includes('"/assets/ride-categories/')) {
    console.error('[FAIL] cards de categoria de Corridas ainda usam /assets absoluto no runtime');
    failed = true;
  } else if (!corridasHomeSource.includes('"./assets/ride-categories/carros.svg"')) {
    console.error('[FAIL] cards de categoria não foram adaptados para assets relativos do módulo');
    failed = true;
  } else {
    console.log('[OK] artes de Carro/Moto/Fretes/Guincho/Envios usam caminho relativo do módulo');
  }

  if (corridasHomeSource.includes('const navItems = [') || corridasHomeSource.includes('{navItems.map(')) {
    console.error('[FAIL] Home de Corridas ainda contém uma segunda navegação inferior');
    failed = true;
  } else if (!corridasHomeSource.includes('absolute inset-x-0 bottom-0 z-30 max-h-[54dvh]')) {
    console.error('[FAIL] Home ainda reserva espaço do rodapé antigo dentro da própria rota');
    failed = true;
  } else {
    console.log('[OK] Home usa somente o rodapé global, sem duplicidade ou faixa vazia');
  }

  const corridasAppShell = readFileSync(
    resolve(root, '.work/corridas/src/components/layout/AppShell.tsx'),
    'utf8',
  );
  const bottomNavMarkers = [
    'aria-label="Navegação inferior"',
    'const showBottomNavigation',
    '!superappJourneyRoutesWithoutBottomNav.includes(pathname)',
    '!pathname.startsWith("/corrida/")',
    'pathname.startsWith("/corridas/")',
    'pathname.startsWith("/perfil/")',
    '{ label: "Carteira", icon: WalletCards, to: "/carteira" }',
    '{ label: "Notificações", icon: Bell, to: "/notificacoes" }',
  ];
  const missingBottomNav = bottomNavMarkers.filter((marker) => !corridasAppShell.includes(marker));
  if (missingBottomNav.length) {
    console.error(`[FAIL] rodapé persistente de Corridas incompleto: ${missingBottomNav.join(', ')}`);
    failed = true;
  } else if (corridasAppShell.includes('pathname !== "/inicio"')) {
    console.error('[FAIL] AppShell ainda desativa o rodapé na Home');
    failed = true;
  } else {
    console.log('[OK] rodapé único persiste na Home e telas normais; some apenas na jornada ativa');
  }

  const recoverySource = readFileSync(
    resolve(root, '.work/corridas/src/lib/auth/native-password-recovery.ts'),
    'utf8',
  );
  const recoveryMarkers = [
    'br.com.apois.app://auth/corridas-reset',
    'url.protocol === "br.com.apois.app:"',
    'url.pathname.replace(/\\/+$/, "") === "/corridas-reset"',
    CORRIDAS_RECOVERY_KEY,
    'window.sessionStorage.removeItem(FORWARDED_RECOVERY_KEY)',
  ];
  const missingRecovery = recoveryMarkers.filter((marker) => !recoverySource.includes(marker));
  if (missingRecovery.length) {
    console.error(`[FAIL] recuperação nativa de Corridas incompleta: ${missingRecovery.join(', ')}`);
    failed = true;
  } else if (recoverySource.includes('apoispassageiro://auth/redefinir-senha')) {
    console.error('[FAIL] Corridas ainda contém esquema nativo antigo de recuperação');
    failed = true;
  } else {
    console.log('[OK] recuperação de senha de Corridas usa deep link do Superapp e aceita encaminhamento entre módulos');
  }

  const publicBase = process.env.CORRIDAS_PUBLIC_APP_URL?.trim();
  if (publicBase) {
    const activeRideSource = readFileSync(
      resolve(root, '.work/corridas/src/routes/_authenticated.corrida.$rideId.tsx'),
      'utf8',
    );
    const normalized = publicBase.replace(/\/#\/?$/, '').replace(/\/+$/, '');
    if (!activeRideSource.includes(`const configuredBase = ${JSON.stringify(normalized)};`)) {
      console.error('[FAIL] link de compartilhamento de Corridas não recebeu CORRIDAS_PUBLIC_APP_URL');
      failed = true;
    } else {
      console.log('[OK] compartilhamento de Corridas usa URL pública configurada');
    }
  }

  const entregas = readFileSync(resolve(dist, 'modules/entregas/index.html'), 'utf8');
  if (/\b(?:src|href)="\/assets\//.test(entregas)) {
    console.error('[FAIL] Entregas contém asset absoluto /assets/');
    failed = true;
  } else {
    console.log('[OK] Entregas usa assets compatíveis com pasta aninhada');
  }

  if (!entregas.includes(AUTH_DEEP_LINK_KEY)) {
    console.error('[FAIL] Entregas não deduplica appUrlOpen/getLaunchUrl de autenticação');
    failed = true;
  } else {
    console.log('[OK] Entregas deduplica deep links OAuth/reset no bridge nativo');
  }

  if (!entregas.includes("path === 'corridas-reset'") || !entregas.includes(CORRIDAS_RECOVERY_KEY)) {
    console.error('[FAIL] Entregas não encaminha deep link de recuperação de Corridas');
    failed = true;
  } else {
    console.log('[OK] Entregas encaminha recuperação de Corridas sem perder o link nativo');
  }

  if (
    !entregas.includes("path === 'email-change'") ||
    !entregas.includes("window.location.replace('#/perfil/dados-pessoais' + suffix)") ||
    !entregas.includes(ENTREGAS_AUTH_FORWARD_KEY) ||
    !entregas.includes('sessionStorage.removeItem')
  ) {
    console.error('[FAIL] Entregas não conclui roteamento de e-mail/callback encaminhado por Corridas');
    failed = true;
  } else {
    console.log('[OK] Entregas conclui callbacks próprios e remove o encaminhamento após consumo');
  }

  const entregasSessionIsolation = readFileSync(
    resolve(root, '.work/entregas/src/components/AuthSessionIsolation.tsx'),
    'utf8',
  );
  if (
    !entregasSessionIsolation.includes('window.location.hash.startsWith("#/")') ||
    !entregasSessionIsolation.includes('window.location.replace(`#${getProductLandingRoute(product)}`)')
  ) {
    console.error('[FAIL] isolamento de sessão de Entregas ainda usa o pathname físico do módulo');
    failed = true;
  } else {
    console.log('[OK] isolamento de sessão de Entregas respeita Hash History dentro do Superapp');
  }

  const entregasProfile = readFileSync(
    resolve(root, '.work/entregas/src/routes/perfil/dados-pessoais.tsx'),
    'utf8',
  );
  if (!entregasProfile.includes('emailRedirectTo: "br.com.apois.app://auth/email-change"')) {
    console.error('[FAIL] troca de e-mail de Entregas ainda retorna para origin WebView inválida');
    failed = true;
  } else {
    console.log('[OK] troca de e-mail de Entregas retorna ao package unificado');
  }

  const entregasPush = readFileSync(resolve(root, '.work/entregas/src/lib/customer-push.ts'), 'utf8');
  if (
    !entregasPush.includes('"register_superapp_customer_push_device"') ||
    !entregasPush.includes('"remove_superapp_customer_push_devices"') ||
    !entregasPush.includes('_app_package: "br.com.apois.app"')
  ) {
    console.error('[FAIL] Push de Entregas não está explicitamente isolado no package do Superapp');
    failed = true;
  } else {
    console.log('[OK] Push de Entregas registra e remove somente o package br.com.apois.app');
  }

  const entregasBottomNav = readFileSync(
    resolve(root, '.work/entregas/src/components/AppBottomNav.tsx'),
    'utf8',
  );
  if (
    !entregasBottomNav.includes('<nav className="fixed bottom-0') ||
    !entregasBottomNav.includes('min-h-[88px]') ||
    !entregasBottomNav.includes('pb-[max(env(safe-area-inset-bottom),1.25rem)]') ||
    !entregasBottomNav.includes('h-8 w-8')
  ) {
    console.error('[FAIL] rodapé do cliente Entregas não está protegido contra barra Android/área de toque pequena');
    failed = true;
  } else {
    console.log('[OK] rodapé de Entregas fica fixo, maior e respeita safe area Android');
  }

  const entregasHome = readFileSync(resolve(root, '.work/entregas/src/routes/inicio.tsx'), 'utf8');
  if (!entregasHome.includes('overflow-y-auto px-4 pb-32 pt-5')) {
    console.error('[FAIL] Home de Entregas pode esconder conteúdo atrás do rodapé fixo');
    failed = true;
  } else {
    console.log('[OK] Home de Entregas reserva espaço para o rodapé fixo');
  }

  const entregasCheckout = readFileSync(resolve(root, '.work/entregas/src/routes/checkout.tsx'), 'utf8');
  if (
    !entregasCheckout.includes('const paymentMethod = "pix";') ||
    entregasCheckout.includes('sessionStorage.getItem("apois_payment_method") || "pix"')
  ) {
    console.error('[FAIL] checkout de Entregas ainda pode reutilizar método de pagamento legado do storage');
    failed = true;
  } else {
    console.log('[OK] checkout de Entregas é PIX-only mesmo com storage legado no aparelho');
  }
}

process.exit(failed ? 1 : 0);
