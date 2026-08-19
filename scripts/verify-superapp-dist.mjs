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

  const corridas = readFileSync(resolve(dist, 'modules/corridas/index.html'), 'utf8');
  if (/\b(?:src|href)="\/assets\//.test(corridas)) {
    console.error('[FAIL] Corridas contém asset absoluto /assets/');
    failed = true;
  } else {
    console.log('[OK] Corridas usa assets HTML compatíveis com pasta aninhada');
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
}

process.exit(failed ? 1 : 0);
