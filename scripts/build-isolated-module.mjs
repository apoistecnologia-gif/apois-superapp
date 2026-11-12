import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(readFileSync(resolve(root, '.apois/modules.json'), 'utf8'));
const name = process.argv[2];

const ENTREGAS_CANONICAL_REF = 'ptgkwyyolrdgnqketkjj';
const ENTREGAS_CANONICAL_URL = `https://${ENTREGAS_CANONICAL_REF}.supabase.co`;
const ENTREGAS_CANONICAL_PUBLISHABLE_KEY = 'sb_publishable_DcfjTMboo1HX0O3w8Ptijg_quQbvVBY';

if (!name || !manifest.modules[name]) {
  console.error(`Uso: node scripts/build-isolated-module.mjs <${Object.keys(manifest.modules).join('|')}>`);
  process.exit(1);
}

function resolveCommand(bin) {
  if (process.platform !== 'win32' || bin !== 'bash') return bin;
  const candidates = [
    process.env.APOIS_BASH_PATH,
    process.env.ProgramW6432 && resolve(process.env.ProgramW6432, 'Git', 'bin', 'bash.exe'),
    process.env.ProgramFiles && resolve(process.env.ProgramFiles, 'Git', 'bin', 'bash.exe'),
    process.env.LOCALAPPDATA && resolve(process.env.LOCALAPPDATA, 'Programs', 'Git', 'bin', 'bash.exe'),
  ].filter(Boolean);
  const command = candidates.find((candidate) => existsSync(candidate));
  if (!command) {
    console.error('[FAIL] Windows: bash.exe não encontrado; instale Git Bash ou defina APOIS_BASH_PATH.');
    process.exit(1);
  }
  return command;
}

function run(bin, args, options = {}) {
  const result = spawnSync(resolveCommand(bin), args, {
    cwd: options.cwd ?? root,
    stdio: 'inherit',
    env: options.env ?? process.env,
    shell: false,
  });
  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }
  if (result.status !== 0) {
    // GitHub runner can terminate a child with a signal and no JS exception.
    // Never log command arguments, environment variables or credentials.
    console.error("[FAIL] Isolated module child process", {
      binary: bin === process.execPath ? "node" : bin,
      exitStatus: result.status,
      signal: result.signal ?? "none",
    });
    process.exit(result.status ?? 1);
  }
}

