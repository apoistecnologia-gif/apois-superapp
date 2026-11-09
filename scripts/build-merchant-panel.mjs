import { cpSync, existsSync, readFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = resolve('.');
const workspace = resolve(root, '.work/entregas');

function run(bin, args, options = {}) {
  const command = process.platform === 'win32' && bin === 'bun' ? 'bun.cmd' : bin;
  const cwd = options.cwd ?? root;
  console.log(`[RUN] cwd=${cwd} :: ${command} (${args.length} argumentos; valores omitidos)`);
  const result = spawnSync(command, args, {
    cwd,
    env: options.env ?? process.env,
    stdio: 'inherit',
    shell: process.platform === 'win32' && command.endsWith('.cmd'),
  });
  if (result.error) throw result.error;
  const status = result.status ?? 1;
  console.log(`[EXIT ${status}] ${command} (${args.length} argumentos; valores omitidos)`);
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
  // Git receives the Basic header through process environment, not argv or logs.
  // Preserve any existing Git configuration injected by the build platform.
  const existingCount = Number.parseInt(process.env.GIT_CONFIG_COUNT ?? '0', 10);
  const configIndex = Number.isSafeInteger(existingCount) && existingCount >= 0 ? existingCount : 0;
  run('git', [
    'submodule',
    'update',
    '--init',
    '--recursive',
    'sources/apois-entregas',
  ], {
    env: {
      ...process.env,
      GIT_CONFIG_COUNT: String(configIndex + 1),
      [`GIT_CONFIG_KEY_${configIndex}`]: 'http.https://github.com/.extraheader',
      [`GIT_CONFIG_VALUE_${configIndex}`]: authHeader,
    },
  });

  if (!existsSync(resolve(root, 'sources/apois-entregas/package.json'))) {
    console.error('[FAIL] Falha ao inicializar sources/apois-entregas mesmo com token configurado.');
    process.exit(1);
  }
}

run(process.execPath, [resolve(root, 'scripts/prepare-workspace.mjs'), 'entregas']);
run(process.execPath, [resolve(root, 'scripts/adapt-module-for-superapp.mjs'), 'entregas']);
// Shared Cliente login/home imports require the official APOIS brand data module.
run(process.execPath, [resolve(root, 'scripts/harden-entregas-superapp-brand-assets.mjs')]);
run(process.execPath, [resolve(root, 'scripts/harden-entregas-superapp-viewport.mjs')]);
run(process.execPath, ['--test', resolve(root, 'scripts/qa/test-entregas-viewport-v1.test.mjs')]);
run(process.execPath, [resolve(root, 'scripts/install-entregas-current-db-types-v1.mjs')]);
run(process.execPath, ['--test', resolve(root, 'scripts/qa/test-entregas-generated-types-v1.test.mjs')]);
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
  'fix-entregas-admin-coverage-consistency-v2.mjs',
  'fix-entregas-search-results-v2.mjs',
  'fix-entregas-customer-orders-pagination-v1.mjs',
  'fix-entregas-coupon-metrics-v2.mjs',
  'fix-entregas-merchant-hours-24h-v2.mjs',
  'fix-entregas-cart-price-refresh-v2.mjs',
  'fix-entregas-login-accessibility-v2.mjs',
  'fix-entregas-support-ticket-detail-v1.mjs',
  'restore-entregas-auto-promotions-v3.mjs',
  'connect-entregas-auto-promotions-v3.mjs',
  'connect-entregas-merchant-order-status-v3.mjs',
  'fix-entregas-persisted-cart-validation-v3.mjs',
  'harden-entregas-merchant-image-mime.mjs',
  'fix-entregas-merchant-assets-v1.mjs',
  'fix-entregas-merchant-product-image-reconciliation-v1.mjs',
  'fix-entregas-customer-avatar-cache-v1.mjs',
  'fix-entregas-admin-orders-contrast-v1.mjs',
  'fix-entregas-admin-realtime-legibility-v1.mjs',
  'fix-entregas-admin-reviews-contrast-v1.mjs',
  'fix-entregas-admin-settlements-contrast-v1.mjs',
  'fix-entregas-admin-support-contrast-v1.mjs',
  'fix-entregas-admin-merchant-dialog-responsive-v1.mjs',
  'fix-entregas-login-cta-contrast-v1.mjs',
]) {
  const args = script === 'harden-superapp-module-mobile-ui.mjs'
    ? [resolve(root, `scripts/${script}`), 'entregas']
    : [resolve(root, `scripts/${script}`)];
  run(process.execPath, args);
}

