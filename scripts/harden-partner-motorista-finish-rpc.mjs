import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const workspace = process.env.APOIS_MOTORISTA_WORKSPACE || '.work/partner-motorista';
const path = resolve(process.cwd(), workspace, 'src/lib/driverRideLifecycle.mobile.ts');
let source = readFileSync(path, 'utf8');

const oldBlock = `export async function finalizarCorridaMobile<T extends { rideId: string }>({ data }: { data: T }) {
  const rideId = data.rideId;
  assertRideId(rideId);
  const ride = await callDriverRedispatchFunction("driver-finish-redispatch", {
    ride_id: rideId,
  });
  notifyPassenger(rideId, "ride.completed");
  return ride;
}`;

const newBlock = `export async function finalizarCorridaMobile<T extends { rideId: string }>({ data }: { data: T }) {
  const rideId = data.rideId;
  assertRideId(rideId);
  // O próprio RPC driver_finish_ride finaliza atomicamente e promove/libera
  // eventual corrida enfileirada. Não depende de Edge Function intermediária.
  const ride = await callRpc("driver_finish_ride", { _ride_id: rideId });
  notifyPassenger(rideId, "ride.completed");
  return ride;
}`;

if (source.includes(newBlock)) {
  console.log('[OK] Motorista: finalização já usa RPC canônico direto.');
  process.exit(0);
}
if (!source.includes(oldBlock)) {
  throw new Error('[FAIL] Motorista: bloco de finalização esperado não encontrado');
}
source = source.replace(oldBlock, newBlock);
writeFileSync(path, source, 'utf8');
console.log('[OK] Motorista: finalização usa driver_finish_ride direto, sem Edge Function ausente.');
