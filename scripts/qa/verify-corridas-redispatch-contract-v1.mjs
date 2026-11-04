// QA somente estático: valida cadeia de ações do Motorista sem chamar produção.
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
function read(path) {
  const full = resolve(path);
  assert.ok(existsSync(full), "Dependência ausente: " + path);
  return readFileSync(full, "utf8");
}
const lifecycle = read("sources/apois-corridas-motorista-admin/src/lib/driverRideLifecycle.mobile.ts");
const reject = read("supabase/functions/driver-reject-redispatch/index.ts");
const cancel = read("supabase/functions/driver-cancel-redispatch/index.ts");
const dispatch = read("supabase/functions/dispatch-ride/index.ts");
const engine = read("supabase/functions/_shared/dispatch-engine.ts");
const category = read("supabase/functions/_shared/ride-request.ts");
const flags = read("supabase/functions/_shared/ride-feature-flags.ts");
const cors = read("supabase/functions/_shared/cors.ts");
for (const [name, src, rpc] of [
  ["driver-reject-redispatch", reject, "driver_reject_ride"],
  ["driver-cancel-redispatch", cancel, "driver_cancel_ride"],
]) {
  assert.ok(lifecycle.includes('"' + name + '"'), "Motorista não chama " + name);
  for(const token of [
    "getCorsHeaders(req)", "bearer(req)", "driverClient.rpc(",
    "Authorization: " + String.fromCharCode(96) + "Bearer " + String.fromCharCode(36) + "{token}" + String.fromCharCode(96),
    "functions/v1/dispatch-ride", 'redispatch: "deferred"', rpc
  ]) assert.ok(src.includes(token), name + " perdeu: " + token);
  assert.ok(!src.includes("admin.auth.admin.deleteUser"), "Exclusão de conta não pertence a redispatch");
}
assert.ok(cancel.includes('status !== "procurar_motorista"'), "Cancelamento precisa proteger estados terminais");
for(const token of [
  "if (bearer(req) !== SERVICE_ROLE)", "findEligibleDriversForRide(",
  '.eq("status", "procurar_motorista")', '.is("driver_id", null)',
  "EdgeRuntime.waitUntil(pushOffers("
]) assert.ok(dispatch.includes(token), "Dispatch inseguro: " + token);
for(const token of ["remainingPoolUserIds","offeredUserIds","user_id"])
  assert.ok(engine.includes(token), "Motor de ofertas incompleto: " + token);
assert.ok(category.includes("normalizeRideCategory"), "Normalização de categoria ausente");
assert.ok(flags.includes("disabledRideFeatureError"), "Feature flags ausentes");
assert.ok(cors.includes("export function getCorsHeaders"), "CORS compartilhado ausente");
console.log("[OK] Corridas: cadeia de recusa/cancelamento/redispatch completa no código da branch (não implantada).");