function injectSuperappBridge(indexPath, moduleName) {
  let html = readFileSync(indexPath, 'utf8');
  if (html.includes('data-apois-superapp-bridge')) return;

  const bridge = `
<script data-apois-superapp-bridge>
(() => {
  const moduleName = ${JSON.stringify(moduleName)};
  const shellUrl = '../../index.html';
  const routeStorageKey = 'apois-superapp:last-route:' + moduleName;
  const authStorageKey = moduleName === 'corridas'
    ? 'apois-superapp-corridas-auth-v1'
    : 'apois-superapp-entregas-auth-v1';
  const authDeepLinkKey = 'apois-superapp:last-auth-deeplink';
  const corridasRecoveryKey = 'apois-superapp:corridas-recovery-url';
  const corridasGoogleForwardKey = 'apois-superapp:corridas-google-url';
  const entregasAuthForwardKey = 'apois-superapp:entregas-auth-url';
  const oauthPendingKey = 'apois-superapp:pending-oauth-product';
  const lastModuleKey = 'apois-superapp:last-module';
  const entregasGoogleForwardKey = 'apois-superapp:entregas-google-url';
  const oauthHandoffTtlMs = 120000;
  const appPlugin = window.Capacitor?.Plugins?.App;
  const browserPlugin = window.Capacitor?.Plugins?.Browser;
  if (moduleName === 'entregas') window.__APOIS_SUPERAPP_AUTH_BRIDGE__ = true;

  function currentRoute() {
    return window.location.hash || window.location.pathname || '/';
  }

  function persistRoute() {
    try {
      const route = currentRoute();
      if (route) localStorage.setItem(routeStorageKey, route);
    } catch {}
  }

  function clearPersistedRoute() {
    try { localStorage.removeItem(routeStorageKey); } catch {}
  }

  function hasPersistedSession() {
    try {
      const raw = localStorage.getItem(authStorageKey);
      if (!raw) return false;
      const parsed = JSON.parse(raw);
      return Boolean(parsed?.access_token || parsed?.currentSession?.access_token || parsed?.session?.access_token);
    } catch {
      try { localStorage.removeItem(authStorageKey); } catch {}
      return false;
    }
  }

  function isPublicRoute() {
    const route = currentRoute();
    const publicFragments = [
      '/login',
      '/register',
      '/cadastro',
      '/recuperar-senha',
      '/redefinir-senha',
      '/auth/callback',
    ];
    return route === '/' || route === '#' || route === '#/' || publicFragments.some((fragment) => route.includes(fragment));
  }

  function enforceSessionBoundary() {
    if (hasPersistedSession() || isPublicRoute()) return;
    clearPersistedRoute();
    if (moduleName === 'entregas') window.location.replace('#/login');
    else window.location.replace('./index.html#/login');
  }

  persistRoute();
  window.addEventListener('hashchange', persistRoute);
  window.addEventListener('pagehide', persistRoute);
  window.addEventListener('storage', (event) => {
    if (event.key === authStorageKey && !event.newValue) {
      clearPersistedRoute();
      enforceSessionBoundary();
    }
  });

  function returnToShell() {
    persistRoute();
    window.location.replace(shellUrl);
  }

  function parseAuthDeepLink(rawUrl) {
    const incoming = new URL(rawUrl);
    const path = incoming.pathname.replace(/^\\//, '');
    const params = new URLSearchParams(incoming.search);
    const fragment = incoming.hash.replace(/^#/, '');
    if (fragment) {
      const fragmentParams = new URLSearchParams(fragment);
      fragmentParams.forEach((value, key) => { if (!params.has(key)) params.set(key, value); });
    }
    return { path, params };
  }

  function suffixFromParams(params) {
    const query = params.toString();
    return query ? '?' + query : '';
  }

  function peekPendingOAuthProduct() {
    try {
      const stored = localStorage.getItem(oauthPendingKey);
      if (!stored) return null;
      const envelope = JSON.parse(stored);
      const age = Date.now() - Number(envelope?.createdAt);
      if (!['corridas', 'entregas'].includes(envelope?.product) || age < 0 || age > oauthHandoffTtlMs) {
        localStorage.removeItem(oauthPendingKey);
        return null;
      }
      return envelope.product;
    } catch {
      try { localStorage.removeItem(oauthPendingKey); } catch {}
      return null;
    }
  }

  function lastSelectedModule() {
    try {
      const value = localStorage.getItem(lastModuleKey);
      return value === 'corridas' || value === 'entregas' ? value : null;
    } catch {
      return null;
    }
  }

  function consumePendingOAuthProduct() {
    try {
      const stored = localStorage.getItem(oauthPendingKey);
      if (!stored) return null;
      const envelope = JSON.parse(stored);
      const age = Date.now() - Number(envelope?.createdAt);
      if (!['corridas', 'entregas'].includes(envelope?.product) || age < 0 || age > oauthHandoffTtlMs) {
        localStorage.removeItem(oauthPendingKey);
        return null;
      }
      localStorage.removeItem(oauthPendingKey);
      return envelope.product;
    } catch {
      try { localStorage.removeItem(oauthPendingKey); } catch {}
      return null;
    }
  }

  function storeCorridasGoogleCallback(rawUrl) {
    try {
      localStorage.setItem(corridasGoogleForwardKey, JSON.stringify({ url: rawUrl, createdAt: Date.now() }));
      return true;
    } catch {
      return false;
    }
  }

  function storeEntregasGoogleCallback(rawUrl) {
    try {
      localStorage.setItem(entregasGoogleForwardKey, JSON.stringify({ url: rawUrl, createdAt: Date.now() }));
      return true;
    } catch {
      return false;
    }
  }

  function routeAuthDeepLink(rawUrl) {
    if (typeof rawUrl !== 'string' || !rawUrl.startsWith('br.com.apois.app://auth/')) return false;
    try {
      const { path, params } = parseAuthDeepLink(rawUrl);

      if (moduleName === 'corridas') {
        // O callback genérico também é usado pelo Google de Corridas. Em alguns
        // aparelhos Android o WebView pode ser retomado sem o envelope OAuth
        // transitório, embora o módulo selecionado continue persistido. Nessa
        // situação não encaminhe o callback de Corridas para Entregas: deixe o
        // PassengerGoogleLoginButton trocar o PKCE no próprio cliente Corridas.
        if (path === 'callback') {
          const pendingProduct = peekPendingOAuthProduct();
          if (pendingProduct === 'corridas' || (!pendingProduct && lastSelectedModule() === 'corridas')) {
            return false;
          }
          if (pendingProduct === 'entregas') {
            try { sessionStorage.setItem(entregasAuthForwardKey, rawUrl); } catch {}
            window.location.replace('../entregas/index.html');
            return true;
          }
        }
        if (path === 'reset' || path === 'email-change') {
          try { sessionStorage.setItem(entregasAuthForwardKey, rawUrl); } catch {}
          window.location.replace('../entregas/index.html');
          return true;
        }
        return false;
      }

      try {
        const previous = sessionStorage.getItem(authDeepLinkKey);
        if (previous === rawUrl) return true;
        sessionStorage.setItem(authDeepLinkKey, rawUrl);
      } catch {}

      void browserPlugin?.close?.().catch(() => undefined);

      if (path === 'corridas-reset') {
        try { sessionStorage.setItem(corridasRecoveryKey, rawUrl); } catch {}
        window.location.replace('../corridas/index.html');
        return true;
      }
      if (path === 'callback') {
        const pendingProduct = peekPendingOAuthProduct();
        if (pendingProduct === 'corridas') {
          consumePendingOAuthProduct();
          if (storeCorridasGoogleCallback(rawUrl)) {
            void browserPlugin?.close?.().catch(() => undefined);
            window.location.replace('../corridas/index.html#/login');
            return true;
          }
        }
        if (pendingProduct === 'entregas') {
          consumePendingOAuthProduct();
          if (storeEntregasGoogleCallback(rawUrl)) {
            void browserPlugin?.close?.().catch(() => undefined);
            window.dispatchEvent(new CustomEvent('apois:entregas-google-callback', { detail: { url: rawUrl } }));
            return true;
          }
        }
      }
      if (path === 'email-change') {
        if (!params.has('next')) params.set('next', '/perfil/dados-pessoais');
        window.location.replace('#/auth/callback' + suffixFromParams(params));
        return true;
      }
      if (path === 'reset') {
        window.location.replace('#/redefinir-senha' + suffixFromParams(params));
        return true;
      }
      if (path === 'callback') {
        window.location.replace('#/auth/callback' + suffixFromParams(params));
        return true;
      }
    } catch (error) {
      console.error('[APOIS] Falha ao processar deep link no módulo', error);
    }
    return false;
  }

  if (appPlugin) {
    Promise.resolve(appPlugin.addListener('appUrlOpen', ({ url }) => {
      routeAuthDeepLink(url);
    })).catch(() => undefined);
    appPlugin.getLaunchUrl().then((result) => { if (result?.url) routeAuthDeepLink(result.url); }).catch(() => undefined);
    if (${moduleName === 'entregas'} && !window.location.hash.includes('/login')) {
      try {
        const forwardedAuthUrl = sessionStorage.getItem(entregasAuthForwardKey);
        if (forwardedAuthUrl) {
          sessionStorage.removeItem(entregasAuthForwardKey);
          routeAuthDeepLink(forwardedAuthUrl);
        }
      } catch {}
    }
    appPlugin.addListener('appStateChange', ({ isActive }) => {
      if (isActive) enforceSessionBoundary();
      else persistRoute();
    });
    appPlugin.addListener('backButton', ({ canGoBack }) => {
      const hash = window.location.hash || '';
      const moduleRootHashes = new Set(['', '#', '#/', '#/inicio', '#/login']);
      const atModuleRoot = moduleRootHashes.has(hash) || (!hash && !canGoBack);
      if (atModuleRoot) {
        returnToShell();
        return;
      }
      window.history.back();
    });
  }

  window.setTimeout(enforceSessionBoundary, 350);
})();
</script>`;

  html = html.includes('</body>') ? html.replace('</body>', `${bridge}\n</body>`) : `${html}\n${bridge}\n`;
  writeFileSync(indexPath, html);
  console.log(`[OK] ${moduleName}: bridge do Superapp injetado`);
}

let protectedCorridasMapRuntimeAfterVisual = null;

