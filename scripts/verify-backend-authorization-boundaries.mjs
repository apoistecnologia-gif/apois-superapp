import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

let failed = false;
function fail(message) { failed = true; console.error(`[FAIL] ${message}`); }
function ok(message) { console.log(`[OK] ${message}`); }
function read(path) {
  const full = resolve(path);
  if (!existsSync(full)) { fail(`arquivo necessário ausente: ${path}`); return ''; }
  return readFileSync(full, 'utf8');
}
function requireText(source, marker, label) {
  if (!source.includes(marker)) fail(`${label}: marcador ausente (${marker})`);
  else ok(label);
}
function requireRegex(source, regex, label) {
  if (!regex.test(source)) fail(`${label}: invariante não encontrada (${regex})`);
  else ok(label);
}
function requireOrder(source, before, after, label) {
  const a = source.indexOf(before);
  const b = source.indexOf(after);
  if (a < 0 || b < 0 || a >= b) fail(`${label}: ordem de autorização privilegiada inválida`);
  else ok(label);
}
function forbidRegex(source, regex, label) {
  if (regex.test(source)) fail(`${label}: padrão inseguro encontrado (${regex})`);
  else ok(label);
}

const entregasRoot = process.env.APOIS_ENTREGAS_WORKSPACE
  ? process.env.APOIS_ENTREGAS_WORKSPACE
  : existsSync(resolve('.work/entregas/supabase/functions/create-order/index.ts'))
    ? '.work/entregas'
    : 'sources/apois-entregas';

