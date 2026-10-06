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
  if (result.status !== 0) process.exit(result.status ?? 1);
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
} else {
  run(process.execPath, [resolve(root, 'scripts/adapt-module-for-superapp.mjs'), name]);
}
if (name === 'corridas') {
  run(process.execPath, [resolve(root, 'scripts/harden-corridas-backend-identity-boundary.mjs')]);
  run(process.execPath, [resolve(root, 'scripts/harden-corridas-cancellation-policy.mjs')]);
  run(process.execPath, [resolve(root, 'scripts/harden-corridas-ride-lifecycle.mjs')]);
  run(process.execPath, [resolve(root, 'scripts/harden-corridas-driver-eligibility-no-gateway.mjs')]);
  run(process.execPath, [resolve(root, 'scripts/harden-corridas-superapp-runtime.mjs')]);
  run(process.execPath, [resolve(root, 'scripts/fix-corridas-superapp-ui.mjs')]);
  run(process.execPath, [resolve(root, 'scripts/harden-corridas-oauth-callback-handoff.mjs')]);
  run(process.execPath, [resolve(root, 'scripts/harden-corridas-payment-methods.mjs')]);
  run(process.execPath, [resolve(root, 'scripts/harden-corridas-native-map.mjs')]);
  run(process.execPath, [resolve(root, 'scripts/harden-corridas-pickup-address-display.mjs')]);
  run(process.execPath, [resolve(root, 'scripts/harden-corridas-destination-search-runtime.mjs')]);

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

  for (const [path, before] of protectedMapRuntimeBeforeVisual) {
    const after = readFileSync(resolve(root, path), 'utf8');
    if (after !== before) {
      console.error(`[FAIL] migração visual alterou runtime protegido do mapa: ${path}`);
      process.exit(1);
    }
  }
  protectedCorridasMapRuntimeAfterVisual = new Map(
    protectedMapRuntimePaths.map((path) => [path, readFileSync(resolve(root, path), 'utf8')]),
  );
  console.log('[OK] Corridas: migração visual preservou byte a byte Maps/GPS/Places');
}
if (name === 'entregas') {
  run(process.execPath, [resolve(root, 'scripts/harden-entregas-supabase-runtime.mjs')]);
  run(process.execPath, [resolve(root, 'scripts/harden-entregas-superapp-auth-runtime.mjs')]);
  run(process.execPath, [resolve(root, 'scripts/fix-entregas-hash-auth-callbacks.mjs')]);
  run(process.execPath, [resolve(root, 'scripts/harden-entregas-google-oauth-handoff.mjs')]);
  run(process.execPath, [resolve(root, 'scripts/neutralize-entregas-superapp-legacy.mjs')]);
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

for (const command of [config.install, config.build]) {
  const [bin, ...args] = command;
  run(bin, args, { cwd, env });
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