run(process.execPath, [resolve(root, 'scripts/prepare-workspace.mjs'), name]);
if (name === 'corridas') {
  // The pinned Corridas snapshot contains a protected historical .env. Never
  // let Vite load it: release configuration must come only from the explicit
  // CORRIDAS_* environment mapped below.
  run(process.execPath, [resolve(root, 'scripts/sanitize-corridas-workspace-env.mjs')]);
  run(process.execPath, [resolve(root, 'scripts/adapt-corridas-current.mjs')]);
  // Reconcile the existing historical storage isolation hardener with the
  // isolated Supabase auth key BEFORE history and favorites are used.
  // No new store: this is an already-versioned targeted hardener.
  run(process.execPath, [resolve(root, 'scripts/harden-corridas-superapp-storage.mjs')]);
} else {
  run(process.execPath, [resolve(root, 'scripts/adapt-module-for-superapp.mjs'), name]);
}
if (name === 'corridas') {
  run(process.execPath, [resolve(root, 'scripts/harden-corridas-backend-identity-boundary.mjs')]);
  run(process.execPath, [resolve(root, 'scripts/fix-report03-corridas-push-runtime-v1.mjs')]);
  run(process.execPath, [resolve(root, 'scripts/harden-corridas-cancellation-policy.mjs')]);
  run(process.execPath, [resolve(root, 'scripts/harden-corridas-ride-lifecycle.mjs')]);
  run(process.execPath, [resolve(root, 'scripts/harden-corridas-request-timeout.mjs')]);
  run(process.execPath, [resolve(root, 'scripts/harden-corridas-driver-eligibility-no-gateway.mjs')]);
  run(process.execPath, [resolve(root, 'scripts/harden-corridas-superapp-runtime.mjs')]);
  // Relatorio 08 / INV-057: accept a newer backend-confirmed driver cycle,
  // without removing foreign-ride, stale-update or terminal guards.
  run(process.execPath, [resolve(root, 'scripts/fix-report08-passenger-redispatch-v1.mjs')]);
  run(process.execPath, ['--test', resolve(root, 'scripts/qa/test-report08-passenger-redispatch-v1.test.mjs')]);
  // Report 1: GPS address must use a deployed and quota-gated reverse-geocoding route.
  run(process.execPath, [resolve(root, 'scripts/fix-corridas-reverse-geocode-live-v1.mjs')]);
  run(process.execPath, [resolve(root, 'scripts/fix-corridas-superapp-ui.mjs')]);
  run(process.execPath, [resolve(root, 'scripts/harden-corridas-oauth-callback-handoff.mjs')]);
  run(process.execPath, [resolve(root, 'scripts/harden-corridas-payment-methods.mjs')]);
  run(process.execPath, [resolve(root, 'scripts/harden-corridas-native-map.mjs')]);
  run(process.execPath, [resolve(root, 'scripts/harden-corridas-pickup-map-focus.mjs')]);
  run(process.execPath, [resolve(root, 'scripts/harden-client-live-ride-camera-v2.mjs')]);
  run(process.execPath, [resolve(root, 'scripts/verify-client-live-ride-camera-v2.mjs')]);
  run(process.execPath, [resolve(root, 'scripts/harden-corridas-pickup-address-display.mjs')]);
  run(process.execPath, [resolve(root, 'scripts/harden-corridas-destination-search-runtime.mjs')]);
  run(process.execPath, ['--test', resolve(root, 'scripts/qa/test-photon-autocomplete-retry-v1.mjs')]);

  const protectedMapRuntimePaths = [
    '.work/corridas/src/components/map/PassengerMap.tsx',
    '.work/corridas/src/services/google/google-maps-loader.ts',
    '.work/corridas/src/hooks/use-location.tsx',
    '.work/corridas/src/services/places/places-service.ts',
  ];
  const protectedMapRuntimeBeforeVisual = new Map(
    protectedMapRuntimePaths.map((path) => [path, readFileSync(resolve(root, path), 'utf8')]),
  );

  run(process.execPath, [resolve(root, 'scripts/harden-apois-client-red-visual.mjs')]);
  run(process.execPath, [resolve(root, 'scripts/harden-corridas-kit-visual.mjs')]);
  run(process.execPath, [resolve(root, 'scripts/harden-corridas-category-recovery.mjs')]);
  run(process.execPath, [resolve(root, 'scripts/harden-corridas-save-favorites-in-search.mjs')]);
  // Client destination search: show provider/network errors and reattempt suggestions without changing maps or ride actions.
  run(process.execPath, [resolve(root, 'scripts/fix-corridas-passenger-destination-suggestions-v2.mjs')]);
  run(process.execPath, [resolve(root, 'scripts/verify-corridas-passenger-destination-suggestions-v2.mjs')]);
  run(process.execPath, [resolve(root, 'scripts/verify-corridas-compact-home-favorites.mjs')]);
  run(process.execPath, [resolve(root, 'scripts/verify-corridas-destination-pickup-contrast.mjs')]);
  run(process.execPath, [resolve(root, 'scripts/verify-corridas-category-recovery.mjs')]);
  run(process.execPath, [resolve(root, 'scripts/harden-corridas-trip-flow-ux.mjs')]);
  run(process.execPath, [resolve(root, 'scripts/harden-corridas-pickup-timeout-v1.mjs')]);
  run(process.execPath, [resolve(root, 'scripts/verify-corridas-pickup-retry-v1.mjs')]);
  run(process.execPath, [resolve(root, 'scripts/harden-corridas-stops-confirm-display.mjs')]);
  run(process.execPath, [resolve(root, 'scripts/verify-corridas-stops-confirm-display.mjs')]);
  run(process.execPath, [resolve(root, 'scripts/harden-corridas-android-footer-safe-area.mjs')]);
  run(process.execPath, [resolve(root, 'scripts/verify-corridas-android-footer-safe-area.mjs')]);
  // Physical Android QA: only Profile pins the outer WebView shell so the bottom
  // tabs cannot scroll upward with the document. Ride/map routes stay unchanged.
  run(process.execPath, [resolve(root, 'scripts/fix-corridas-profile-viewport-v1.mjs')]);
  run(process.execPath, [resolve(root, 'scripts/verify-corridas-profile-viewport-v1.mjs')]);
  run(process.execPath, [resolve(root, 'scripts/restore-corridas-wallet-screen.mjs')]);
  run(process.execPath, [resolve(root, 'scripts/verify-corridas-wallet-screen.mjs')]);
  // O tema do Perfil ja esta no pipeline; aplicar somente os handlers seguros.
  // Rodar o antigo script completo duas vezes duplica profileAvatarUrl.
  run(process.execPath, [resolve(root, 'scripts/harden-corridas-profile-actions.mjs')]);
  run(process.execPath, [resolve(root, 'scripts/harden-corridas-profile-edit.mjs')]);
  run(process.execPath, [resolve(root, 'scripts/harden-corridas-profile-account-deletion.mjs')]);
  run(process.execPath, [resolve(root, 'scripts/harden-corridas-signup-neutral-feedback.mjs')]);
  run(process.execPath, [resolve(root, 'scripts/harden-corridas-password-recovery.mjs')]);
  run(process.execPath, [resolve(root, 'scripts/harden-corridas-email-confirmation-return-v1.mjs')]);
  // Profile identity hardener is required before wallet history and cancellation-fee consumers.
  run(process.execPath, [resolve(root, 'scripts/harden-corridas-auth-profile-resolution.mjs')]);
  run(process.execPath, [resolve(root, 'scripts/verify-corridas-profile-edit.mjs')]);
  run(process.execPath, [resolve(root, 'scripts/restore-corridas-history-screen.mjs')]);
  run(process.execPath, [resolve(root, 'scripts/verify-corridas-history-screen.mjs')]);
  run(process.execPath, [resolve(root, 'scripts/harden-corridas-driver-accept-pin-visibility.mjs')]);

  run(process.execPath, [resolve(root, 'scripts/verify-corridas-driver-accept-pin-visibility.mjs')]);

  for (const [path, before] of protectedMapRuntimeBeforeVisual) {
    const after = readFileSync(resolve(root, path), 'utf8');
    if (after !== before) {
      console.error(`[FAIL] migração visual alterou runtime protegido do mapa: ${path}`);
      process.exit(1);
    }
  }
  // Intentional QA GPS correction AFTER visual byte-integrity verification.
  // The check above ensures visual migration itself never touches Maps/GPS.
  // Snapshot below treats this small functional correction as the new baseline.
  run(process.execPath, [resolve(root, 'scripts/fix-corridas-current-gps-fallback-v1.mjs')]);
  // Relatório 12 / INV-064–065: after original visual safety check,
  // patch only the prepared Corridas workspace, then snapshot intentional map changes.
  run(process.execPath, [resolve(root, 'scripts/fix-report12-destination-map-v1.mjs')]);
  run(process.execPath, ['--test', resolve(root, 'scripts/qa/test-report12-map-selection-v1.test.mjs')]);
  run(process.execPath,[resolve(root,'scripts/fix-corridas-client-qa169-video-v1.mjs')]);
  run(process.execPath,['--test',resolve(root,'scripts/qa/test-corridas-client-qa169-video-v1.test.mjs')]);
  // QA217: intentional Passenger map behavior, before protected post-visual baseline.
  run(process.execPath,[resolve(root,'scripts/fix-corridas-passenger-map-qa217-v1.mjs')]);
  // Relatório 13 / INV-066: valid destination/stop must not depend on local
  // recent-history write; favorites must confirm actual storage success.
  run(process.execPath, [resolve(root, 'scripts/fix-report13-destination-history-v1.mjs')]);
  run(process.execPath, ['--test', resolve(root, 'scripts/qa/test-report13-destination-history-v1.test.mjs')]);
  protectedCorridasMapRuntimeAfterVisual = new Map(
    protectedMapRuntimePaths.map((path) => [path, readFileSync(resolve(root, path), 'utf8')]),
  );
  console.log('[OK] Corridas: migração visual preservou byte a byte Maps/GPS/Places');
  run(process.execPath, [resolve(root, 'scripts/fix-corridas-ride-comfort-preferences-v1.mjs')]);
  run(process.execPath, [resolve(root, 'scripts/fix-corridas-client-comfort-finish-v2.mjs')]);
  run(process.execPath, [resolve(root, 'scripts/verify-corridas-ride-comfort-v1.mjs')]);
  run(process.execPath, [resolve(root, 'scripts/verify-corridas-client-comfort-finish-v2.mjs')]);
  run(process.execPath, [resolve(root, 'scripts/harden-corridas-case-center-v1.mjs')]);
  run(process.execPath, [resolve(root, 'scripts/verify-apois-vehicle-incidents-v1.mjs'), 'corridas']);
  // Android físico QA165: ações de suporte/cancelamento não podem cobrir os dados da corrida.
  run(process.execPath, ['--test', resolve(root, 'scripts/qa/test-corridas-ride-footer-layout-v1.test.mjs')]);
  run(process.execPath, [resolve(root, 'scripts/verify-corridas-dispatch-ux-v1.mjs')]);
  run(process.execPath, [resolve(root, 'scripts/verify-corridas-auth-wallet-domain-v2.mjs')]);
  // Relatório 09 / INV-058–060: geração de preço e coerência na confirmação.
  run(process.execPath, [resolve(root, 'scripts/fix-report09-pricing-checkout-v1.mjs')]);
  run(process.execPath, ['--test', resolve(root, 'scripts/qa/test-report09-pricing-checkout-v1.test.mjs')]);
  // Physical Android QA: GPS jitter must not invalidate a priced itinerary;
  // real route or stop changes still require official backend repricing.
  run(process.execPath, [resolve(root, 'scripts/fix-corridas-ride-gps-stability-v1.mjs')]);
  run(process.execPath, ['--test', resolve(root, 'scripts/qa/test-corridas-ride-gps-stability-v1.test.mjs')]);
  // CV-016/017: visual-only last-mile presentation on the transformed Corridas workspace.
  // RV-09 / CV-027: Passenger deletion dialog already mounted by its existing hardener.
  // Apply only the focus/isolation layer; never change the deletion RPC or auth.
  run(process.execPath, [resolve(root, 'scripts/fix-apois-account-deletion-visual09-v1.mjs'), 'passageiro']);
  run(process.execPath, ['--test', resolve(root, 'scripts/qa/test-apois-account-deletion-visual09-v1.test.mjs')]);
  for (const [relative, marker] of [
    ['src/components/profile/PassengerAccountDeletion.tsx', 'APOIS_CV09_PASSENGER_DELETION_DIALOG_V1'],
    ['src/lib/useApoisDeletionDialogFocus.ts', 'APOIS_CV09_DELETION_FOCUS_V1'],
  ]) {
    if (!readFileSync(resolve(root, '.work/corridas', relative), 'utf8').includes(marker))
      throw new Error('[FAIL] CV09 Passenger deletion focus not mounted: ' + relative);
  }
  // VIS-019 is documented for future authorized engineering review; the 3200ms timer is immutable here.
  run(process.execPath, [resolve(root, 'scripts/fix-corridas-visual04-passenger-v1.mjs')]);
  run(process.execPath, ['--test', resolve(root, 'scripts/qa/test-corridas-visual04-passenger-v1.test.mjs')]);
  // RV-11 CV-035: Passenger-only notification read/unread accessible text.
  // Existing markAsRead, counts, Motorista notifications, and hydration untouched.
  run(process.execPath, [resolve(root,'scripts/fix-corridas-notification-visual11-v1.mjs')]);
  run(process.execPath, ['--test', resolve(root,'scripts/qa/test-corridas-notification-visual11-v1.test.mjs')]);
  if(!readFileSync(resolve(root,'.work/corridas/src/routes/_authenticated.notificacoes.tsx'),'utf8').includes('APOIS_CV11_PASSENGER_NOTIFICATION_READ_V1'))
    throw Error('[FAIL] RV11 Passenger notification readable state missing');
  // RV-14: initial loading and reconnect messages, on disposable Passenger UI only.
  run(process.execPath, [resolve(root,'scripts/fix-corridas-active-ride-visual14-v1.mjs')]);
  run(process.execPath, ['--test', resolve(root,'scripts/qa/test-corridas-active-ride-visual14-v1.test.mjs')]);
  for(const [rel,marker] of [
    ['src/routes/_authenticated.corrida.$rideId.tsx','APOIS_CV14_PASSENGER_LOADING_V1'],
    ['src/components/rides/active/RideStatusHeader.tsx','APOIS_CV14_RIDE_STATUS_WRAP_V1'],
  ]) if(!readFileSync(resolve(root,'.work/corridas',rel),'utf8').includes(marker))
    throw Error('[FAIL] RV14 Passenger visual missing '+rel);
   // Passenger rating after a finished ride uses existing rate_passenger_ride RPC;
   // the frontend does not change RLS, payment, ride state or protected submodules.
   run(process.execPath, [resolve(root, 'scripts/connect-corridas-passenger-driver-rating-v1.mjs')]);
   run(process.execPath, ['--test', resolve(root, 'scripts/qa/test-corridas-passenger-driver-rating-v1.test.mjs')]);
   // QA215: physical Passenger address flicker after a completed trip; isolated module only.
   run(process.execPath, [resolve(root, 'scripts/fix-corridas-passenger-qa215-pickup-address-v1.mjs')]);
   run(process.execPath, ['--test', resolve(root, 'scripts/qa/test-corridas-passenger-qa215-pickup-address-v1.test.mjs')]);
   // Android OS reverse-geocoder recovery only when Supabase address lookup fails.
   // Keep pinned sources, ride coordinates, native Maps and payments unchanged.
   run(process.execPath, [resolve(root, 'scripts/fix-corridas-native-geocoder-recovery-v1.mjs')]);
   run(process.execPath, ['--test', resolve(root, 'scripts/qa/test-corridas-native-geocoder-v1.test.mjs')]);
   // QA215 Android safe area for completed ride; do not change rating/skip RPC.
   run(process.execPath, [resolve(root, 'scripts/fix-corridas-passenger-qa215-completed-safe-area-v1.mjs')]);
   run(process.execPath, ['--test', resolve(root, 'scripts/qa/test-corridas-passenger-qa215-completed-safe-area-v1.test.mjs')]);
   // QA216: patch only generated Corridas; keep source pins and other modules.
   run(process.execPath, [resolve(root, 'scripts/fix-corridas-passenger-profile-qa216-v1.mjs')]);
   run(process.execPath, ['--test', resolve(root, 'scripts/qa/test-corridas-passenger-profile-qa216-v1.test.mjs')]);
   // QA217: backend route ETA and home distance/presence only on Passenger.
   run(process.execPath,[resolve(root,'scripts/fix-corridas-passenger-eta-qa217-v1.mjs')]);
   run(process.execPath,[resolve(root,'scripts/fix-corridas-passenger-home-qa217-v1.mjs')]);
   run(process.execPath,['--test',resolve(root,'scripts/qa/test-corridas-passenger-map-qa217-v1.test.mjs')]);
  // RV-15: restore scoped public-form placeholder contrast, then only user-facing
  // auth error copy and field accessibility on disposable Corridas; do not change
  // password predicates, Supabase callback/session logic or email submission.
  run(process.execPath, [resolve(root, 'scripts/fix-corridas-public-form-contrast-v1.mjs')]);
  console.log("[DIAG] Starting RV15 public auth transform");
  run(process.execPath, [resolve(root, 'scripts/fix-corridas-auth-visual15-v1.mjs')]);
  console.log("[DIAG] RV15 public auth transform finished");
  run(process.execPath, ['--test', resolve(root, 'scripts/qa/test-corridas-auth-visual15-v1.test.mjs')]);
  console.log("[DIAG] RV15 auth tests finished");
  for(const rel of ['src/routes/_public.recuperar-senha.tsx','src/routes/_public.redefinir-senha.tsx']){
    const generated=readFileSync(resolve(root,'.work/corridas',rel),'utf8');
    if(!generated.includes('APOIS_CV15_AUTH_FEEDBACK_ACCESSIBILITY_V1') ||
       !generated.includes('data-apois-corridas-public-form-contrast-v1'))
      throw Error('[FAIL] RV15 Passenger auth visual missing '+rel);
  }
  for (const [relative, marker] of [
    ['src/routes/_authenticated.buscar-destino.tsx', 'data-apois-visual04-clear-search-v1'],
    ['src/routes/_authenticated.revisar-solicitacao.tsx', 'APOIS_VISUAL04_REVIEW_DETAILS_V1'],
  ]) {
    const path = resolve(root, '.work/corridas', relative);
    if (!readFileSync(path, 'utf8').includes(marker)) {
      throw new Error('[FAIL] CV04 Corridas visual missing ' + marker + ' in ' + relative);
    }
  }
}
if (name === 'entregas') {
  run(process.execPath, [resolve(root, 'scripts/harden-entregas-supabase-runtime.mjs')]);
  run(process.execPath, [resolve(root, 'scripts/install-entregas-current-db-types-v1.mjs')]);
  run(process.execPath, ['--test', resolve(root, 'scripts/qa/test-entregas-generated-types-v1.test.mjs')]);
  run(process.execPath, [resolve(root, 'scripts/harden-entregas-support-legacy-route.mjs')]);
  run(process.execPath, [resolve(root, 'scripts/fix-entregas-support-ticket-detail-v1.mjs')]);
  run(process.execPath, [resolve(root, 'scripts/harden-entregas-merchant-image-mime.mjs')]);
  // Report 1: replace fixed 100vh with dynamic mobile viewport before route transforms.
  run(process.execPath, [resolve(root, 'scripts/harden-entregas-superapp-viewport.mjs')]);
  run(process.execPath, ['--test', resolve(root, 'scripts/qa/test-entregas-viewport-v1.test.mjs')]);
  run(process.execPath, [resolve(root, 'scripts/harden-entregas-superapp-auth-runtime.mjs')]);
  run(process.execPath, [resolve(root, 'scripts/fix-entregas-hash-auth-callbacks.mjs')]);
  run(process.execPath, [resolve(root, 'scripts/harden-apois-entregas-email-auth-v1.mjs')]);
  run(process.execPath, [resolve(root, 'scripts/harden-entregas-google-oauth-handoff.mjs')]);
  run(process.execPath, [resolve(root, 'scripts/neutralize-entregas-superapp-legacy.mjs')]);
  run(process.execPath, [resolve(root, 'scripts/harden-entregas-auto-address-cep-v1.mjs')]);
  run(process.execPath, [resolve(root, 'scripts/verify-entregas-auto-address-cep-v1.mjs')]);
  run(process.execPath, [resolve(root, 'scripts/harden-entregas-personal-data-light-v1.mjs')]);
  run(process.execPath, [resolve(root, 'scripts/harden-entregas-location-identified-state.mjs')]);
  run(process.execPath, [resolve(root, 'scripts/fix-entregas-checkout-coverage-diagnostic.mjs')]);
  // Public Cliente Entregas must not expose active QA/integration fixtures as real catalog entries.
  run(process.execPath, [resolve(root, 'scripts/restore-entregas-customer-production-data-v1.mjs')]);
  run('bun', ['test', resolve(root, 'scripts/qa/test-entregas-customer-real-catalog-v1.test.ts')]);
  run(process.execPath, [resolve(root, 'scripts/fix-entregas-customer-delivery-tracking-v1.mjs')]);
  run(process.execPath, [resolve(root, 'scripts/fix-entregas-customer-order-reviews-v1.mjs')]);
  run(process.execPath, [resolve(root, 'scripts/test-entregas-review-to-one-v1.mjs')]);
  run(process.execPath, [resolve(root, 'scripts/fix-entregas-post-order-home-v1.mjs')]);
  run(process.execPath, [resolve(root, 'scripts/fix-entregas-merchant-order-review-v1.mjs')]);
  run(process.execPath, [resolve(root, 'scripts/fix-entregas-login-cta-contrast-v1.mjs')]);
  run(process.execPath, [resolve(root, 'scripts/fix-entregas-admin-coverage-consistency-v2.mjs')]);
  run(process.execPath, [resolve(root, 'scripts/fix-entregas-search-results-v2.mjs')]);
  run(process.execPath, [resolve(root, 'scripts/fix-entregas-customer-orders-pagination-v1.mjs')]);
  run(process.execPath, [resolve(root, 'scripts/fix-entregas-coupon-metrics-v2.mjs')]);
  run(process.execPath, [resolve(root, 'scripts/fix-entregas-merchant-hours-24h-v2.mjs')]);
  run(process.execPath, [resolve(root, 'scripts/fix-entregas-cart-price-refresh-v2.mjs')]);
  run(process.execPath, [resolve(root, 'scripts/fix-entregas-login-accessibility-v2.mjs')]);
  run(process.execPath, [resolve(root, 'scripts/restore-entregas-auto-promotions-v3.mjs')]);
  run(process.execPath, [resolve(root, 'scripts/connect-entregas-auto-promotions-v3.mjs')]);
  run(process.execPath, [resolve(root, 'scripts/connect-entregas-merchant-order-status-v3.mjs')]);
  run(process.execPath, [resolve(root, 'scripts/fix-entregas-persisted-cart-validation-v3.mjs')]);
  run(process.execPath, [resolve(root, 'scripts/fix-entregas-merchant-assets-v1.mjs')]);
  run(process.execPath, [resolve(root, 'scripts/fix-entregas-merchant-product-image-reconciliation-v1.mjs')]);
  run(process.execPath, [resolve(root, 'scripts/fix-entregas-customer-avatar-cache-v1.mjs')]);
  // CV-019/020: late UI-only order timeline captions and accessible steps.
  // Preserve realtime, payment_status, order transitions, PIN, delivered banner and map.
  run(process.execPath, [resolve(root, 'scripts/fix-entregas-order-timeline-visual05-v1.mjs')]);
  run(process.execPath, ['--test', resolve(root, 'scripts/qa/test-entregas-order-timeline-visual05-v1.test.mjs')]);
  const cv05OrderRoute = readFileSync(resolve(root, '.work/entregas/src/routes/pedido/$orderId/index.tsx'), 'utf8');
  for (const marker of [
    'APOIS_VISUAL05_ORDER_TIMELINE_V1',
    'data-apois-cv05-order-stage-message',
    'data-apois-cv05-order-steps',
    'role="status" aria-live="polite"',
  ]) {
    if (!cv05OrderRoute.includes(marker)) throw new Error('[FAIL] CV05 Entregas missing ' + marker);
  }
  // RV-10 CV-029 / VIS-030: semantic product option buttons only, after
  // safe-area/image fallback, cart/checkout/payment hardeners and other visuals.
  // CV-030 / VIS-031 is not applicable under the pinned NOT NULL max contract.
  run(process.execPath, [resolve(root, 'scripts/fix-entregas-product-customization-visual10-v1.mjs')]);
  run(process.execPath, ['--test', resolve(root, 'scripts/qa/test-entregas-product-customization-visual10-v1.test.mjs')]);
  if (!readFileSync(resolve(root, '.work/entregas/src/components/ProductCustomizationSheet.tsx'), 'utf8').includes('APOIS_CV10_PRODUCT_CUSTOMIZATION_ACCESSIBILITY_V1')) {
    throw new Error('[FAIL] CV10 options must be native accessible buttons');
  }
  // Restore the pinned Cliente Entregas visual dependency chain before RV11/RV13.
  // These transforms affect .work/entregas only; do not mutate source-lock or submodules.
  for (const visualScript of [
    'harden-entregas-superapp-brand-assets.mjs',
    'harden-entregas-customer-light-v4.mjs',
    'harden-entregas-customer-current-visual-v5.mjs',
    'harden-entregas-customer-current-visual-v6.mjs',
    'harden-entregas-customer-contrast-v7.mjs',
    'harden-entregas-customer-address-visual-v8.mjs',
  ]) run(process.execPath, [resolve(root, 'scripts', visualScript)]);
  // RV-11: last scoped Entregas presentation layers, after V11 and prior visual/checkout hardeners.
  // No address persistence, API, payment, auth or geocoding contract is modified.
  run(process.execPath, [resolve(root, 'scripts/fix-entregas-labels-visual11-v1.mjs')]);
  run(process.execPath, [resolve(root, 'scripts/fix-entregas-address-catalog-visual11-v1.mjs')]);
  // V11's CEP tests and canonical UF persistence require the V9 normalizer.
  // Reconcile it only in .work/entregas; the pinned source remains untouched.
  run(process.execPath, [resolve(root, 'scripts/harden-entregas-customer-address-uf-v9.mjs')]);
  // CV11 depends on the async V11 latest-request guard in the disposable Entregas workspace.
  // Preserve this guard and its behavioural tests before adding visual feedback.
  run(process.execPath, [resolve(root, 'scripts/harden-entregas-address-async-v11.mjs')]);
  run(process.execPath, ['--test', resolve(root, 'scripts/qa/test-entregas-address-async-v3.mjs')]);
  for (const rel of ['src/components/CustomerLocationAddressSelector.tsx', 'src/routes/enderecos/novo.tsx']) {
    const generated = readFileSync(resolve(root, '.work/entregas', rel), 'utf8');
    if (!generated.includes('APOIS_ADDRESS_ASYNC_V11')) throw Error('[FAIL] CV11 requires async V11: ' + rel);
  }
  run(process.execPath, [resolve(root, 'scripts/fix-entregas-autocomplete-visual11-v1.mjs')]);
  run(process.execPath, ['--test', resolve(root, 'scripts/qa/test-entregas-visual11-v1.test.mjs')]);
  for(const [rel,marker] of [
    ['src/routes/enderecos.tsx','APOIS_CV11_ADDRESS_CARD_V1'],
    ['src/routes/register.tsx','APOIS_CV11_REGISTER_FIELDS_V1'],
    ['src/components/CustomerLocationAddressSelector.tsx','APOIS_CV11_AUTOCOMPLETE_FEEDBACK_V1'],
    ['src/routes/estabelecimento.$merchantId.tsx','APOIS_CV11_CATALOG_V1'],
  ]) if (!readFileSync(resolve(root,'.work/entregas',rel),'utf8').includes(marker)) throw Error('[FAIL] RV11 Entregas missing '+rel);
  // RV-12: operational Merchant/Admin visual overlays after existing coupon V2 and review generator.
  // No order writes, gateway changes or new data queries; source checkout remains pinned.
  run(process.execPath, [resolve(root, 'scripts/fix-entregas-merchant-options-visual12-v1.mjs')]);
  run(process.execPath, [resolve(root, 'scripts/fix-entregas-merchant-coupons-image-visual12-v1.mjs')]);
  run(process.execPath, [resolve(root, 'scripts/fix-entregas-admin-visual12-v1.mjs')]);
  run(process.execPath, ['--test', resolve(root, 'scripts/qa/test-entregas-visual12-v1.test.mjs')]);
  for (const [rel,marker] of [
    ['src/routes/merchant.tsx','APOIS_CV12_MERCHANT_ORDER_OPTIONS_V1'],
    ['src/components/MerchantCouponsPanel.tsx','APOIS_CV12_COUPON_STATES_V1'],
    ['src/components/MerchantProductEditor.tsx','APOIS_CV12_PRODUCT_IMAGE_KEYBOARD_V1'],
    ['src/components/AdminOrdersPanel.tsx','APOIS_CV12_ADMIN_ORDERS_V1'],
  ]) if (!readFileSync(resolve(root, '.work/entregas',rel),'utf8').includes(marker))
    throw Error('[FAIL] RV12 Entregas missing '+rel);
  // RV13 requires the existing modal/sheet z-index guard above the client footer.
  run(process.execPath, [resolve(root, 'scripts/harden-entregas-overlay-layering.mjs')]);
  // RV-13: after RV-12, patch only disposable shared UI components.
  // Preserve source snapshots, routing/callbacks, Radix focus and validation.
  run(process.execPath, [resolve(root, 'scripts/fix-entregas-shared-visual13-v1.mjs')]);
  run(process.execPath, ['--test', resolve(root, 'scripts/qa/test-entregas-shared-visual13-v1.test.mjs')]);
  for (const [rel, marker] of [
    ['src/components/AppBottomNav.tsx', 'APOIS_CV13_SHARED_COMPONENTS_V1'],
    ['src/components/ui/dialog.tsx', 'APOIS_CV13_SHARED_COMPONENTS_V1'],
    ['src/components/ui/prompt-dialog.tsx', 'APOIS_CV13_SHARED_COMPONENTS_V1'],
  ]) if (!readFileSync(resolve(root, '.work/entregas', rel), 'utf8').includes(marker))
    throw Error('[FAIL] RV13 Entregas shared visual missing ' + rel);
  // RV-16: presentational scope/recency disclosures on the disposable Entregas copy.
  // Keep Pix manual, financial calculations, queries, RLS, realtime and map eligibility untouched.
  run(process.execPath, [resolve(root, 'scripts/fix-entregas-finance-scope-visual16-v1.mjs')]);
  run(process.execPath, ['--test', resolve(root, 'scripts/qa/test-entregas-finance-scope-visual16-v1.test.mjs')]);
  for (const rel of [
    'src/components/MerchantCourierSettlementsPanel.tsx',
    'src/components/AdminCourierSettlementsPanel.tsx',
    'src/components/AdminReviewsPanel.tsx',
    'src/components/AdminRealtimeOperationsPanel.tsx',
  ]) if (!readFileSync(resolve(root, '.work/entregas',rel),'utf8').includes('APOIS_CV16_SCOPE_AND_LOCATION_COMMUNICATION_V1'))
    throw Error('[FAIL] RV16 scope/recency visual missing '+rel);
  // RV-17: only generated Merchant editor, reviews and support. Preserve all data writes/RPCs.
  run(process.execPath, [resolve(root, 'scripts/fix-entregas-menu-forms-visual17-v1.mjs')]);
  run(process.execPath, ['--test', resolve(root, 'scripts/qa/test-entregas-menu-forms-visual17-v1.test.mjs')]);
  for(const [rel,marker] of [
    ['src/components/MerchantProductEditor.tsx','APOIS_CV17_PRODUCT_EDITOR_V1'],
    ['src/routes/pedido/$orderId/avaliar.tsx','APOIS_CV17_REVIEW_LABELS_V1'],
    ['src/routes/perfil/ajuda.tsx','APOIS_CV17_HELP_REQUIREMENTS_V1'],
  ]) if(!readFileSync(resolve(root,'.work/entregas',rel),'utf8').includes(marker))
    throw Error('[FAIL] RV17 Entregas forms missing '+rel);
  run(process.execPath, [resolve(root, 'scripts/verify-apois-report02-integrity-v1.mjs'), 'entregas']);
}

