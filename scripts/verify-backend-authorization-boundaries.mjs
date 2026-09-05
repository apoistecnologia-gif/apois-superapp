import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

let failed = false;
const ok = (message) => console.log(`[OK] ${message}`);
const fail = (message) => { failed = true; console.error(`[FAIL] ${message}`); };
function read(path) {
  const full = resolve(path);
  if (!existsSync(full)) { fail(`arquivo necessário ausente: ${path}`); return ''; }
  return readFileSync(full, 'utf8');
}
function requireText(source, marker, label) {
  if (!source.includes(marker)) fail(`${label}: marcador ausente (${marker})`); else ok(label);
}
function requireRegex(source, regex, label) {
  if (!regex.test(source)) fail(`${label}: invariante ausente (${regex})`); else ok(label);
}
function requireOrder(source, before, after, label) {
  const a = source.indexOf(before); const b = source.indexOf(after);
  if (a < 0 || b < 0 || a >= b) fail(`${label}: ordem inválida`); else ok(label);
}
function forbidRegex(source, regex, label) {
  if (regex.test(source)) fail(`${label}: padrão inseguro encontrado (${regex})`); else ok(label);
}

const entregasRoot = process.env.APOIS_ENTREGAS_WORKSPACE
  ? process.env.APOIS_ENTREGAS_WORKSPACE
  : existsSync(resolve('.work/entregas/supabase/functions/create-order/index.ts'))
    ? '.work/entregas'
    : 'sources/apois-entregas';

