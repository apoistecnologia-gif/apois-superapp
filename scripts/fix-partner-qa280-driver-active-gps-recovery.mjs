// APOIS_PARTNER_QA280_ACTIVE_GPS_RECOVERY_V1
// Patch only the disposable Motorista workspace, never Entregador or production DB.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
const path = resolve('.work/partner-motorista/src/routes/motorista.app.tsx');
let source = readFileSync(path, 'utf8');
function once(before, after, label) {
  const count = source.split(before).length - 1;
  if (count !== 1) throw Error('[FAIL] QA280 Motorista ' + label + ' anchors=' + count);
  source = source.replace(before, after);
}
if (!source.includes('APOIS_PARTNER_QA236_PICKUP_PIN_V1') ||
    !source.includes('setApoisOperationalNotification')) {
  throw Error('[FAIL] QA280 requires QA236 PIN and QA235 authenticated navigation');
}
if (source.includes('APOIS_PARTNER_QA280_ACTIVE_GPS_RECOVERY_V1')) {
  throw Error('[FAIL] QA280 recovery already applied');
}
once(
  'import { createFileRoute, useNavigate } from "@tanstack/react-router";',
  'import { createFileRoute, useNavigate } from "@tanstack/react-router";\n' +
  'import { startNativeDriverLocation, stopNativeDriverLocation } from "@/lib/driverNativeLocation";',
  'native GPS functions imported in Motorista only'
);
const state = '  const [active, setActive] = useState<RideRow | null>(null);';
const handler = [
'  // APOIS_PARTNER_QA280_ACTIVE_GPS_RECOVERY_V1: deliberate recovery, no fake GPS.',
'  const [qa280RecoveringGps, setQa280RecoveringGps] = useState(false);',
'  const qa280RecoverGpsForActiveRide = async () => {',
'    const ride = active;',
'    if (qa280RecoveringGps || !ride || !["motorista_a_caminho", "motorista_chegou", "em_viagem"].includes(ride.status)) return;',
'    setQa280RecoveringGps(true);',
'    let newNativeStartup = false;',
'    try {',
'      const auth = await supabase.auth.getSession();',
'      if (auth.error || !auth.data.session) throw Error("Sessão expirada. Entre novamente sem cancelar a corrida.");',
'      const {data:live,error:loadError} = await supabase.from("rides")',
'        .select("status,driver_id").eq("id",ride.id).maybeSingle();',
'      if (loadError || !live || live.driver_id !== driverId ||',
'          !["motorista_a_caminho","motorista_chegou","em_viagem"].includes(live.status))',
'        throw Error("Não foi possível validar a corrida ativa no servidor.");',
'      const gps = await Geolocation.getCurrentPosition({enableHighAccuracy:true,maximumAge:0,timeout:20000});',
'      const lat = Number(gps.coords.latitude), lng = Number(gps.coords.longitude);',
'      const accuracy = Number(gps.coords.accuracy);',
'      if (!isBrazilCoordinate(lat,lng) || !Number.isFinite(accuracy) || accuracy > 65)',
'        throw Error("GPS sem precisão suficiente. Aguarde sinal melhor e tente novamente.");',
'      const started = await startNativeDriverLocation();',
'      if (!started) throw Error("Serviço de localização Android não confirmou o início.");',
'      newNativeStartup = true;',
'      const result = await (supabase as unknown as {rpc:(',
'        name: "driver_set_presence",',
'        args: {_online:boolean;_lat:number;_lng:number;_heading:null;_speed:null}',
'      ) => Promise<{data:{is_online?:boolean}|null;error:{message:string}|null}>}).rpc(',
'        "driver_set_presence",{_online:true,_lat:lat,_lng:lng,_heading:null,_speed:null});',
'      if (result.error || result.data?.is_online !== true)',
'        throw Error(result.error?.message || "Servidor não confirmou o estado ONLINE.");',
'      newNativeStartup = false;',
'      setPosition({lat,lng,heading:null,speed:null});',
'      setGpsStatus("granted");',
'      setGpsMessage(null);',
'      setDesiredOnline(true);',
'      startWatch();',
'      if (live.status === "motorista_a_caminho")',
'        await setApoisOperationalNotification("motorista",true,ride.id,ride.origin_lat,ride.origin_lng,live.status);',
'      else',
'        await setApoisOperationalNotification("motorista",true,undefined,undefined,undefined,live.status);',
'      toast.success("GPS e presença ONLINE restabelecidos. Corrida preservada.");',
'    } catch (error) {',
'      if (newNativeStartup) await stopNativeDriverLocation().catch(() => undefined);',
'      const message=error instanceof Error?error.message:"Não foi possível recuperar o GPS."; ',
'      setGpsStatus("error");',
'      setGpsMessage(message);',
'      toast.error(message);',
'    } finally {',
'      setQa280RecoveringGps(false);',
'    }',
'  };',
].join('\n');
once(state, state+'\n'+handler, 'active ride recovery handler');
const overlay = [
'      {/* QA280: only shown during an active ride with unavailable local GPS/ONLINE. */}',
'      {active && (!online || gpsStatus === "error") &&',
'       ["motorista_a_caminho","motorista_chegou","em_viagem"].includes(active.status) && (',
'        <div data-apois-qa280-recover-gps="true" role="status"',
'          className="absolute inset-x-3 z-[65] rounded-xl border border-[#FECACA] bg-white px-3 py-2.5 text-[#991B1B] shadow-xl"',
'          style={{top:"calc(env(safe-area-inset-top) + 88px)"}}>',
'          <p className="text-[12px] font-bold">GPS ou presença ONLINE indisponível durante a corrida.</p>',
'          <button type="button" disabled={qa280RecoveringGps} onClick={() => void qa280RecoverGpsForActiveRide()}',
'            className="mt-2 min-h-11 w-full rounded-lg bg-[#E51B23] px-3 text-[13px] font-extrabold text-white disabled:opacity-60">',
'            {qa280RecoveringGps ? "Recuperando GPS…" : "Recuperar GPS e ficar ONLINE"}',
'          </button>',
'        </div>',
'      )}',
].join('\n') + '\n';
const shellAnchor='      {/* ===== Corrida ativa =====';
once(shellAnchor,overlay+shellAnchor,'active ride only UI (no existing action replaced)');
for(const marker of [
  'APOIS_PARTNER_QA280_ACTIVE_GPS_RECOVERY_V1',
  'data-apois-qa280-recover-gps',
  'Geolocation.getCurrentPosition({enableHighAccuracy:true,maximumAge:0,timeout:20000})',
  'startNativeDriverLocation()',
  'driver_set_presence',
  'result.data?.is_online !== true',
  'setDesiredOnline(true)',
  'setApoisOperationalNotification("motorista",true,ride.id',
  'startWatch();',
  'live.driver_id !== driverId',
  'stopNativeDriverLocation()',
]) if(!source.includes(marker))throw Error('[FAIL] QA280 missing '+marker);
writeFileSync(path, source,'utf8');
console.log('[OK] QA280 Motorista: botão de recuperação somente em corrida ativa e GPS real com ACK de presença do Supabase.');