const config = manifest.modules[name];
const cwd = resolve(root, config.workspace);
const env = { ...process.env, ...(config.env ?? {}) };

if (name === 'corridas') {
  const corridasUrl = process.env.CORRIDAS_VITE_SUPABASE_URL;
  const corridasKey = process.env.CORRIDAS_VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!corridasUrl || !corridasKey) {
    console.error('[FAIL] corridas: variáveis CORRIDAS_VITE_SUPABASE_* ausentes');
    process.exit(1);
  }
  env.VITE_SUPABASE_URL = corridasUrl;
  env.VITE_SUPABASE_PUBLISHABLE_KEY = corridasKey;
  env.VITE_APOIS_SUPERAPP_RIDES_PUSH_ENABLED = process.env.APOIS_SUPERAPP_RIDES_PUSH_ENABLED === '1' ? '1' : '0';

  const publicAppUrl = process.env.CORRIDAS_PUBLIC_APP_URL?.trim();
  if (publicAppUrl) env.VITE_PUBLIC_APP_URL = publicAppUrl;
  else delete env.VITE_PUBLIC_APP_URL;

  console.log(
    env.VITE_APOIS_SUPERAPP_RIDES_PUSH_ENABLED === '1'
      ? '[OK] corridas: push FCM do Superapp explicitamente habilitado'
      : '[INFO] corridas: push FCM mantido isolado; Realtime + polling seguem ativos',
  );

  const webMapsKey = process.env.CORRIDAS_WEB_MAPS_API_KEY?.trim();
  if (webMapsKey) {
    env.VITE_GOOGLE_MAPS_API_KEY = webMapsKey;
    console.log('[OK] corridas: Google Maps JavaScript/Places key aplicada ao bundle');
  } else {
    delete env.VITE_GOOGLE_MAPS_API_KEY;
    console.warn('[WARN] corridas: CORRIDAS_WEB_MAPS_API_KEY ausente; mapa web será homologado após configuração');
  }

  const androidMapsKey = process.env.CORRIDAS_ANDROID_MAPS_API_KEY?.trim();
  if (androidMapsKey) {
    env.VITE_GOOGLE_MAPS_NATIVE_API_KEY = androidMapsKey;
    console.log('[OK] corridas: Google Maps Android key disponível para o mapa nativo');
  } else {
    delete env.VITE_GOOGLE_MAPS_NATIVE_API_KEY;
    console.warn('[WARN] corridas: CORRIDAS_ANDROID_MAPS_API_KEY ausente; mapa nativo será homologado após configuração');
  }

  console.log('[OK] corridas: ambiente Supabase isolado aplicado');
}