// RV-07 / CV-024: only the final Merchant subscription gate's public fallback.
// Existing gateway disabled, membership state, refresh and onLogout are unchanged.
run(process.execPath, [resolve(root, 'scripts/fix-apois-financial-status-visual07-v1.mjs'), 'merchant']);
run(process.execPath, ['--test', resolve(root, 'scripts/qa/test-apois-financial-status-visual07-v1.test.mjs')]);
if (!readFileSync(resolve(workspace, 'src/components/MerchantSubscriptionGate.tsx'), 'utf8').includes('APOIS_CV07_MERCHANT_STATUS_FALLBACK_V1')) {
  throw new Error('[FAIL] CV07 Merchant monthly fallback missing');
}
// RV-09 / CV-028: after existing customer deletion-request hardener, before building.
// Present RPC-confirmed + logout failure truthfully; do not send another request.
run(process.execPath, [resolve(root, 'scripts/fix-apois-account-deletion-visual09-v1.mjs'), 'entregas']);
run(process.execPath, ['--test', resolve(root, 'scripts/qa/test-apois-account-deletion-visual09-v1.test.mjs')]);
if (!readFileSync(resolve(workspace, 'src/routes/perfil/dados-pessoais.tsx'), 'utf8').includes('APOIS_CV09_DELIVERY_DELETION_RESULT_V1')) {
  throw new Error('[FAIL] CV09 Entregas deletion request feedback missing');
}
// RV-10 CV-029 / VIS-030: semantic product option buttons only, after
// safe-area/image fallback, cart/checkout/payment hardeners and other visuals.
// CV-030 / VIS-031 is not applicable under the pinned NOT NULL max contract.
run(process.execPath, [resolve(root, 'scripts/fix-entregas-product-customization-visual10-v1.mjs')]);
run(process.execPath, ['--test', resolve(root, 'scripts/qa/test-entregas-product-customization-visual10-v1.test.mjs')]);
if (!readFileSync(resolve(root, '.work/entregas/src/components/ProductCustomizationSheet.tsx'), 'utf8').includes('APOIS_CV10_PRODUCT_CUSTOMIZATION_ACCESSIBILITY_V1')) {
  throw new Error('[FAIL] CV10 options must be native accessible buttons');
}
// RV-11: accessible customer labels/card/catalog/autocomplete after all old Entregas overlays.
run(process.execPath, [resolve(root, 'scripts/fix-entregas-labels-visual11-v1.mjs')]);
run(process.execPath, [resolve(root, 'scripts/fix-entregas-address-catalog-visual11-v1.mjs')]);
run(process.execPath, [resolve(root, 'scripts/fix-entregas-autocomplete-visual11-v1.mjs')]);
run(process.execPath, ['--test', resolve(root, 'scripts/qa/test-entregas-visual11-v1.test.mjs')]);
for(const [rel,marker] of [
  ['src/routes/enderecos.tsx','APOIS_CV11_ADDRESS_CARD_V1'],
  ['src/routes/register.tsx','APOIS_CV11_REGISTER_FIELDS_V1'],
  ['src/components/CustomerLocationAddressSelector.tsx','APOIS_CV11_AUTOCOMPLETE_FEEDBACK_V1'],
  ['src/routes/estabelecimento.$merchantId.tsx','APOIS_CV11_CATALOG_V1'],
]) if (!readFileSync(resolve(workspace,rel),'utf8').includes(marker)) throw Error('[FAIL] RV11 Entregas missing '+rel);
// RV-12: Merchant/Admin order choices, coupon states, keyboard upload and admin feedback.
// P1 review only patches existing enriched review; Merchant builder has no such generator.
run(process.execPath, [resolve(root, 'scripts/fix-entregas-merchant-options-visual12-v1.mjs')]);
run(process.execPath, [resolve(root, 'scripts/fix-entregas-merchant-coupons-image-visual12-v1.mjs')]);
run(process.execPath, [resolve(root, 'scripts/fix-entregas-admin-visual12-v1.mjs')]);
run(process.execPath, ['--test', resolve(root, 'scripts/qa/test-entregas-visual12-v1.test.mjs')]);
for (const [rel,marker] of [
  ['src/routes/merchant.tsx','APOIS_CV12_MERCHANT_ORDER_OPTIONS_V1'],
  ['src/components/MerchantCouponsPanel.tsx','APOIS_CV12_COUPON_STATES_V1'],
  ['src/components/MerchantProductEditor.tsx','APOIS_CV12_PRODUCT_IMAGE_KEYBOARD_V1'],
  ['src/components/AdminOrdersPanel.tsx','APOIS_CV12_ADMIN_ORDERS_V1'],
]) if (!readFileSync(resolve(workspace,rel),'utf8').includes(marker))
  throw Error('[FAIL] RV12 Entregas missing '+rel);
