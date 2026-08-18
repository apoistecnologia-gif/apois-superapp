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
  const appPlugin = window.Capacitor?.Plugins?.App;

  function routeAuthDeepLink(rawUrl) {
    if (moduleName !== 'entregas' || typeof rawUrl !== 'string' || !rawUrl.startsWith('br.com.apois.app://auth/')) return false;
    try {
      const incoming = new URL(rawUrl);
      const path = incoming.pathname.replace(/^\\//, '');
      const params = new URLSearchParams(incoming.search);
      const fragment = incoming.hash.replace(/^#/, '');
      if (fragment) {
        const fragmentParams = new URLSearchParams(fragment);
        fragmentParams.forEach((value, key) => { if (!params.has(key)) params.set(key, value); });
      }
      const query = params.toString();
      const suffix = query ? '?' + query : '';
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
    appPlugin.addListener('backButton', ({ canGoBack }) => {
      const hash = window.location.hash || '';
      const rootHashes = ['', '#', '#/', '#/login'];
      const atModuleRoot = moduleName === 'entregas'
        ? rootHashes.includes(hash)
        : (!canGoBack || window.history.length <= 2);
      if (atModuleRoot) {
        window.location.href = shellUrl;
        return;
      }
      window.history.back();
    }).catch(() => undefined);
  }
})();
</script>`;

  html = html.includes('</body>') ? html.replace('</body>', `${bridge}\n</body>`) : `${html}\n${bridge}\n`;
  writeFileSync(indexPath, html);
  console.log(`[OK] ${moduleName}: bridge do Superapp injetado`);
}

run(process.execPath, [resolve(root, 'scripts/prepare-workspace.mjs'), name]);
run(process.execPath, [resolve(root, 'scripts/adapt-module-for-superapp.mjs'), name]);

const config = manifest.modules[name];
const cwd = resolve(root, config.workspace);
const env = { ...process.env, ...(config.env ?? {}) };

// Keep the two production backends isolated inside the experimental APK.
// Corridas source expects the generic VITE_SUPABASE_* names, while Codemagic
// stores its values under CORRIDAS_* to avoid overwriting Entregas variables.
if (name === 'corridas') {
  const corridasUrl = process.env.CORRIDAS_VITE_SUPABASE_URL;
  const corridasKey = process.env.CORRIDAS_VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!corridasUrl || !corridasKey) {
    console.error('[FAIL] corridas: variáveis CORRIDAS_VITE_SUPABASE_* ausentes');
    process.exit(1);
  }
  env.VITE_SUPABASE_URL = corridasUrl;
  env.VITE_SUPABASE_PUBLISHABLE_KEY = corridasKey;

  // The same Android-restricted Google key is used by the native map plugin
  // and injected into the Corridas web bundle for Places/Maps JS when present.
  const mapsKey = process.env.CORRIDAS_ANDROID_MAPS_API_KEY?.trim();
  if (mapsKey) {
    env.VITE_GOOGLE_MAPS_API_KEY = mapsKey;
    console.log('[OK] corridas: Google Maps/Places key do Superapp aplicada');
  } else {
    console.warn('[WARN] corridas: CORRIDAS_ANDROID_MAPS_API_KEY ausente; mapas serão homologados depois da configuração');
  }

  console.log('[OK] corridas: ambiente Supabase isolado aplicado');
}

if (name === 'entregas') {
  // Do not let the embedded customer module register FCM until the unified
  // Android package has its own google-services.json. This prevents login from
  // triggering a native push initialization against an unconfigured Firebase app.
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

  // The Entregas bundle lives under /modules/entregas inside the Superapp.
  // Convert root-relative local resource references to paths relative to that folder.
  // Protocol-relative/external URLs (//host/...) are intentionally preserved.
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