if (name === 'entregas') {
  const requestedEntregasUrl = process.env.ENTREGAS_VITE_SUPABASE_URL?.trim().replace(/\/$/, '');
  if (requestedEntregasUrl && requestedEntregasUrl !== ENTREGAS_CANONICAL_URL) {
    console.error(`[FAIL] entregas: ENTREGAS_VITE_SUPABASE_URL deve apontar para ${ENTREGAS_CANONICAL_REF}; recebido ${requestedEntregasUrl}`);
    process.exit(1);
  }
  const requestedEntregasKey = process.env.ENTREGAS_VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
  const entregasPublishableKey = requestedEntregasKey || ENTREGAS_CANONICAL_PUBLISHABLE_KEY;
  if (!entregasPublishableKey.startsWith('sb_publishable_')) {
    console.error('[FAIL] entregas: publishable key do projeto canônico é inválida');
    process.exit(1);
  }
  env.VITE_SUPABASE_URL = ENTREGAS_CANONICAL_URL;
  env.VITE_SUPABASE_PUBLISHABLE_KEY = entregasPublishableKey;
  // Entregas tracking uses a browser/WebView key (not a native Android key).
  // Keep keys separate from Corridas. Billing/API restrictions remain enforced by Google.
  const entregasMapsKey = process.env.ENTREGAS_WEB_MAPS_API_KEY?.trim();
  const entregasMapId = process.env.ENTREGAS_GOOGLE_MAPS_MAP_ID?.trim();
  if (entregasMapsKey && entregasMapId) {
    env.VITE_GOOGLE_MAPS_BROWSER_KEY = entregasMapsKey;
    env.VITE_GOOGLE_MAPS_MAP_ID = entregasMapId;
    console.log('[OK] entregas: browser tracking map configuration supplied');
  } else {
    delete env.VITE_GOOGLE_MAPS_BROWSER_KEY;
    delete env.VITE_GOOGLE_MAPS_MAP_ID;
    console.warn('[WARN] entregas: tracking map disabled until a valid browser key and map ID are configured');
  }

  console.log(`[OK] entregas: Supabase canônico aplicado ao bundle (${ENTREGAS_CANONICAL_REF})`);

  env.VITE_APOIS_SUPERAPP_PUSH_ENABLED = process.env.FIREBASE_SUPERAPP_GOOGLE_SERVICES_JSON_BASE64?.trim()
    ? '1'
    : '0';
  console.log(
    env.VITE_APOIS_SUPERAPP_PUSH_ENABLED === '1'
      ? '[OK] entregas: push do Superapp habilitado para este build'
      : '[INFO] entregas: push do Superapp mantido desabilitado até Firebase ser configurado',
  );
}