const createOrder = read(`${entregasRoot}/supabase/functions/create-order/index.ts`);
if (createOrder) {
  requireText(createOrder, 'auth.getUser(token)', 'create-order valida JWT no backend');
  requireText(createOrder, 'userData.user.id', 'create-order deriva customer da sessão');
  requireOrder(createOrder, 'auth.getUser(token)', 'createClient(supabaseUrl, serviceRoleKey', 'create-order autentica antes de criar client service_role');
  requireRegex(createOrder, /\.eq\(["']user_id["'],\s*userData\.user\.id\)/, 'create-order valida endereço salvo pelo customer autenticado');
  forbidRegex(createOrder, /customer(Id|_id)\s*[:=]\s*(body|payload|input)\.(user_id|customer_id)/i, 'create-order não confia em customer/user id do body');
}

const customerOrders = read(`${entregasRoot}/supabase/functions/customer-orders/index.ts`);
const customerCancel = read(`${entregasRoot}/supabase/migrations/20260809004000_complete_operations_and_refund_guards.sql`);
const submitReview = read(`${entregasRoot}/supabase/migrations/20260810005552_block_inactive_customer_reviews.sql`);
if (customerOrders) {
  requireText(customerOrders, 'auth.getUser(token)', 'customer-orders valida JWT');
  requireText(customerOrders, 'authData.user.id', 'customer-orders deriva customer do ator autenticado');
  requireRegex(customerOrders, /\.eq\(["']customer_user_id["'],\s*authData\.user\.id\)/, 'customer-orders lista/detalha somente customer_user_id autenticado');
  requireRegex(customerOrders, /\.eq\(["']id["'],\s*orderId\)[\s\S]{0,300}\.eq\(["']customer_user_id["'],\s*authData\.user\.id\)/, 'customer-orders detail combina order_id + ownership');
  requireText(customerOrders, 'userClient.rpc("customer_cancel_order"', 'customer-orders cancel usa RPC no contexto authenticated');
  requireText(customerOrders, 'userClient.rpc("submit_order_review"', 'customer-orders review usa RPC no contexto authenticated');
  forbidRegex(customerOrders, /adminClient[\s\S]{0,160}\.from\(["']orders["']\)[\s\S]{0,240}\.(update|delete)\(/, 'customer-orders não muta order diretamente com service_role');
}
if (customerCancel) {
  requireText(customerCancel, 'SECURITY DEFINER', 'customer_cancel_order é SECURITY DEFINER explícita');
  requireText(customerCancel, "SET search_path = ''", 'customer_cancel_order fixa search_path');
  requireRegex(customerCancel, /o\.id\s*=\s*_order_id\s+AND\s+o\.customer_user_id\s*=\s*\(SELECT auth\.uid\(\)\)/i, 'customer_cancel_order prova ownership pelo auth.uid');
}
if (submitReview) {
  requireText(submitReview, 'security definer', 'submit_order_review é SECURITY DEFINER explícita');
  requireText(submitReview, "set search_path to ''", 'submit_order_review fixa search_path');
  requireRegex(submitReview, /o\.id\s*=\s*_order_id\s+and\s+o\.customer_user_id\s*=\s*\(select auth\.uid\(\)\)/i, 'submit_order_review prova ownership pelo auth.uid');
}

const favorites = read(`${entregasRoot}/supabase/functions/customer-favorites/index.ts`);
if (favorites) {
  requireText(favorites, 'auth.getUser(token)', 'customer-favorites valida JWT');
  requireRegex(favorites, /customer_id:\s*(user|authData\.user)\.id/, 'customer-favorites grava ownership da sessão');
  requireRegex(favorites, /\.eq\(["']customer_id["'],\s*(user|authData\.user)\.id\)/, 'customer-favorites lê/remove somente ownership da sessão');
}

const notifications = read(`${entregasRoot}/supabase/functions/customer-notifications/index.ts`);
if (notifications) {
  requireText(notifications, 'auth.getUser(token)', 'customer-notifications valida JWT');
  requireRegex(notifications, /\.eq\(["']user_id["'],\s*(user|authData\.user)\.id\)/, 'customer-notifications escopa recurso ao usuário atual');
}

const support = read(`${entregasRoot}/supabase/functions/customer-support/index.ts`);
if (support) {
  requireText(support, 'auth.getUser(token)', 'customer-support valida JWT');
  requireText(support, 'userClient.rpc', 'customer-support mantém mutations no contexto do usuário');
}

const maps = read(`${entregasRoot}/supabase/functions/google-maps-address/index.ts`);
if (maps) {
  requireText(maps, 'auth.getUser(token)', 'google-maps-address valida JWT');
  requireText(maps, 'consume_google_maps_quota', 'google-maps-address aplica quota por usuário');
}

const pushOutbox = read(`${entregasRoot}/supabase/functions/dispatch-push-outbox/index.ts`);
if (pushOutbox) {
  requireText(pushOutbox, 'SUPABASE_SERVICE_ROLE_KEY', 'dispatch-push-outbox possui segredo interno');
  requireText(pushOutbox, 'x-apois-push-dispatch-key', 'dispatch-push-outbox exige runtime key explícita');
  requireText(pushOutbox, 'verify_push_dispatch_runtime_key', 'dispatch-push-outbox valida runtime key no backend');
  requireRegex(pushOutbox, /if\s*\(dispatchKeyError\s*\|\|\s*dispatchKeyValid\s*!==\s*true\)[\s\S]{0,180}return\s+response\(401/, 'dispatch-push-outbox encerra em 401 quando runtime key falha');
  requireOrder(pushOutbox, 'verify_push_dispatch_runtime_key', 'claim_notification_push_batch_v2', 'dispatch-push-outbox autoriza antes de reivindicar fila');
  requireOrder(pushOutbox, 'verify_push_dispatch_runtime_key', 'notification_push_outbox', 'dispatch-push-outbox não processa outbox antes da autorização');
}

const accountDeletion = read(`${entregasRoot}/supabase/functions/account-deletion/index.ts`);
const accountDeletionHardener = read('scripts/harden-entregas-superapp-account-deletion.mjs');
if (accountDeletion) {
  requireText(accountDeletion, 'external_account_deletion_requests', 'account-deletion público apenas registra solicitação externa');
  requireText(accountDeletion, 'source: "public_web"', 'account-deletion classifica origem pública');
  forbidRegex(accountDeletion, /auth\.admin\.(deleteUser|updateUserById)|\.from\(["']profiles["']\)[\s\S]{0,120}\.delete\(/i, 'account-deletion PUBLIC_RESOURCE não apaga conta/perfil diretamente');
  forbidRegex(accountDeletion, /return[\s\S]{0,180}(account_exists|user_exists|email_found)/i, 'account-deletion público não enumera existência de conta');
}
if (accountDeletionHardener) {
  requireText(accountDeletionHardener, 'request_own_account_deletion', 'fluxo autenticado de exclusão usa RPC própria derivada de auth.uid');
  forbidRegex(accountDeletionHardener, /user_id\s*:/i, 'cliente não escolhe user_id na solicitação de exclusão');
}

const manualSettlement = read(`${entregasRoot}/supabase/migrations/20260826051214_courier_manual_settlements.sql`);
if (manualSettlement) {
  for (const marker of [
    'current_courier_id()',
    'v_order.courier_id is distinct from v_courier_id',
    "v_order.status <> 'delivered'",
    "v_order.courier_payout_mode <> 'merchant_manual'",
    "v_order.delivery_settlement_status <> 'pending'",
    "delivery_settlement_status = 'settled'",
    'delivery_settled_at = now()',
    'delivery_settlement_actor_id = auth.uid()',
  ]) requireText(manualSettlement, marker, `courier settlement protege ownership/estado (${marker})`);
}

const adminMerchantMigration = read(`${entregasRoot}/supabase/migrations/20260810001149_require_merchant_pickup_location.sql`);
if (adminMerchantMigration) {
  requireText(adminMerchantMigration, 'create or replace function public.admin_review_merchant', 'admin_review_merchant está versionado');
  requireText(adminMerchantMigration, 'current_user_is_admin()', 'admin_review_merchant valida ADMIN no backend');
  requireText(adminMerchantMigration, 'revoke all on function public.admin_review_merchant', 'admin_review_merchant revoga PUBLIC/anon');
}

const cashForward = read('supabase/entregas-forward-migrations/20260905113000_allow_direct_cash_order_operations.sql');
if (cashForward) {
  for (const marker of [
    'public.current_user_is_merchant_member(merchant_id)',
    'public.current_user_is_merchant_member(o.merchant_id)',
    'public.current_user_is_merchant_member(v_order.merchant_id)',
    "v_order.payment_method = 'cash' and v_order.payment_status = 'pending'",
  ]) requireText(cashForward, marker, `cash/pending preserva merchant ownership (${marker})`);
}

const manualModeForward = read('supabase/entregas-forward-migrations/20260905114500_enable_merchant_manual_courier_mode.sql');
if (manualModeForward) {
  requireText(manualModeForward, "'courier_payout_mode', '\"merchant_manual\"'::jsonb", 'forward migration habilita apenas merchant_manual');
  if (/mercadopago|openpix|pagbank|asaas/i.test(manualModeForward)) fail('merchant_manual forward migration não pode acionar gateway');
  else ok('merchant_manual forward migration não contém gateway');
}

const driverDocuments = read('supabase/corridas-forward-migrations/20260905143000_harden_driver_document_ownership.sql');
if (driverDocuments) {
  for (const marker of [
    'where u.auth_user_id = v_auth_user_id',
    'where d.user_id = v_domain_user_id',
    "split_part(v_path,'/',1) <> v_auth_user_id::text",
    "v_slot not in ('selfie','cnh_front','cnh_back','crlv','vehicle_photo')",
    'invalid_document_mime',
    '10485760',
    'apois_driver_storage_select_own',
    'private.apois_driver_document_reviewer()',
    'revoke all on function apois_rpc_private.driver_update_document(text,text) from public, anon, authenticated',
  ]) requireText(driverDocuments, marker, `driver documents protege AUTH→DOMAIN→DRIVER/storage (${marker})`);
}

const authMatrix = read('docs/BACKEND_AUTHORIZATION_MATRIX.md');
if (authMatrix) {
  for (const actor of ['PUBLIC_RESOURCE','INTERNAL','WEBHOOK','AUTH_USER','DRIVER','COURIER','MERCHANT','ADMIN','LEGACY_DISABLED']) {
    requireText(authMatrix, actor, `matriz documenta actor ${actor}`);
  }
}

const corridasOwnership = read('scripts/verify-corridas-database-ownership.mjs');
const corridasLifecycle = read('scripts/verify-corridas-ride-lifecycle-regressions.mjs');
if (corridasOwnership) {
  requireText(corridasOwnership, 'AUTH', 'Corridas ownership verifier documenta camada AUTH');
  requireText(corridasOwnership, 'DOMAIN', 'Corridas ownership verifier documenta camada DOMAIN');
}
if (corridasLifecycle) {
  requireText(corridasLifecycle, 'driver-ride-action', 'Corridas lifecycle cobre ação de motorista');
  requireText(corridasLifecycle, 'final_price', 'Corridas lifecycle cobre preço final server-side');
}

if (failed) process.exit(1);
ok(`Backend authorization boundaries validados estaticamente (Entregas root: ${entregasRoot}).`);
