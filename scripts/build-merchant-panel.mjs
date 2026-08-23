import { existsSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';

const root = resolve('.');
const workspace = resolve(root, '.work/entregas');

function run(bin, args, options = {}) {
  const command = process.platform === 'win32' && bin === 'bun' ? 'bun.cmd' : bin;
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? root,
    env: options.env ?? process.env,
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

if (!existsSync(resolve(root, 'sources/apois-entregas/package.json'))) {
  const token = process.env.APOIS_ENTREGAS_SUBMODULE_TOKEN?.trim();
  if (!token) {
    console.error('[FAIL] sources/apois-entregas não foi inicializado no checkout.');
    console.error('Defina a variável de ambiente APOIS_ENTREGAS_SUBMODULE_TOKEN na Vercel');
    console.error('(um GitHub token com leitura em apois-entregas) para inicializar o submódulo no build.');
    process.exit(1);
  }

  console.log('[INFO] Inicializando submódulo de Entregas com token dedicado...');
  const authHeader = `AUTHORIZATION: basic ${Buffer.from(`x-access-token:${token}`).toString('base64')}`;
  run('git', [
    '-c',
    `http.https://github.com/.extraheader=${authHeader}`,
    'submodule',
    'update',
    '--init',
    '--recursive',
    'sources/apois-entregas',
  ]);

  if (!existsSync(resolve(root, 'sources/apois-entregas/package.json'))) {
    console.error('[FAIL] Falha ao inicializar sources/apois-entregas mesmo com token configurado.');
    process.exit(1);
  }
}

run(process.execPath, [resolve(root, 'scripts/prepare-workspace.mjs'), 'entregas']);
run(process.execPath, [resolve(root, 'scripts/adapt-module-for-superapp.mjs'), 'entregas']);
run(process.execPath, [resolve(root, 'scripts/harden-entregas-superapp-auth-runtime.mjs')]);
run(process.execPath, [resolve(root, 'scripts/fix-entregas-hash-auth-callbacks.mjs')]);
// harden-entregas-superapp-address-ux.mjs converts GoogleMapsAddressSelector.tsx off
// TanStack server functions; neutralize-entregas-superapp-legacy.mjs (below) runs
// harden-entregas-merchant-map-runtime.mjs, which verifies that conversion already
// happened, so this must run first.
run(process.execPath, [resolve(root, 'scripts/harden-entregas-superapp-address-ux.mjs')]);
run(process.execPath, [resolve(root, 'scripts/neutralize-entregas-superapp-legacy.mjs')]);

for (const script of [
  'namespace-entregas-superapp-storage.mjs',
  'harden-entregas-superapp-error-page.mjs',
  'harden-entregas-superapp-account-security.mjs',
  'harden-entregas-superapp-account-deletion.mjs',
  'harden-entregas-superapp-order-details.mjs',
  'harden-entregas-superapp-profile-navigation.mjs',
  'harden-entregas-superapp-profile-details.mjs',
  'harden-entregas-superapp-delivery-map.mjs',
  'harden-entregas-superapp-push-navigation.mjs',
  'harden-entregas-superapp-notification-feed.mjs',
  'harden-entregas-superapp-address-confirmation.mjs',
  'harden-entregas-superapp-image-fallbacks.mjs',
  'harden-entregas-superapp-legal-routes.mjs',
  'harden-entregas-superapp-customer-ux.mjs',
  'harden-entregas-superapp-checkout-mobile-ui.mjs',
  'harden-entregas-order-finish-mobile-ui.mjs',
  'harden-superapp-module-mobile-ui.mjs',
  'harden-entregas-superapp-secondary-mobile-ui.mjs',
]) {
  const args = script === 'harden-superapp-module-mobile-ui.mjs'
    ? [resolve(root, `scripts/${script}`), 'entregas']
    : [resolve(root, `scripts/${script}`)];
  run(process.execPath, args);
}

const env = {
  ...process.env,
  VITE_APOIS_PRODUCT_MODE: 'merchant',
  APOIS_MOBILE_BUILD: '0',
};

// Vercel injects VERCEL=1 into every build, which makes Nitro auto-detect the
// "vercel" preset and emit its Build Output API layout (.vercel/output/...)
// instead of the plain .output/server + .output/public shape this script
// pre-renders and republishes. Force the generic preset for this nested build.
delete env.VERCEL;
delete env.VERCEL_ENV;
delete env.VERCEL_URL;
env.NITRO_PRESET = 'node-server';

run('bun', ['install'], { cwd: workspace, env });
run('bun', ['run', 'build:merchant'], { cwd: workspace, env });

const serverEntry = resolve(workspace, '.output/server/index.mjs');
const publicIndex = resolve(workspace, '.output/public/index.html');
if (!existsSync(serverEntry)) {
  console.error('[FAIL] Painel merchant não gerou .output/server/index.mjs');
  process.exit(1);
}

const host = '127.0.0.1';
const port = '4175';
const server = spawn('node', [serverEntry], {
  cwd: workspace,
  env: { ...env, HOST: host, PORT: port },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let logs = '';
server.stdout?.on('data', (chunk) => { logs += chunk.toString(); });
server.stderr?.on('data', (chunk) => { logs += chunk.toString(); });

let html = null;
try {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const response = await fetch(`http://${host}:${port}/`, { redirect: 'follow' });
      if (response.ok) {
        html = await response.text();
        break;
      }
    } catch {}
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 300));
  }
} finally {
  server.kill('SIGTERM');
}

if (!html) {
  console.error('[FAIL] Não foi possível renderizar o HTML inicial do painel merchant.');
  if (logs) console.error(logs.slice(-5000));
  process.exit(1);
}

html = html
  .replace(/(src|href)="\/(?!\/)/g, '$1="./')
  .replace(/(src|href)='\/(?!\/)/g, "$1='./");
writeFileSync(publicIndex, html, 'utf8');

for (const forbidden of [
  'Conta para repasse',
  'Salvar chave PIX',
  'Solicitar saque',
  'SOLICITAR ENTREGADOR · PEDIDO',
]) {
  if (html.includes(forbidden)) {
    console.error(`[FAIL] Painel merchant publicado ainda contém UI legada: ${forbidden}`);
    process.exit(1);
  }
}

console.log('[OK] Painel do estabelecimento pronto para Vercel em .work/entregas/.output/public');