// INV-012: customer Superapp must be as reproducible as the merchant panel.
// The pinned Entregas snapshot is currently missing two Capacitor login packages
// from bun.lock; fail closed instead of silently producing a different APK.
if (name === 'entregas') {
  if (JSON.stringify(config.install) !== JSON.stringify(['bun', 'install', '--frozen-lockfile'])) {
    console.error('[FAIL] INV-012: Entregas install must use bun --frozen-lockfile.');
    process.exit(1);
  }
  run(process.execPath, [resolve(root, 'scripts/reconcile-entregas-bun-lock-v1.mjs')], { cwd: root, env });
  run(process.execPath, [resolve(root, 'scripts/verify-entregas-bun-lock-v1.mjs')], { cwd: root, env });
  run(process.execPath, ['--test', resolve(root, 'scripts/qa/test-entregas-bun-overlay-v1.test.mjs')], { cwd: root, env });
  run(process.execPath, ['--test', resolve(root, 'scripts/qa/test-entregas-bun-lock-v1.test.mjs')], { cwd: root, env });
  run(process.execPath, ['--test', resolve(root, 'scripts/qa/test-entregas-report02-transforms-v1.test.mjs')], { cwd: root, env });
}
for (const command of [config.install, config.build]) {
  const [bin, ...args] = command;
  run(bin, args, { cwd, env });
  if (name === 'corridas' && command === config.install) {
    run(process.execPath, ['--test', resolve(root, 'scripts/qa/test-corridas-reverse-geocode-live-v1.test.mjs')], { cwd: root, env });
  }
  if (name === 'corridas' && command === config.build) {
    // TanStack generates file-route type definitions during Vite build.
    // Enforce the same strict typecheck immediately afterward, never skip it.
    run('bun', ['run', 'typecheck'], { cwd, env });
  }
}

