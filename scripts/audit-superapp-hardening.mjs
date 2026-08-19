import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

let failed = false;
function check(path, markers, label) {
  const full = resolve(path);
  if (!existsSync(full)) {
    console.error(`[FAIL] ${label}: arquivo ausente ${path}`);
    failed = true;
    return;
  }
  const source = readFileSync(full, 'utf8');
  const missing = markers.filter((marker) => !source.includes(marker));
  if (missing.length) {
    console.error(`[FAIL] ${label}: ${missing.join(' | ')}`);
    failed = true;
  } else console.log(`[OK] ${label}`);
}

check('scripts/validate-rides-push-firebase.mjs', [
  "APOIS_SUPERAPP_RIDES_PUSH_ENABLED === '1'",
  'CORRIDAS_FIREBASE_PROJECT_ID',
  'FIREBASE_SUPERAPP_GOOGLE_SERVICES_JSON_BASE64',
  'mobileProjectId !== expectedProjectId',
], 'Push Corridas possui gate Firebase mobile/backend');

check('scripts/namespace-entregas-superapp-storage.mjs', [
  'apois-superapp-entregas:cart',
  'apois-superapp-entregas:checkout-owner-id',
  'apois-superapp-entregas:active-pix',
  'apois-superapp-entregas:bound-user-id',
], 'Entregas possui namespace de storage do Superapp');

check('scripts/harden-corridas-superapp-storage.mjs', [
  'apois-superapp-corridas-auth-v1',
  'apois-superapp-corridas:push-device-id',
  'favorites',
  'recent-destinations',
], 'Corridas usa storage operacional isolado');

check('scripts/harden-superapp-shell-auth-deeplink-source.mjs', [
  'Date.now()-Number(previous?.at||0)<5000',
  'JSON.stringify({url:rawUrl,at:Date.now()})',
], 'shell limita deduplicação de deep link a cinco segundos');

check('package.json', [
  'harden-superapp-shell-auth-deeplink-source.mjs && node superapp/shell/build.mjs',
  'verify-superapp-auth-deeplinks.mjs',
  'verify-superapp-address-runtime.mjs',
  'verify-superapp-notification-assets.mjs',
], 'build aplica e valida deep links, endereço, notificações e assets');

check('.apois/modules.json', [
  'harden-corridas-superapp-storage.mjs',
  'namespace-entregas-superapp-storage.mjs',
  'harden-entregas-superapp-account-security.mjs',
  'harden-entregas-superapp-push-navigation.mjs',
  'harden-entregas-superapp-notification-feed.mjs',
  'harden-entregas-superapp-address-confirmation.mjs',
  'harden-entregas-superapp-address-ux.mjs',
  'harden-entregas-superapp-image-fallbacks.mjs',
  'harden-entregas-superapp-legal-routes.mjs',
  'harden-entregas-superapp-customer-ux.mjs',
  '--frozen-lockfile',
], 'cadeia de build Entregas executa todos os hardeners antes da compilação');

check('scripts/harden-entregas-superapp-account-security.mjs', [
  'await removeCustomerPushRegistration(true);',
  'Não foi possível sair com segurança.',
  'Não foi possível desativar sua conta com segurança.',
], 'conta Entregas remove vínculo Push antes de logout/desativação');

check('scripts/harden-entregas-superapp-customer-ux.mjs', [
  'telemetria do editor Lovable removida',
  'Não foi possível criar sua conta agora. Confira os dados e tente novamente.',
  'await Browser.open({ url: data.signedUrl });',
], 'cliente remove telemetria do editor, sanitiza cadastro e prepara suporte Android');

check('scripts/harden-entregas-superapp-notification-feed.mjs', [
  'payload ainda pode abrir área merchant',
  'Central de notificações',
  'Preferências de notificações',
  'data?.["order_id"]',
], 'feed de notificações fica restrito ao produto cliente');

check('scripts/harden-entregas-superapp-image-fallbacks.mjs', [
  "'.work/entregas/src/routes/perfil/index.tsx'",
  "'.work/entregas/src/routes/perfil/dados-pessoais.tsx'",
  "'.work/entregas/src/routes/estabelecimento.$merchantId.tsx'",
], 'fallback de imagens cobre catálogo, loja e avatares');

check('scripts/harden-entregas-superapp-legal-routes.mjs', [
  'window.history.back()',
  'safe area superior',
  'gateway financeiro obsoleto',
], 'rotas legais têm navegação/safe areas e texto financeiro atualizado');

check('scripts/harden-superapp-android-security.mjs', [
  "['compileSdkVersion', 36]",
  "['targetSdkVersion', 36]",
  "process.env.APP_VERSION_CODE?.trim() || '1'",
  "process.env.APP_VERSION_NAME?.trim() || '1.0.0'",
  "setApplicationAttribute('allowBackup', 'false')",
  "setApplicationAttribute('usesCleartextTraffic', 'false')",
  'android.permission.ACCESS_BACKGROUND_LOCATION',
  'android:windowSoftInputMode="adjustResize"',
  'android.permission.REQUEST_INSTALL_PACKAGES',
], 'Android fixa API 36/versionamento e reduz superfície de permissões para Play Store');

check('scripts/install-superapp-launcher.mjs', [
  "import './harden-superapp-android-security.mjs';",
  'android:allowBackup="false"',
  'android:usesCleartextTraffic="false"',
], 'hardening Android é executado no projeto nativo antes do release');

check('supabase/migrations/20260819022000_harden_entregas_admin_rpc_privileges.sql', [
  'admin_create_merchant', 'admin_delete_merchant', 'admin_suspend_merchant', 'from public, anon',
], 'privilégios de RPC admin estão rastreados');
check('supabase/migrations/20260819023900_harden_entregas_trigger_execute.sql', [
  'revoke execute on function public.guard_merchant_delivery_location() from public, anon, authenticated',
], 'trigger interno não fica exposto ao app');
check('supabase/migrations/20260819024600_harden_entregas_merchant_owner_membership.sql', [
  'only admin can assign merchant owner role',
  'canonical owner membership can only be changed by admin',
  'owner role must match merchant owner_user_id',
], 'propriedade canônica do estabelecimento é protegida');

check('.env.example', [
  'CORRIDAS_FIREBASE_PROJECT_ID=',
  'APOIS_SUPERAPP_RIDES_PUSH_ENABLED=0',
  'CORRIDAS_PUBLIC_APP_URL=',
], 'pendências externas sensíveis estão explícitas');

process.exit(failed ? 1 : 0);
