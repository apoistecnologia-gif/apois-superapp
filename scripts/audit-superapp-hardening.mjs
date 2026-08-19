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
  } else {
    console.log(`[OK] ${label}`);
  }
}

check('scripts/validate-rides-push-firebase.mjs', [
  "APOIS_SUPERAPP_RIDES_PUSH_ENABLED === '1'",
  'CORRIDAS_FIREBASE_PROJECT_ID',
  'FIREBASE_SUPERAPP_GOOGLE_SERVICES_JSON_BASE64',
  'mobileProjectId !== expectedProjectId',
], 'Push Corridas possui gate de compatibilidade Firebase mobile/backend');

check('scripts/namespace-entregas-superapp-storage.mjs', [
  'apois-superapp-entregas:cart',
  'apois-superapp-entregas:checkout-owner-id',
  'apois-superapp-entregas:active-pix',
  'apois-superapp-entregas:bound-user-id',
  'dynamicBoundUserReplacement',
], 'Entregas possui namespace completo de storage do Superapp');

check('scripts/harden-corridas-superapp-storage.mjs', [
  'apois-superapp-corridas-auth-v1',
  'apois-superapp-corridas:push-device-id',
  'favorites',
  'recent-destinations',
], 'Corridas usa sessão isolada para storage operacional');

check('scripts/harden-superapp-shell-auth-deeplink-source.mjs', [
  'Date.now()-Number(previous?.at||0)<5000',
  'JSON.stringify({url:rawUrl,at:Date.now()})',
], 'shell fonte limita deduplicação de deep link a cinco segundos');

check('package.json', [
  'harden-superapp-shell-auth-deeplink-source.mjs && node superapp/shell/build.mjs',
  'verify-superapp-auth-deeplinks.mjs',
], 'build aplica e valida hardening de deep link antes e depois da montagem');

check('.apois/modules.json', [
  'harden-corridas-superapp-storage.mjs',
  'namespace-entregas-superapp-storage.mjs',
  'harden-entregas-superapp-account-security.mjs',
  'harden-entregas-superapp-address-confirmation.mjs',
  'harden-entregas-superapp-customer-ux.mjs',
  '--frozen-lockfile',
], 'build dos módulos executa isolamento, segurança e hardening do cliente com locks protegidos');

check('scripts/harden-entregas-superapp-account-security.mjs', [
  'Não foi possível encerrar o vínculo de notificações deste aparelho.',
  'await removeCustomerPushRegistration(true);',
  'Não foi possível sair com segurança.',
  'Não foi possível desativar sua conta com segurança.',
  'Revise os dados e tente novamente.',
], 'Entregas remove vínculo Push antes de logout/desativação e sanitiza falhas do perfil');

check('scripts/harden-entregas-superapp-customer-ux.mjs', [
  'telemetria do editor Lovable removida',
  'Não foi possível criar sua conta agora. Confira os dados e tente novamente.',
  'await Browser.open({ url: data.signedUrl });',
  'pt-[max(env(safe-area-inset-top),1rem)]',
], 'hardening do cliente remove telemetria do editor, sanitiza cadastro e prepara suporte Android');

check('supabase/migrations/20260819022000_harden_entregas_admin_rpc_privileges.sql', [
  'admin_create_merchant',
  'admin_delete_merchant',
  'admin_suspend_merchant',
  'from public, anon',
  "guard_merchant_delivery_location() set search_path = ''",
], 'hardening de privilégios do backend Entregas está rastreado por migration');

check('supabase/migrations/20260819023900_harden_entregas_trigger_execute.sql', [
  'revoke execute on function public.guard_merchant_delivery_location() from public, anon, authenticated',
  'grant execute on function public.guard_merchant_delivery_location() to service_role',
], 'função de trigger de Entregas não fica diretamente exposta aos papéis do app');

check('supabase/migrations/20260819024600_harden_entregas_merchant_owner_membership.sql', [
  "only admin can assign merchant owner role",
  "canonical owner membership can only be changed by admin",
  "owner role must match merchant owner_user_id",
], 'propriedade canônica do estabelecimento não pode ser tomada por RPC de membros');

check('.env.example', [
  'CORRIDAS_FIREBASE_PROJECT_ID=',
  'APOIS_SUPERAPP_RIDES_PUSH_ENABLED=0',
  'CORRIDAS_PUBLIC_APP_URL=',
], 'pendências externas sensíveis estão explícitas no ambiente');

process.exit(failed ? 1 : 0);
