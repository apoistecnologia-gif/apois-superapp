import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { auditProductionReadiness } from "../audit-apois-production-readiness-v1.mjs";

// Inventory of material contracts confirmed by READ-ONLY queries on 2026-11-23.
// A fixture is NOT a replacement for collecting a fresh deployment inventory.
function observedInventory() {
  return {
    checkedAt: "2026-11-23",
    projects: {
      corridas: {
        edgeFunctions: ["request-ride", "cancel-ride", "send-ride-push",
          "driver-finish-redispatch", "passenger-routes-compute", "passenger-pricing-estimate"],
        rpcFunctions: ["driver_accept_ride", "driver_cancel_ride",
          "driver_finish_ride", "driver_reject_ride"],
        checks: {
          finishQueueContinuationDeployed: false,
          redispatchRecoveryScheduleActive: false,
          safe2payAtomicWebhookDeployed: false,
        },
      },
      entregas: {
        edgeFunctions: ["create-order", "dispatch-push-outbox", "safe2pay-webhook"],
        rpcFunctions: ["accept_delivery_offer", "reject_delivery_offer",
          "courier_transition_delivery", "complete_delivery_with_pin"],
        checks: {
          pushOutboxScheduleActive: true,
          safe2payAtomicWebhookDeployed: false,
          pushLockScreenPrivate: false,
        },
      },
    },
  };
}

test("Observed production rejects incomplete ride orchestration and financial promotion", () => {
  const report = auditProductionReadiness(observedInventory());
  assert.equal(report.readyForFullLaunch, false);
  assert.equal(report.readyForPartnerLaunch, false);
  assert.equal(report.readyForAtomicSafe2PayPromotion, false);
  assert.equal(report.readyForSecuritySignoff, false);
  for (const [scope, code, detail] of [
    ["motorista", "edge_missing", "dispatch-ride"],
    ["motorista", "edge_missing", "driver-reject-redispatch"],
    ["motorista", "edge_missing", "driver-cancel-redispatch"],
    ["motorista", "edge_missing", "driver-redispatch-recovery"],
    ["motorista", "deployed_finish_missing_queue_continuation", null],
    ["motorista", "recovery_schedule_unverified", null],
    ["financeiro", "atomic_webhook_rpc_missing", "corridas"],
    ["financeiro", "atomic_webhook_rpc_missing", "entregas"],
    ["seguranca", "push_lockscreen_privacy_unverified", null],
  ]) {
    assert.ok(report.issues.some((issue) =>
      issue.scope === scope && issue.code === code && (detail === null || issue.detail === detail)),
      "Missing launch blocker " + scope + "/" + code + "/" + detail);
  }
  assert.equal(report.issues.some((issue) => issue.scope === "entregador"), false,
    "Deployed courier order, PIN and outbox contracts were present at time of inspection");
});

test("Synthetic fully deployed environment clears each independent release gate", () => {
  const ready = observedInventory();
  const rides = ready.projects.corridas;
  rides.edgeFunctions.push("dispatch-ride", "driver-reject-redispatch",
    "driver-cancel-redispatch", "driver-redispatch-recovery");
  rides.rpcFunctions.push("apois_safe2pay_apply_event_atomic");
  rides.checks.finishQueueContinuationDeployed = true;
  rides.checks.redispatchRecoveryScheduleActive = true;
  rides.checks.safe2payAtomicWebhookDeployed = true;
  const orders = ready.projects.entregas;
  orders.rpcFunctions.push("apois_safe2pay_apply_event_atomic");
  orders.checks.safe2payAtomicWebhookDeployed = true;
  orders.checks.pushLockScreenPrivate = true;
  const report = auditProductionReadiness(ready);
  assert.deepEqual(report.issues, []);
  assert.equal(report.readyForFullLaunch, true);
  assert.equal(report.readyForPartnerLaunch, true);
  assert.equal(report.readyForAtomicSafe2PayPromotion, true);
});

test("Absent evidence is never mistaken for a completed deployment", () => {
  assert.throws(() => auditProductionReadiness({}), /both_production_projects_required/);
  const missing = observedInventory();
  delete missing.projects.entregas.checks;
  assert.ok(auditProductionReadiness(missing).issues.some((issue) =>
    issue.code === "push_schedule_unverified"));
});

test("Staged Safe2Pay webhook is transactional and cannot be deployed before its RPC", () => {
  const source = readFileSync("supabase/functions/safe2pay-webhook/index.ts", "utf8");
  assert.match(source, /admin\.rpc\("apois_safe2pay_apply_event_atomic"/);
  assert.doesNotMatch(source, /admin\.from\("rides"\)\.update/);
  assert.doesNotMatch(source, /admin\.from\("orders"\)\.update/);
});

test("Push privacy patch preserves FCM package, channel and outbox idempotent claim", () => {
  const source = readFileSync("supabase/functions/dispatch-push-outbox/index.ts", "utf8");
  assert.match(source, /visibility: "PRIVATE"/);
  assert.doesNotMatch(source, /visibility: "PUBLIC"/);
  for (const invariant of [
    "claim_notification_push_batch_v2", "verify_push_dispatch_runtime_key",
    "restricted_package_name", "PARTNER_PACKAGE", "CUSTOMER_PACKAGE",
    "notification_id", "delivery_offers_v2", "order_updates",
  ]) assert.ok(source.includes(invariant), "Push invariant missing: " + invariant);
});