if (name === 'corridas' && protectedCorridasMapRuntimeAfterVisual) {
  for (const [path, before] of protectedCorridasMapRuntimeAfterVisual) {
    const after = readFileSync(resolve(root, path), 'utf8');
    if (after !== before) {
      console.error(`[FAIL] pipeline pós-visual alterou runtime protegido do mapa: ${path}`);
      process.exit(1);
    }
  }
  console.log('[OK] Corridas: build final preservou byte a byte Maps/GPS/Places');
}

if (config.render) {
  const [bin, ...args] = config.render.server;
  const serverEnv = { ...env, HOST: config.render.host, PORT: String(config.render.port) };
  const server = spawn(bin, args, { cwd, env: serverEnv, stdio: ['ignore', 'pipe', 'pipe'] });
  let logs = '';
  server.stdout?.on('data', (chunk) => { logs += chunk.toString(); });
  server.stderr?.on('data', (chunk) => { logs += chunk.toString(); });

  const url = `http://${config.render.host}:${config.render.port}${config.render.route}`;
  let html = null;
  try {
    for (let attempt = 1; attempt <= 40; attempt += 1) {
      try {
        const response = await fetch(url, { redirect: 'follow' });
        if (response.ok) {
          html = await response.text();
          break;
        }
      } catch {}
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 500));
    }
  } finally {
    server.kill('SIGTERM');
  }

  if (!html) {
    console.error(`[FAIL] ${name}: não foi possível renderizar ${url}`);
    if (logs) console.error(logs.slice(-6000));
    process.exit(1);
  }

  html = html
    .replace(/(src|href)="\/(?!\/)/g, '$1="./')
    .replace(/(src|href)='\/(?!\/)/g, "$1='./");

  const output = resolve(cwd, config.render.output);
  writeFileSync(output, html);
  console.log(`[OK] ${name}: index mobile renderizado em ${config.render.output}`);
}

const finalIndex = name === 'corridas'
  ? resolve(cwd, 'dist/index.html')
  : resolve(cwd, config.render?.output ?? '.output/public/index.html');
injectSuperappBridge(finalIndex, name);

console.log(`[OK] ${name}: build isolado concluído em ${config.workspace}`);
