import { cpSync, existsSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = resolve('.');
const workspace = resolve(root, '.work/entregas');

function run(bin, args, options = {}) {
  const command = process.platform === 'win32' && bin === 'bun' ? 'bun.cmd' : bin;
  const cwd = options.cwd ?? root;
  console.log(`[RUN] cwd=${cwd} :: ${command} ${args.join(' ')}`);
  const result = spawnSync(command, args, {
    cwd,
    env: options.env ?? process.env,
    stdio: 'inherit',
    shell: process.platform === 'win32' && command.endsWith('.cmd'),
  });
  if (result.error) throw result.error;
  const status = result.status ?? 1;
  console.log(`[EXIT ${status}] ${command} ${args.join(' ')}`);
  if (status !== 0 && options.allowFailure !== true) process.exit(status);
  return status;
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
// Shared Cliente login/home imports require the official APOIS brand data module.
run(process.execPath, [resolve(root, 'scripts/harden-entregas-superapp-brand-assets.mjs')]);
run(process.execPath, [resolve(root, 'scripts/harden-entregas-superapp-auth-runtime.mjs')]);
run(process.execPath, [resolve(root, 'scripts/fix-entregas-hash-auth-callbacks.mjs')]);
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
  'harden-entregas-overlay-layering.mjs',
  'harden-entregas-superapp-legal-routes.mjs',
  'harden-entregas-superapp-customer-ux.mjs',
  'harden-entregas-superapp-checkout-mobile-ui.mjs',
  'harden-entregas-order-finish-mobile-ui.mjs',
  'harden-superapp-module-mobile-ui.mjs',
  'harden-entregas-superapp-secondary-mobile-ui.mjs',
  'harden-entregas-payment-provider-boundary.mjs',
  'harden-entregas-direct-payment-operations.mjs',
  'fix-merchant-order-control-visual-v1.mjs',
  'fix-entregas-workspace-shell-light-v1.mjs',
  'fix-entregas-admin-readiness-light-v1.mjs',
  'fix-entregas-admin-coverage-contrast-v1.mjs',
  'fix-entregas-admin-orders-contrast-v1.mjs',
  'fix-entregas-admin-realtime-legibility-v1.mjs',
  'fix-entregas-admin-reviews-contrast-v1.mjs',
  'fix-entregas-admin-settlements-contrast-v1.mjs',
  'fix-entregas-admin-support-contrast-v1.mjs',
  'fix-entregas-admin-merchant-dialog-responsive-v1.mjs',
]) {
  const args = script === 'harden-superapp-module-mobile-ui.mjs'
    ? [resolve(root, `scripts/${script}`), 'entregas']
    : [resolve(root, `scripts/${script}`)];
  run(process.execPath, args);
}

const baseEnv = {
  ...process.env,
  APOIS_MOBILE_BUILD: '0',
};

const frozenInstallStatus = run('bun', ['install', '--frozen-lockfile'], {
  cwd: workspace,
  env: baseEnv,
  allowFailure: true,
});
if (frozenInstallStatus !== 0) {
  console.warn('[WARN] Entregas: bun.lock do pin não é reproduzível com Bun atual; usando instalação --no-save apenas em .work.');
  run('bun', ['install', '--no-save'], { cwd: workspace, env: baseEnv });
}

for (const validator of [
  'scripts/audit-superapp-static.mjs',
  'scripts/verify-corridas-database-ownership.mjs',
  'scripts/audit-entregas-merchant-payments.mjs',
  'scripts/audit-payment-boundary.mjs',
  'scripts/verify-backend-authorization-boundaries.mjs',
  'scripts/verify-superapp-release-requirements.mjs',
]) {
  run(process.execPath, [resolve(root, validator)], { cwd: root, env: baseEnv });
}

run('bun', ['run', 'typecheck'], { cwd: workspace, env: baseEnv });

const lintStatus = run('bun', ['run', 'lint'], {
  cwd: workspace,
  env: baseEnv,
  allowFailure: true,
});
if (lintStatus !== 0) {
  console.warn(`[WARN] Entregas: lint source-wide falhou com EXIT ${lintStatus}; continuando fixture sem mascarar o resultado.`);
}

run('bun', ['run', 'test'], { cwd: workspace, env: baseEnv });

const customerEnv = {
  ...baseEnv,
  VITE_APOIS_PRODUCT_MODE: 'customer',
  APOIS_MOBILE_BUILD: '1',
};
run('bun', ['run', 'build:customer'], { cwd: workspace, env: customerEnv });
run(process.execPath, [resolve(root, 'scripts/audit-entregas-customer-bundle.mjs')], {
  cwd: root,
  env: customerEnv,
});

const merchantEnv = {
  ...baseEnv,
  VITE_APOIS_PRODUCT_MODE: 'merchant',
  NITRO_PRESET: 'vercel',
};
run('bun', ['run', 'build:merchant'], { cwd: workspace, env: merchantEnv });

const nestedOutput = resolve(workspace, '.vercel/output');
if (!existsSync(resolve(nestedOutput, 'config.json'))) {
  console.error('[FAIL] Painel merchant não gerou .vercel/output/config.json em .work/entregas.');
  process.exit(1);
}

const rootOutput = resolve(root, '.vercel/output');
rmSync(rootOutput, { recursive: true, force: true });
cpSync(nestedOutput, rootOutput, { recursive: true });

if (lintStatus !== 0) {
  console.warn(`[WARN] Fixture funcional/build concluída, porém o lint source-wide permanece FAIL (EXIT ${lintStatus}).`);
}
console.log('[OK] Fixture Cliente + bundle audit + gates + painel do estabelecimento concluídos na árvore Entregas transformada.');
