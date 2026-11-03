// Independent fail-closed production readiness gate for APOIS Safe2Pay.
// Not part of WEB-only QA: WEB-green does not authorize financial/Android deployment.
// Run manually with npm run verify:safe2pay-production-readiness.
// No network, provider calls, migrations, database reads/writes, refunds or builds.
import { existsSync, readFileSync } from "node:fs";

const read = (p) => readFileSync(p, "utf8");
const orders = read("database/review/20261103_safe2pay_entregas_atomic_REVIEW_ONLY.sql");
const rides = read("database/review/20261103_safe2pay_corridas_atomic_REVIEW_ONLY.sql");
const edge = read("supabase/functions/safe2pay-webhook/index.ts");
const orderCreator = read("supabase/functions/safe2pay-create-order-pix/index.ts");
const checks = [
  {
    name: "Transactional SQL approved for deployment instead of REVIEW_ONLY",
    ok: !orders.includes("REVIEW ONLY; NOT APPLIED") && !rides.includes("REVIEW ONLY; NOT APPLIED"),
  },
  {
    name: "One-transaction canonical payments reconciliation for Entregas",
    ok: /(?:INSERT\s+INTO|UPDATE)\s+public\.payments\b/i.test(orders) &&
      /idempotency_key/i.test(orders) && /provider_charge_id/i.test(orders),
  },
  {
    name: "Idempotent merchant wallet reserve reconciled in order RPC",
    ok: /(?:PERFORM|SELECT)\s+public\.(?:reserve_paid_order_merchant_net|post_wallet_transaction)\s*\(/i.test(orders),
  },
  {
    name: "Provider-confirmed refunds reconcile canonical payment and reserve safely",
    ok: /(?:UPDATE)\s+public\.payments\b/i.test(orders) &&
      /(?:reverse_paid_order_merchant_reserve|refund_ledger_reconciled)/i.test(orders),
  },
  {
    name: "Corridas Safe2Pay create-ride payment flow staged and auditable",
    ok: existsSync("supabase/functions/safe2pay-create-ride-pix/index.ts"),
  },
  {
    name: "Webhook and Entregas create-order flow use one atomic DB RPC",
    ok: /admin\.rpc\("apois_safe2pay_apply_event_atomic"/.test(edge) &&
      /admin\.rpc\("apois_safe2pay_apply_event_atomic"/.test(orderCreator),
  },
];
const failed = checks.filter(x => !x.ok);
for (const c of checks) console.log("["+(c.ok ? "OK" : "BLOCKED")+"] "+c.name);
if (failed.length) {
  console.error("\n[BLOCKED] "+failed.length+"/"+checks.length+" Safe2Pay code-only release gates unresolved.");
  console.error("[BLOCKED] Additional gates: isolated PostgreSQL E2E, provider reconciliation, privileged RPC ACL, authorized rollout, Admin QA and Android E2E.");
  process.exitCode = 1;
} else {
  console.log("[OK] Code-only checks passed; this alone does NOT authorize release.");
}
