import { spawnSync } from 'node:child_process';

const stages = [
  ['sources-capture', 'npm', ['run', 'guard:build-sources:capture']],
  ['audit-static', 'npm', ['run', 'audit:static']],
  ['audit-mobile-ui-v16', process.execPath, ['scripts/audit-mobile-ui-v16.mjs']],
  ['audit-surfaces-v17', process.execPath, ['scripts/audit-unified-app-surfaces-v17.mjs']],
  ['audit-codemagic-installs-v18', process.execPath, ['scripts/audit-codemagic-host-installs-v18.mjs']],
  ['audit-entregas-finish-v19', process.execPath, ['scripts/audit-entregas-order-finish-ui-v19.mjs']],
  ['audit-entregas-auth-v20', process.execPath, ['scripts/audit-entregas-auth-mobile-ui-v20.mjs']],
  ['audit-shell-branding-v21', process.execPath, ['scripts/audit-shell-branding-v21.mjs']],
  ['audit-final-integration-v22', process.execPath, ['scripts/audit-final-integration-v22.mjs']],
  ['audit-brand-theme-v23', process.execPath, ['scripts/audit-unified-brand-theme-v23.mjs']],
  ['audit-entregas-brand-v24', process.execPath, ['scripts/audit-entregas-brand-sweep-v24.mjs']],
  ['audit-brand-v2', process.execPath, ['scripts/audit-apois-brand-v2.mjs']],
  ['audit-corridas-home-compact', process.execPath, ['scripts/audit-corridas-home-compact.mjs']],
  ['audit-corridas-passenger-latency-cta', process.execPath, ['scripts/audit-corridas-passenger-latency-cta.mjs']],
  ['verify-pins', 'npm', ['run', 'verify:pins']],
  ['audit-hardening', 'npm', ['run', 'audit:hardening']],
  ['audit-play-store', 'npm', ['run', 'audit:play-store']],
  ['safe2pay-provider-policy', 'npm', ['run', 'verify:safe2pay-provider-policy']],
  ['safe2pay-client', 'npm', ['run', 'verify:safe2pay-client']],
  ['safe2pay-foundation', 'npm', ['run', 'verify:safe2pay-foundation']],
  ['safe2pay-provider-selection', 'npm', ['run', 'verify:safe2pay-provider-selection']],
  ['safe2pay-runtime-source', 'npm', ['run', 'verify:safe2pay-runtime-source']],
  ['safe2pay-subaccount-onboarding', 'npm', ['run', 'verify:safe2pay-subaccount-onboarding']],
  ['entregas-safe2pay-order', 'npm', ['run', 'verify:entregas-safe2pay-order']],
  ['build-corridas', 'npm', ['run', 'build:corridas']],
  ['build-entregas', 'npm', ['run', 'build:entregas']],
  ['build-shell', 'npm', ['run', 'build:shell']],
  ['auth-deeplinks', 'npm', ['run', 'harden:auth-deeplinks']],
  ['push-routing', 'npm', ['run', 'inject:push-routing']],
  ['verify-dist-1', 'npm', ['run', 'verify:dist']],
  ['build-idempotency', 'npm', ['run', 'test:build-idempotency']],
  ['verify-dist-2', 'npm', ['run', 'verify:dist']],
  ['sources-verify', 'npm', ['run', 'guard:build-sources:verify']],
];

for (const [label, command, args] of stages) {
  console.log('\n============================================================');
  console.log('[APOIS-STAGE-BEGIN] ' + label);
  console.log('============================================================');

  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    env: process.env,
    stdio: 'inherit',
    shell: false,
  });

  if (result.error || result.status !== 0) {
    const status = result.status ?? 'spawn-error';
    console.error('\n!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
    console.error('[APOIS-FAIL-STAGE] ' + label);
    console.error('[APOIS-FAIL-STATUS] ' + status);
    if (result.error) console.error('[APOIS-FAIL-ERROR] ' + result.error.message);
    console.error('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!\n');
    process.exit(typeof result.status === 'number' ? result.status : 1);
  }

  console.log('[APOIS-STAGE-OK] ' + label);
}

console.log('\n[APOIS-HOMOLOGATION-PIPELINE-OK]');
