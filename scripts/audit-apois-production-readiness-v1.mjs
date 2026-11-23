// APOIS_PART4_PRODUCTION_READINESS_V1
// A read-only, fail-closed release gate. The operator supplies an inventory from
// the actual deployed Supabase projects, never from the repository source tree.
// Does NOT access the network, run migrations, mutate production or deploy anything.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REQUIRED_DRIVER_FUNCTIONS = [
  "request-ride",
  "cancel-ride",
  "send-ride-push",
  "driver-finish-redispatch",
  "dispatch-ride",
  "driver-reject-redispatch",
  "driver-cancel-redispatch",
  "driver-redispatch-recovery",
];
const REQUIRED_COURIER_FUNCTIONS = [
  "create-order",
  "dispatch-push-outbox",
];
const REQUIRED_COURIER_RPCS = [
  "accept_delivery_offer",
  "reject_delivery_offer",
  "courier_transition_delivery",
  "complete_delivery_with_pin",
];

function asSet(value) {
  return new Set(Array.isArray(value) ? value.filter((v) => typeof v === "string") : []);
}

export function auditProductionReadiness(inventory) {
  if (!inventory || typeof inventory !== "object") throw Error("inventory_object_required");
  const rides = inventory.projects?.corridas;
  const orders = inventory.projects?.entregas;
  if (!rides || !orders) throw Error("both_production_projects_required");
  const issues = [];
  const missing = (scope, code, detail) => issues.push({ scope, code, detail });

  const rideEdge = asSet(rides.edgeFunctions);
  for (const slug of REQUIRED_DRIVER_FUNCTIONS) {
    if (!rideEdge.has(slug)) missing("motorista", "edge_missing", slug);
  }
  if (rides.checks?.finishQueueContinuationDeployed !== true) {
    missing("motorista", "deployed_finish_missing_queue_continuation",
      "driver-finish-redispatch must continue released queued rides; an RPC-only implementation is insufficient");
  }
  if (rides.checks?.redispatchRecoveryScheduleActive !== true) {
    missing("motorista", "recovery_schedule_unverified",
      "The durable driver-redispatch-recovery consumer must be scheduled and verifiably active");
  }
  // No-show reason codes require the guarded DB migration first.
  if (rides.checks?.noShowReasonCodeContractActive !== true) {
    missing("motorista", "no_show_reason_contract_unverified",
      "ride.driver_no_show_code_v1 must be true only after the guarded DB migration");
  }

  const orderEdge = asSet(orders.edgeFunctions);
  const orderRpc = asSet(orders.rpcFunctions);
  for (const slug of REQUIRED_COURIER_FUNCTIONS) {
    if (!orderEdge.has(slug)) missing("entregador", "edge_missing", slug);
  }
  for (const rpc of REQUIRED_COURIER_RPCS) {
    if (!orderRpc.has(rpc)) missing("entregador", "rpc_missing", rpc);
  }
  if (orders.checks?.pushOutboxScheduleActive !== true) {
    missing("entregador", "push_schedule_unverified", "Push outbox scheduler must be active");
  }

  // Separate from running cash-only homologation: BOTH projects must have
  // applied the atomic RPC before promoting the staged Safe2Pay webhook code.
  for (const [product, scope] of [[rides, "corridas"], [orders, "entregas"]]) {
    if (!asSet(product.rpcFunctions).has("apois_safe2pay_apply_event_atomic")) {
      missing("financeiro", "atomic_webhook_rpc_missing", scope);
    }
    if (product.checks?.safe2payAtomicWebhookDeployed !== true) {
      missing("financeiro", "deployed_webhook_not_atomic", scope);
    }
  }

  if (orders.checks?.pushLockScreenPrivate !== true) {
    missing("seguranca", "push_lockscreen_privacy_unverified",
      "The published delivery Push must not expose message text in public lock-screen previews");
  }

  return {
    checkedAt: typeof inventory.checkedAt === "string" ? inventory.checkedAt : null,
    issues,
    readyForPartnerLaunch: !issues.some((item) => item.scope === "motorista" || item.scope === "entregador"),
    readyForAtomicSafe2PayPromotion: !issues.some((item) => item.scope === "financeiro"),
    readyForSecuritySignoff: !issues.some((item) => item.scope === "seguranca"),
    readyForFullLaunch: issues.length === 0,
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const filename = process.argv[2];
  if (!filename) {
    console.error("Uso: node scripts/audit-apois-production-readiness-v1.mjs <inventario-producao.json>");
    process.exitCode = 2;
  } else {
    try {
      const report = auditProductionReadiness(JSON.parse(readFileSync(resolve(filename), "utf8")));
      console.log(JSON.stringify(report, null, 2));
      if (!report.readyForFullLaunch) process.exitCode = 1;
    } catch (error) {
      console.error("[FAIL] Inventário de produção inválido:", error instanceof Error ? error.message : "unknown");
      process.exitCode = 2;
    }
  }
}
