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
  "bottom-[max(64px,env(safe-area-inset-bottom))]",
  "A busca termina automaticamente se nenhum motorista aceitar dentro do prazo."
]);
requireAll(".work/corridas/src/hooks/rides/use-active-ride.tsx", [
  "APOIS_REDISPATCH_POLL_V1",
  'action: "redispatch"',
  'String(updatedRide.status) === "expired"',
  'String(status) === "expired" || status.startsWith("cancelada")',
  "window.clearInterval(timer)"
]);
requireAll(".work/corridas/src/types/rides/active-ride.ts", ['"expired"']);
requireAll(".work/corridas/src/services/rides/active-ride-service.ts", [
  "expired: 5",
  'canCancel: ["procurar_motorista", "motorista_a_caminho"].includes(status)'
]);
requireAll(".work/corridas/src/hooks/rides/use-ride-request.tsx", [
  "APOIS_STOPS_REQUEST_V2",
  "intermediates: [...confirmedStops]",
  "stopsSignatureRef.current = currentStopsSignature"
]);
requireAll(".work/corridas/src/types/rides/ride-request.ts", [
  "intermediates?: Array<{ lat: number; lng: number; label?: string; address?: string }>"
]);
requireAll("supabase/functions/passenger-routes-compute/index.ts", [
  "APOIS_ROUTE_INTERMEDIATES_V2",
  "input.intermediates ?? input.stops"
]);
requireAll("supabase/functions/request-ride/index.ts", [
  "notifyRideCandidates(ride, ids)",
  'skipped: "offer_active"',
  'skipped: "search_expired"',
  "if (!savedOffer) return [];",
  "previouslyOffered.has(String(d.user_id))",
  "APOIS_NO_SELF_DISPATCH_V1",
  "APOIS_STOPS_BACKEND_V2",
  "routeMetrics(body.origin, body.destination, intermediates)"
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
