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
  requireOrder(createOrder, 'auth.getUser(token)', 'SUPABASE_SERVICE_ROLE_KEY', 'create-order autentica antes do service_role');
  forbidRegex(createOrder, /customerId\s*=\s*(body|payload|input)\.(user_id|customer_id)/i, 'create-order não confia em customer/user id do body');
}

const customerOrders = read(`${entregasRoot}/supabase/functions/customer-orders/index.ts`);
if (customerOrders) {
  requireText(customerOrders, 'auth.getUser(token)', 'customer-orders valida JWT');
  requireText(customerOrders, '.eq("customer_id", user.id)', 'customer-orders escopa leitura ao customer autenticado');
  requireText(customerOrders, 'userClient.rpc', 'customer-orders usa contexto autenticado em mutations/RPCs');
  forbidRegex(customerOrders, /\.eq\(["']id["'],\s*(orderId|order_id)\)\s*\.single\(\)/, 'customer-orders não usa order_id sozinho como autorização');
}

const favorites = read(`${entregasRoot}/supabase/functions/customer-favorites/index.ts`);
if (favorites) {
  requireText(favorites, 'auth.getUser(token)', 'customer-favorites valida JWT');
  requireText(favorites, 'customer_id: user.id', 'customer-favorites grava ownership da sessão');
  requireText(favorites, '.eq("customer_id", user.id)', 'customer-favorites lê/remove somente ownership da sessão');
}

const notifications = read(`${entregasRoot}/supabase/functions/customer-notifications/index.ts`);
if (notifications) {
  requireText(notifications, 'auth.getUser(token)', 'customer-notifications valida JWT');
  requireText(notifications, '.eq("user_id", user.id)', 'customer-notifications escopa recurso ao usuário atual');
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
  requireText(pushOutbox, 'timingSafeEqual', 'dispatch-push-outbox compara segredo em tempo constante');
  requireOrder(pushOutbox, 'timingSafeEqual', 'createClient(', 'dispatch-push-outbox autoriza antes de criar client privilegiado');
}

const accountDeletion = read(`${entregasRoot}/supabase/functions/account-deletion/index.ts`);
if (accountDeletion) {
  requireText(accountDeletion, 'auth.getUser', 'account-deletion valida sessão no fluxo autenticado');
  requireText(accountDeletion, 'external_account_deletion_requests', 'account-deletion separa solicitação externa genérica');
  forbidRegex(accountDeletion, /return\s+jsonResponse\([^)]*(user|account).*(exists|found)/is, 'account-deletion não revela existência de conta por e-mail');
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

const authMatrix = read('docs/BACKEND_AUTHORIZATION_MATRIX.md');
if (authMatrix) {
  for (const actor of ['PUBLIC_RESOURCE','INTERNAL','AUTH_USER','DRIVER','COURIER','MERCHANT','ADMIN','LEGACY_DISABLED']) {
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
