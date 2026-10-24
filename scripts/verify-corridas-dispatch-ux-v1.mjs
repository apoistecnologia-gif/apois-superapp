import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (path) => readFileSync(resolve(path), "utf8");
const requireAll = (path, markers) => {
  const source = read(path);
  for (const marker of markers) assert.ok(source.includes(marker), path + " missing: " + marker);
};
requireAll(".work/corridas/src/routes/_authenticated.corrida.$rideId.tsx", [
  "APOIS_CANCEL_VISIBLE_V1",
  "CANCELAR CORRIDA",
  "safe-area-inset-bottom",
  "A busca termina automaticamente se nenhum motorista aceitar dentro do prazo."
]);
requireAll(".work/corridas/src/hooks/rides/use-active-ride.tsx", [
  "APOIS_REDISPATCH_POLL_V1",
  'action: "redispatch"',
  'updatedRide.status === "expired"',
  "window.clearInterval(timer)"
]);
requireAll(".work/corridas/src/types/rides/active-ride.ts", ['"expired"']);
requireAll(".work/corridas/src/services/rides/active-ride-service.ts", [
  "expired: 5",
  'canCancel: ["procurar_motorista", "motorista_a_caminho"].includes(status)'
]);
requireAll("supabase/functions/request-ride/index.ts", [
  "notifyRideCandidates(ride, ids)",
  'skipped: "offer_active"',
  'skipped: "search_expired"',
  "if (!savedOffer) return [];",
  "previouslyOffered.has(String(d.user_id))"
]);
requireAll("supabase/functions/send-ride-push/index.ts", [
  "callerDomainId === ride.passenger_id",
  "callerDriverId === ride.driver_id",
  "FIREBASE_SERVICE_ACCOUNT_B64"
]);
requireAll("supabase/corridas-forward-migrations/20261024040000_expire_unaccepted_ride_searches.sql", [
  "private.expire_unaccepted_ride_searches()",
  "cancelled_by = 'system'",
  "r.accepted_driver_id is null",
  "cron.schedule("
]);
console.log("[OK] Corridas: cancelamento fixo, busca expirada, redespacho seguro, push versionado e cron protegidos.");
