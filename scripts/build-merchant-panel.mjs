import { cpSync, existsSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = resolve('.');
const workspace = resolve(root, '.work/entregas');

function run(bin, args, options = {}) {
  const command = process.platform === 'win32' && bin === 'bun' ? 'bun.cmd' : bin;
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? root,
    env: options.env ?? process.env,
    stdio: 'inherit',
    shell: process.platform === 'win32' && command.endsWith('.cmd'),
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
  'harden-entregas-payment-provider-boundary.mjs',
  'harden-entregas-direct-payment-operations.mjs',
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

env.NITRO_PRESET = 'vercel';

run('bun', ['install'], { cwd: workspace, env });
run('bun', ['run', 'build:merchant'], { cwd: workspace, env });

const nestedOutput = resolve(workspace, '.vercel/output');
if (!existsSync(resolve(nestedOutput, 'config.json'))) {
  console.error('[FAIL] Painel merchant não gerou .vercel/output/config.json em .work/entregas.');
  process.exit(1);
}

const rootOutput = resolve(root, '.vercel/output');
rmSync(rootOutput, { recursive: true, force: true });
cpSync(nestedOutput, rootOutput, { recursive: true });

console.log('[OK] Painel do estabelecimento pronto para Vercel em .vercel/output (Serverless Function), sem gateway legado no fluxo de pedidos.');
