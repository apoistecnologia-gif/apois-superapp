import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

let failed = false;
function requireFile(path) {
  const full = resolve(path);
  if (!existsSync(full)) {
    console.error(`[FAIL] arquivo ausente: ${path}`);
    failed = true;
    return '';
  }
  return readFileSync(full, 'utf8');
}
function requireMarkers(source, label, markers) {
  const missing = markers.filter((marker) => !source.includes(marker));
  if (missing.length) {
    console.error(`[FAIL] ${label}: ${missing.join(' | ')}`);
    failed = true;
  } else {
    console.log(`[OK] ${label}`);
  }
}
function forbidMarkers(source, label, markers) {
  const present = markers.filter((marker) => source.includes(marker));
  if (present.length) {
    console.error(`[FAIL] ${label}: ${present.join(' | ')}`);
    failed = true;
  } else {
    console.log(`[OK] ${label}`);
  }
}

const requestRide = requireFile('.work/corridas/supabase/functions/request-ride/index.ts');
requireMarkers(requestRide, 'dispatch failure possui rollback lógico seguro', [
  'async function rollbackFailedDispatch(',
  'status: "cancelada_passageiro"',
  'cancellation_reason: DISPATCH_FAILURE_REASON',
  'request_key: null',
  '.eq("status", "procurar_motorista")',
  '.is("driver_id", null)',
  '.is("accepted_driver_id", null)',
  'error_code: "dispatch_failed"',
]);
requireMarkers(requestRide, 'avanço concorrente não é sobrescrito pelo cleanup', [
  'const { data: advancedRide, error: advancedRideError }',
  'advancedRide.status !== "procurar_motorista"',
  'advancedRide.driver_id ||',
  'advancedRide.accepted_driver_id',
]);
forbidMarkers(requestRide, 'request-ride não engole silenciosamente erro de dispatch', [
  'console.error("[request-ride] dispatch failed", dispatchError);',
]);

const driverAction = requireFile('.work/corridas/supabase/functions/driver-ride-action/index.ts');
requireMarkers(driverAction, 'aceite é atômico e vincula DRIVER RECORD ID', [
  'driver_id: driverRecordId',
  'accepted_driver_id: driverRecordId',
  '.eq("status", "procurar_motorista")',
  '.is("driver_id", null)',
  '.is("accepted_driver_id", null)',
]);
requireMarkers(driverAction, 'state machine preserva transições reais', [
  'status: "motorista_a_caminho"',
  'status: "motorista_chegou"',
  'status: "em_viagem"',
  'status: "finalizada"',
  'if (ride.status === "finalizada")',
  'if (ride.status !== "em_viagem")',
]);
requireMarkers(driverAction, 'finish usa preço persistido pelo backend', [
  'const finalPrice = Number(ride.final_price ?? ride.estimated_price ?? 0);',
  '.update({ status: "finalizada", completed_at: now, final_price: finalPrice })',
]);
forbidMarkers(driverAction, 'finish não confia em final_price enviado pelo motorista', [
  'finitePositive(body.final_price)',
  'requestedFinalPrice',
]);

const settlementMigration = requireFile(
  '.work/corridas/supabase/migrations/20260805204500_harden_driver_ride_settlement.sql',
);
requireMarkers(settlementMigration, 'banco reforça source of truth do valor final', [
  "new.final_price := coalesce(old.final_price, old.estimated_price);",
  "raise exception 'invalid_completed_ride_amount';",
  'before update of status, final_price on public.rides',
]);

const walletMigration = requireFile(
  '.work/corridas/supabase/migrations/20260805203000_driver_wallet_ride_credit.sql',
);
requireMarkers(walletMigration, 'crédito de corrida possui chave idempotente', [
  'driver_wallet_transactions_ride_credit_uidx',
  'on public.driver_wallet_transactions (ride_id, type)',
  "where ride_id is not null and type = 'ride_credit'",
]);

process.exit(failed ? 1 : 0);
