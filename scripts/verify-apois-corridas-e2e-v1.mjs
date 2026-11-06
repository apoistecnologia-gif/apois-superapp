// Verificacao de codigo-fonte transformado; nao gera APK, AAB ou web bundle.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
const role = process.argv[2];
if (role !== "corridas" && role !== "motorista") throw Error("uso: node scripts/verify-apois-corridas-e2e-v1.mjs corridas|motorista");
const root = resolve(role === "corridas" ? (process.env.APOIS_CORRIDAS_WORKSPACE || ".work/corridas") : (process.env.APOIS_MOTORISTA_WORKSPACE || ".work/partner-motorista"));
function check(file, required, forbidden = []) {
  const source = readFileSync(resolve(root, file), "utf8");
  for (const token of required) if (!source.includes(token)) throw Error("[FAIL] E2E " + role + "/" + file + ": falta " + token);
  for (const token of forbidden) if (source.includes(token)) throw Error("[FAIL] E2E " + role + "/" + file + ": proibido " + token);
  console.log("[OK] E2E " + role + "/" + file);
}
if (role === "corridas") {
  check("src/routes/_authenticated.revisar-solicitacao.tsx", [
    "data-apois-review-e2e-v1", "data-apois-review-footer-e2e-v1",
    'paddingBottom: "max(76px, env(safe-area-inset-bottom))"',
    "{formatCurrency(checkout.finalTotal)}", "onClick={() => void handleConfirm()}"
  ]);
  check("src/components/rides/active/DriverCard.tsx", [
    "APOIS_DRIVER_AVATAR_E2E_V1", "onError={() => setPhotoFailed(true)}", ': "Novo"'
  ], ['ride.driver_rating?.toFixed(1) || "5.0"']);
  check("src/routes/_authenticated.corrida.$rideId.tsx", [
    "APOIS_PASSENGER_RATING_E2E_V1", 'rpc.rpc("rate_passenger_ride"',
    "finishSkipped", 'aria-label="Avaliar motorista"'
  ]);
} else {
  check("src/routes/motorista.app.tsx", [
    "APOIS_DRIVER_ROUTE_E2E_V1", "APOIS_DRIVER_PASSENGER_OFFER_LOOKUP_E2E_V1",
    "active && polyline.length > 0 && (", "setLegKm(null); setRouteSteps([]); return;"
  ]);
  check("src/lib/driverRideLifecycle.mobile.ts", [
    "APOIS_DRIVER_RPC_LIFECYCLE_E2E_V1", 'callRpc("driver_reject_ride"',
    'callRpc("driver_cancel_ride"'
  ], ['return callDriverRedispatchFunction("driver-reject-redispatch"',
       'return callDriverRedispatchFunction("driver-cancel-redispatch"']);
}
console.log("[OK] E2E source gates concluido " + role);
