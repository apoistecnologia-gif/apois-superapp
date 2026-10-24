// Verifica a implementação APK/SQL do PIN. Nenhum PIN real, corrida real,
// migração ou endpoint de produção é executado neste teste de regressão.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
const root=resolve(process.env.APOIS_CORRIDAS_WORKSPACE||'.work/corridas');
const read=path=>readFileSync(resolve(root,path),'utf8');
const active=read('src/hooks/rides/use-active-ride.tsx');
const page=read('src/routes/_authenticated.corrida.$rideId.tsx');
const request=read('src/hooks/rides/use-ride-request.tsx');
const backend=read('supabase/functions/request-ride/index.ts');
const action=read('supabase/functions/driver-ride-action/index.ts');
const manifest=readFileSync('supabase/corridas-forward-migrations/20261023211500_passenger_pin_available_after_accept.sql','utf8');
for(const marker of [
  'APOIS_ACTIVE_RIDE_DOMAIN_USER_V1','const { profile } = useAuth();','const userId = profile?.id ?? null;',
  'getActiveRide(userId)','getRideById(rideId, userId)','pollCurrentRide',
])assert.ok(active.includes(marker),'passageiro: identidade/ciclo de vida '+marker);
for(const marker of [
  'APOIS_PIN_AFTER_ACCEPT_V1','get_passenger_ride_security_code',
  'rideId,status','code={passengerPin}','setPassengerPin(candidate)',
  'status === "motorista_a_caminho"','status === "motorista_chegou"',
  'role="status"','clearTimeout(timer)','/^\\d{4}$/.test(candidate)',
])assert.ok(page.includes(marker),'UI nao exibe PIN apos aceite: '+marker);
assert.ok(!page.includes('<SecurityCodeCard code={ride.security_code}'), 'passageiro nao pode usar public.rides.security_code nulo');
assert.ok(!page.includes('localStorage.setItem') && !page.includes('sessionStorage.setItem'),'PIN nao persistido localmente');
for(const marker of [
  'invokeRequestRideWithTimeout(payload)','request_key: request.requestKey',
])assert.ok(request.includes(marker),'request deve manter idempotencia/timeout: '+marker);
for(const marker of [
  'rollbackFailedDispatch(','dispatch(admin, ride)','error_code: "dispatch_failed"',
])assert.ok(backend.includes(marker),'matching fail-closed: '+marker);
for(const marker of [
  'driver_id: driverRecordId','accepted_driver_id: driverRecordId',
  'status: "motorista_a_caminho"','security_code: securityCode',
  '.eq("status", "procurar_motorista")','.is("driver_id", null)',
  'const suppliedCode = normalizeCode(body.security_code);',
  'suppliedCode !== expectedCode','status: "em_viagem"',
])assert.ok(action.includes(marker),'transicao aceite/PIN: '+marker);
for(const marker of [
  'apois_rpc_private.get_passenger_ride_security_code',
  "r.passenger_id=v_passenger_id",
  "r.status in ('motorista_a_caminho','motorista_chegou')",
  'auth.uid() is null',
  'join public.ride_security_secrets s on s.ride_id=r.id',
  'security_code_unavailable',
])assert.ok(manifest.includes(marker),'migração PIN incompleta: '+marker);
assert.ok(!manifest.includes('drop policy')&&!manifest.includes('truncate')&&!manifest.includes('delete from'),'alteracao SQL nao deve apagar dados');
console.log('[OK] APOIS: request matching, owner ID, aceite atomico, PIN no Supabase protegido e UI imediatamente apos aceite.');
