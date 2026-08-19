import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(readFileSync(resolve(root, '.apois/modules.json'), 'utf8'));
const name = process.argv[2];

if (!name || !manifest.modules[name]) {
  console.error(`Uso: node scripts/build-isolated-module.mjs <${Object.keys(manifest.modules).join('|')}>`);
  process.exit(1);
}

function run(bin, args, options = {}) {
  const result = spawnSync(bin, args, {
    cwd: options.cwd ?? root,
    stdio: 'inherit',
    env: options.env ?? process.env,
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
  const entregasAuthForwardKey = 'apois-superapp:entregas-auth-url';
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
      try { return Boolean(localStorage.getItem(authStorageKey)); } catch { return false; }
    }
  }

  function isPublicRoute() {
    const route = currentRoute();
    return route === '/' || route === '#' || route === '#/' || route.includes('/login') || route.includes('/register') || route.includes('/auth/callback') || route.includes('/redefinir-senha');
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
    return { path, suffix: params.toString() ? '?' + params.toString() : '' };
  }

  function routeAuthDeepLink(rawUrl) {
    if (typeof rawUrl !== 'string' || !rawUrl.startsWith('br.com.apois.app://auth/')) return false;
    try {
      const { path, suffix } = parseAuthDeepLink(rawUrl);

      if (moduleName === 'corridas') {
        if (path === 'reset' || path === 'callback' || path === 'email-change') {
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
      if (path === 'email-change') {
        window.location.replace('#/perfil/dados-pessoais' + suffix);
        return true;
      }
      if (path === 'reset') {
        window.location.replace('#/redefinir-senha' + suffix);
        return true;
      }
      if (path === 'callback') {
        window.location.replace('#/auth/callback' + suffix);
        return true;
      }
    } catch (error) {
      console.error('[APOIS] Falha ao processar deep link no módulo', error);
    }
    return false;
  }

  if (appPlugin) {
    appPlugin.addListener('appUrlOpen', ({ url }) => { routeAuthDeepLink(url); }).catch(() => undefined);
    appPlugin.getLaunchUrl().then((result) => { if (result?.url) routeAuthDeepLink(result.url); }).catch(() => undefined);
    if (moduleName === 'entregas') {
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
    }).catch(() => undefined);
    appPlugin.addListener('backButton', ({ canGoBack }) => {
      const hash = window.location.hash || '';
      const moduleRootHashes = new Set(['', '#', '#/', '#/inicio', '#/login']);
      const atModuleRoot = moduleRootHashes.has(hash) || (!hash && !canGoBack);
      if (atModuleRoot) {
        returnToShell();
        return;
      }
      window.history.back();
    }).catch(() => undefined);
  }

  window.setTimeout(enforceSessionBoundary, 350);
})();
</script>`;

  html = html.includes('</body>') ? html.replace('</body>', `${bridge}\n</body>`) : `${html}\n${bridge}\n`;
  writeFileSync(indexPath, html);
  console.log(`[OK] ${moduleName}: bridge do Superapp injetado`);
}

run(process.execPath, [resolve(root, 'scripts/prepare-workspace.mjs'), name]);
run(process.execPath, [resolve(root, 'scripts/adapt-module-for-superapp.mjs'), name]);
if (name === 'corridas') {
  run(process.execPath, [resolve(root, 'scripts/harden-corridas-superapp-runtime.mjs')]);
  run(process.execPath, [resolve(root, 'scripts/fix-corridas-superapp-ui.mjs')]);
}
if (name === 'entregas') {
  run(process.execPath, [resolve(root, 'scripts/harden-entregas-superapp-auth-runtime.mjs')]);
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
    console.log('[OK] corridas: Google Maps Android key disponível para o shell nativo');
  } else {
    console.warn('[WARN] corridas: CORRIDAS_ANDROID_MAPS_API_KEY ausente; mapa nativo será homologado após configuração');
  }

  console.log('[OK] corridas: ambiente Supabase isolado aplicado');
}

if (name === 'entregas') {
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

  html = html.replace(/(src|href)="\/(?!\/)/g, '$1="./');

  const output = resolve(cwd, config.render.output);
  writeFileSync(output, html);
  console.log(`[OK] ${name}: index mobile renderizado em ${config.render.output}`);
}

const finalIndex = name === 'corridas'
  ? resolve(cwd, 'dist/index.html')
  : resolve(cwd, config.render?.output ?? '.output/public/index.html');
injectSuperappBridge(finalIndex, name);

console.log(`[OK] ${name}: build isolado concluído em ${config.workspace}`);