// ---------------------------------------------------------------------------
// Customer resource boundaries
// ---------------------------------------------------------------------------
const createOrder = read(`${entregasRoot}/supabase/functions/create-order/index.ts`);
if (createOrder) {
  requireText(createOrder, 'authClient.auth.getUser(token)', 'create-order valida JWT no backend');
  requireText(createOrder, 'userData.user.id', 'create-order deriva customer da sessão');
  requireOrder(createOrder, 'authClient.auth.getUser(token)', 'const adminClient = createClient(supabaseUrl, serviceRoleKey', 'create-order autentica antes do client service_role');
  requireRegex(createOrder, /\.eq\(["']user_id["'],\s*userData\.user\.id\)/, 'create-order valida endereço pelo customer autenticado');
  requireText(createOrder, 'p_customer_user_id: userData.user.id', 'create-order envia customer derivado da sessão ao RPC');
  forbidRegex(createOrder, /p_customer_user_id\s*:\s*(payload|body|input)\./i, 'create-order não aceita customer arbitrário do body');
}

const customerOrders = read(`${entregasRoot}/supabase/functions/customer-orders/index.ts`);
const customerCancel = read(`${entregasRoot}/supabase/migrations/20260809004000_complete_operations_and_refund_guards.sql`);
const submitReview = read(`${entregasRoot}/supabase/migrations/20260810005552_block_inactive_customer_reviews.sql`);
if (customerOrders) {
  requireText(customerOrders, 'authClient.auth.getUser(token)', 'customer-orders valida JWT');
  requireText(customerOrders, 'authData.user.id', 'customer-orders deriva customer do ator');
  requireRegex(customerOrders, /\.eq\(["']customer_user_id["'],\s*authData\.user\.id\)/, 'customer-orders escopa leitura a customer_user_id');
  requireRegex(customerOrders, /\.eq\(["']id["'],\s*orderId\)[\s\S]{0,260}\.eq\(["']customer_user_id["'],\s*authData\.user\.id\)/, 'customer-orders detail combina order_id + ownership');
  requireText(customerOrders, 'userClient.rpc("customer_cancel_order"', 'customer-orders cancel usa contexto authenticated');
  requireText(customerOrders, 'userClient.rpc("submit_order_review"', 'customer-orders review usa contexto authenticated');
  forbidRegex(customerOrders, /adminClient[\s\S]{0,180}\.from\(["']orders["']\)[\s\S]{0,260}\.(update|delete)\(/, 'customer-orders não muta order diretamente com service_role');
}
if (customerCancel) {
  requireRegex(customerCancel, /create or replace function public\.customer_cancel_order/i, 'customer_cancel_order versionada');
  requireRegex(customerCancel, /security definer/i, 'customer_cancel_order SECURITY DEFINER explícita');
  requireRegex(customerCancel, /set search_path\s*=\s*''/i, 'customer_cancel_order fixa search_path');
  requireRegex(customerCancel, /o\.id\s*=\s*_order_id\s+AND\s+o\.customer_user_id\s*=\s*\(SELECT auth\.uid\(\)\)/i, 'customer_cancel_order prova ownership pelo auth.uid');
}
if (submitReview) {
  requireRegex(submitReview, /create or replace function public\.submit_order_review/i, 'submit_order_review versionada');
  requireRegex(submitReview, /security definer/i, 'submit_order_review SECURITY DEFINER explícita');
  requireRegex(submitReview, /set search_path\s+(?:=|to)\s*''/i, 'submit_order_review fixa search_path');
  requireRegex(submitReview, /o\.id\s*=\s*_order_id\s+and\s+o\.customer_user_id\s*=\s*\(select auth\.uid\(\)\)/i, 'submit_order_review prova ownership pelo auth.uid');
}

const favorites = read(`${entregasRoot}/supabase/functions/customer-favorites/index.ts`);
if (favorites) {
  requireText(favorites, 'authClient.auth.getUser(token)', 'customer-favorites valida JWT');
  requireText(favorites, 'customer_user_id: authData.user.id', 'customer-favorites grava ownership da sessão');
  requireText(favorites, '.eq("customer_user_id", authData.user.id)', 'customer-favorites lê/remove somente ownership da sessão');
  forbidRegex(favorites, /customer_user_id\s*:\s*payload\./i, 'customer-favorites não aceita customer id do body');
}

const notifications = read(`${entregasRoot}/supabase/functions/customer-notifications/index.ts`);
if (notifications) {
  requireText(notifications, 'authClient.auth.getUser(token)', 'customer-notifications valida JWT');
  requireText(notifications, '.eq("user_id", authData.user.id)', 'customer-notifications escopa leituras ao usuário atual');
  requireText(notifications, 'user_id: authData.user.id', 'customer-notifications grava preferência do usuário atual');
}

const support = read(`${entregasRoot}/supabase/functions/customer-support/index.ts`);
if (support) {
  requireText(support, 'authClient.auth.getUser(token)', 'customer-support valida JWT');
  requireText(support, '.eq("requester_user_id", authData.user.id)', 'customer-support lista somente chamados próprios');
  requireText(support, 'client.rpc("create_support_ticket"', 'customer-support cria chamado em contexto authenticated');
  requireText(support, 'client.rpc("add_support_message"', 'customer-support adiciona mensagem em contexto authenticated');
  requireText(support, 'path.startsWith(`${authData.user.id}/${ticketId}/`)', 'customer-support restringe anexos ao prefixo do ator/ticket');
}

const maps = read(`${entregasRoot}/supabase/functions/google-maps-address/index.ts`);
if (maps) {
  requireText(maps, 'userClient.auth.getUser(token)', 'google-maps-address valida JWT');
  requireText(maps, 'consume_google_maps_lookup_quota', 'google-maps-address aplica quota por usuário autenticado');
}

// ---------------------------------------------------------------------------
// INTERNAL push dispatcher: service_role may exist before the check, but no queue
// claim or message processing may happen before runtime-key authorization succeeds.
// ---------------------------------------------------------------------------
const pushOutbox = read(`${entregasRoot}/supabase/functions/dispatch-push-outbox/index.ts`);
if (pushOutbox) {
  requireText(pushOutbox, 'x-apois-push-dispatch-key', 'dispatch-push-outbox exige runtime key');
  requireText(pushOutbox, 'verify_push_dispatch_runtime_key', 'dispatch-push-outbox valida runtime key no backend');
  requireRegex(pushOutbox, /if\s*\(dispatchKeyError\s*\|\|\s*dispatchKeyValid\s*!==\s*true\)[\s\S]{0,200}return\s+response\(401/, 'dispatch-push-outbox falha fechado com 401');
  requireOrder(pushOutbox, 'verify_push_dispatch_runtime_key', 'claim_notification_push_batch_v2', 'dispatch-push-outbox autoriza antes de reivindicar fila');
  requireOrder(pushOutbox, 'verify_push_dispatch_runtime_key', 'notification_push_outbox', 'dispatch-push-outbox não escreve outbox antes de autorizar');
}

// ---------------------------------------------------------------------------
// Account deletion has two deliberate modes:
// PUBLIC_RESOURCE only queues a generic request; authenticated deletion uses RPC
// bound to auth.uid(). The public endpoint must never directly delete identities.
// ---------------------------------------------------------------------------
const accountDeletion = read(`${entregasRoot}/supabase/functions/account-deletion/index.ts`);
const accountDeletionHardener = read('scripts/harden-entregas-superapp-account-deletion.mjs');
if (accountDeletion) {
  requireText(accountDeletion, 'external_account_deletion_requests', 'account-deletion PUBLIC_RESOURCE apenas registra solicitação externa');
  requireText(accountDeletion, 'source: "public_web"', 'account-deletion classifica origem pública');
  forbidRegex(accountDeletion, /auth\.admin\.(deleteUser|updateUserById)|\.from\(["']profiles["']\)[\s\S]{0,120}\.delete\(/i, 'account-deletion público não apaga conta/perfil diretamente');
  forbidRegex(accountDeletion, /(account_exists|user_exists|email_found)/i, 'account-deletion público não expõe enumeração de conta');
}
if (accountDeletionHardener) {
  requireText(accountDeletionHardener, 'request_own_account_deletion', 'exclusão autenticada usa RPC própria');
  forbidRegex(accountDeletionHardener, /user_id\s*:/i, 'cliente não escolhe user_id na exclusão autenticada');
}

// ---------------------------------------------------------------------------
// Merchant/manual courier settlement. Delivery completion only feeds the closure;
// confirmation is a separate, courier-owned step. Forward migration adds retry
// idempotency without weakening ownership.
// ---------------------------------------------------------------------------
const manualSettlement = read(`${entregasRoot}/supabase/migrations/20260826051214_courier_manual_settlements.sql`);
if (manualSettlement) {
  for (const marker of [
    'public.current_user_courier_id()',
    'v_settlement.courier_id <> v_courier_id',
    "v_settlement.status <> 'merchant_marked_paid'",
    "dj.status = 'delivered'",
    'public.current_user_is_merchant_manager(v_settlement.merchant_id)',
    'revoke all on function public.courier_confirm_courier_settlement(uuid) from public, anon',
  ]) requireText(manualSettlement, marker, `base settlement protege ator/ownership/estado (${marker})`);
}
const manualModeForward = read('supabase/entregas-forward-migrations/20260905114500_enable_merchant_manual_courier_mode.sql');
if (manualModeForward) {
  for (const marker of [
    'public.current_user_courier_id()',
    'v_settlement.courier_id <> v_courier_id',
    "if v_settlement.status = 'confirmed' then",
    "v_settlement.status <> 'merchant_marked_paid'",
    "status = 'confirmed'",
    'courier_confirmed_at = coalesce(courier_confirmed_at, now())',
    'revoke all on function public.courier_confirm_courier_settlement(uuid) from public, anon',
    "'courier_payout_mode', '\"merchant_manual\"'::jsonb",
  ]) requireText(manualModeForward, marker, `forward settlement preserva ownership/idempotência (${marker})`);
  if (/mercadopago|openpix|pagbank|asaas/i.test(manualModeForward)) fail('merchant_manual forward migration não pode acionar gateway'); else ok('merchant_manual forward migration não contém gateway');
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

// ---------------------------------------------------------------------------
// Driver documents AUTH -> DOMAIN -> DRIVER + private storage contract.
// ---------------------------------------------------------------------------
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