// RV-13: after RV-12, patch only disposable shared UI components.
// Preserve source snapshots, routing/callbacks, Radix focus and validation.
run(process.execPath, [resolve(root, 'scripts/fix-entregas-shared-visual13-v1.mjs')]);
run(process.execPath, ['--test', resolve(root, 'scripts/qa/test-entregas-shared-visual13-v1.test.mjs')]);
for (const [rel, marker] of [
  ['src/components/AppBottomNav.tsx', 'APOIS_CV13_SHARED_COMPONENTS_V1'],
  ['src/components/ui/dialog.tsx', 'APOIS_CV13_SHARED_COMPONENTS_V1'],
  ['src/components/ui/prompt-dialog.tsx', 'APOIS_CV13_SHARED_COMPONENTS_V1'],
]) if (!readFileSync(resolve(workspace, rel), 'utf8').includes(marker))
  throw Error('[FAIL] RV13 Entregas shared visual missing ' + rel);
run(process.execPath, [resolve(root, 'scripts/verify-apois-report02-integrity-v1.mjs'), 'entregas']);

const baseEnv = {
  ...process.env,
  APOIS_MOBILE_BUILD: '0',
};

// INV-012: local QA can inspect a drifting pinned fixture; never promote it to a release.
const fixtureOnly = process.env.APOIS_MERCHANT_QA_FIXTURE_ONLY === '1'
  && !process.env.CI && !process.env.VERCEL && !process.env.VERCEL_ENV;
run(process.execPath, [resolve(root, 'scripts/reconcile-entregas-bun-lock-v1.mjs')], {
  cwd: root, env: baseEnv,
});
run(process.execPath, ['--test', resolve(root, 'scripts/qa/test-entregas-bun-overlay-v1.test.mjs')], {
  cwd: root, env: baseEnv,
});
run(process.execPath, [resolve(root, 'scripts/verify-entregas-bun-lock-v1.mjs'),
  ...(fixtureOnly ? ['--qa-fixture-only'] : [])], { cwd: root, env: baseEnv });
run(process.execPath, ['--test', resolve(root, 'scripts/qa/test-entregas-bun-lock-v1.test.mjs')], {
  cwd: root, env: baseEnv,
});
run(process.execPath, ['--test', resolve(root, 'scripts/qa/test-entregas-report02-transforms-v1.test.mjs')], {
  cwd: root, env: baseEnv,
});
const frozenInstallStatus = run('bun', ['install', '--frozen-lockfile'], {
  cwd: workspace,
  env: baseEnv,
  allowFailure: true,
});
if (frozenInstallStatus !== 0) {
  if (!fixtureOnly) {
    console.error('[FAIL] INV-012: frozen lock install failed. Release aborted; no unpinned fallback.');
    process.exit(frozenInstallStatus);
  }
  console.warn('[WARN] INV-012: explicit local QA fixture only; non-reproducible install is NOT production-approved.');
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
  allowFailure: fixtureOnly,
});
if (lintStatus !== 0) {
  console.warn(`[WARN] INV-012: lint falhou com EXIT ${lintStatus}; fixture LOCAL sem aprovação de release.`);
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
  console.warn(`[WARN] Fixture LOCAL não homologada: lint source-wide FAIL (EXIT ${lintStatus}).`);
}
console.log('[OK] Fixture Cliente + bundle audit + gates + painel do estabelecimento concluídos na árvore Entregas transformada.');
