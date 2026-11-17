// APOIS_PARTNER_QA280_ACTIVE_GPS_RECOVERY_V1
// Scoped to the disposable Motorista workspace only; no production SQL, PIN,
// financial flow, courier source or native stop operation is changed.
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const path = resolve(".work/partner-motorista/src/routes/motorista.app.tsx");
let source = readFileSync(path, "utf8");
function once(oldText, newText, label) {
  if (source.split(oldText).length !== 2) throw Error("[FAIL] QA280 Motorista "+label+" anchor");
  source = source.replace(oldText, newText);
}
if (source.includes("APOIS_PARTNER_QA280_ACTIVE_GPS_RECOVERY_V1")) {
  throw Error("[FAIL] QA280 recovery patch already applied");
}
if (!source.includes("APOIS_PARTNER_QA236_PICKUP_PIN_V1") ||
    !source.includes("APOIS_PARTNER_QA235_ONE_NAVIGATION_V1") ||
    !source.includes("setApoisOperationalNotification") ||
    !source.includes("ApoisNativePlatform") ||
    !source.includes('import { Geolocation } from "@capacitor/geolocation";')) {
  throw Error("[FAIL] QA280 requires protected native GPS, auto arrival and PIN");
}
const importLine='import { startNativeDriverLocation } from "@/lib/driverNativeLocation";\n';
if (source.includes(importLine)) throw Error("[FAIL] QA280 duplicate driver location import");
source = "// APOIS_PARTNER_QA280_ACTIVE_GPS_RECOVERY_V1\n" + importLine + source;
once(
  "  const [qa236PinOpen,setQa236PinOpen]=useState(false);",
  "  const [qa236PinOpen,setQa236PinOpen]=useState(false);\n  const [qa280Recovering,setQa280Recovering]=useState(false);",
  "recovery loading state"
);
const handler=`  // QA280: explicit user-initiated recovery while retaining the SAME active ride.
  // Never send OFFLINE, forge GPS, change ride status, PIN, or settlement.
  const recoverActiveRideGps = useCallback(async () => {
    const ride = activeRef.current;
    if (!ride || !userId || !["motorista_a_caminho","motorista_chegou","em_viagem"].includes(ride.status) || qa280Recovering) return;
    // An OFFLINE ride must follow the SAME fully verified GPS/FGS/presence
    // recovery as an ONLINE ride. toggleOnline() would return before the native
    // service ACK and might never re-arm QA235 pickup monitoring.
    setQa280Recovering(true);
    setGpsMessage("Verificando localização real e serviço em segundo plano...");
    try {
      if (!ApoisNativePlatform.isNativePlatform() || ApoisNativePlatform.getPlatform() !== "android") {
        throw Error("Recuperação nativa disponível apenas no Android.");
      }
      const fix = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true, timeout: 20_000, maximumAge: 0,
      });
      const coords = fix.coords;
      if (!isBrazilCoordinate(coords.latitude, coords.longitude) ||
          !Number.isFinite(coords.accuracy) || coords.accuracy > 65 ||
          !Number.isFinite(fix.timestamp) ||
          Math.abs(Date.now() - fix.timestamp) > 15_000) {
        throw Error("Aguarde uma localização real, recente e precisa antes de recuperar o GPS.");
      }
      if (activeRef.current?.id !== ride.id) {
        throw Error("A corrida mudou enquanto o GPS era verificado.");
      }
      const started = await startNativeDriverLocation();
      if (!started) throw Error("O Android não confirmou a retomada do serviço de GPS.");
      await setApoisOperationalNotification("motorista", true,
        ride.status === "motorista_a_caminho" ? ride.id : undefined,
        ride.origin_lat, ride.origin_lng, ride.status);
      // The service ACK says nothing about the database: confirm official
      // server-side ONLINE with a fresh, accurate real GPS point.
      const { data, error } = await (supabase as unknown as {
        rpc: (name: "driver_set_presence", args: {
          _online: boolean; _lat: number; _lng: number;
          _heading: number | null; _speed: number | null;
        }) => Promise<{data: {is_online?:boolean}|null; error: {message:string}|null}>;
      }).rpc("driver_set_presence", {
        _online: true, _lat: coords.latitude, _lng: coords.longitude,
        _heading: Number.isFinite(coords.heading) ? coords.heading : null,
        _speed: Number.isFinite(coords.speed) && Number(coords.speed) >= 0 ? coords.speed : null,
      });
      if (error) throw Error(error.message);
      if (data?.is_online !== true) throw Error("O servidor não confirmou o motorista ONLINE.");
      if (activeRef.current?.id !== ride.id) return;
      // Publish ONLINE locally only AFTER authenticated native and server ACK.
      // Existing broadcaster can now maintain GPS in the background.
      if (!online) setDesiredOnline(true);
      setPosition({lat:coords.latitude,lng:coords.longitude,
        heading:Number.isFinite(coords.heading) ? coords.heading : null,
        speed:Number.isFinite(coords.speed) && Number(coords.speed)>=0 ? coords.speed : null});
      startWatch();
      setGpsStatus("granted");
      setGpsMessage(null);
      toast.success("GPS e status ONLINE confirmados. Corrida preservada.");
    } catch (error) {
      setGpsStatus("error");
      setGpsMessage(error instanceof Error ? error.message : "Não foi possível recuperar a localização.");
      toast.error("Falha na recuperação do GPS. A corrida não foi alterada.");
    } finally {
      setQa280Recovering(false);
    }
  }, [userId,online,qa280Recovering,setDesiredOnline,startWatch]);

`;
once("  // realtime: ofertas (broadcast) + corrida ativa — canal estável",
 handler+"  // realtime: ofertas (broadcast) + corrida ativa — canal estável", "recover method before stable realtime channel");
const overlay=`      {/* QA280: keep GPS recovery reachable throughout an accepted ride,
          even when the normal ONLINE/OFFLINE panel is hidden. */}
      {!incoming && !ratingRide && active &&
        ["motorista_a_caminho","motorista_chegou","em_viagem"].includes(active.status) && (
        <div data-apois-qa280-active-gps-recovery="true"
          className="absolute right-3 z-[39] max-w-[200px] rounded-[14px] border border-[#E7D6D9] bg-white/95 p-2 text-right shadow-lg"
          style={{top:"calc(env(safe-area-inset-top) + 72px)"}}>
          <button type="button" onClick={() => void recoverActiveRideGps()}
            disabled={qa280Recovering || gpsStatus === "loading"}
            className="min-h-[40px] w-full rounded-lg bg-[#E51B23] px-3 text-xs font-bold text-white disabled:opacity-60">
            {qa280Recovering || gpsStatus === "loading" ? "Verificando GPS…" :
              online ? "Verificar / recuperar GPS" : "Recuperar GPS e ficar ONLINE"}
          </button>
          {!online && <p className="mt-1 text-[11px] font-semibold text-[#9E1B2A]">
            Corrida ativa com localização desconectada
          </p>}
        </div>
      )}
`;
once("      {/* ===== Corrida ativa =====",overlay+"      {/* ===== Corrida ativa =====","active ride GPS control");
for (const required of [
  "APOIS_PARTNER_QA280_ACTIVE_GPS_RECOVERY_V1",
  "recoverActiveRideGps",
  "data-apois-qa280-active-gps-recovery",
  "await startNativeDriverLocation()",
  'rpc("driver_set_presence"',
  "if (data?.is_online !== true)",
  "activeRef.current?.id !== ride.id",
  "await setApoisOperationalNotification(\"motorista\", true",
  "await Geolocation.getCurrentPosition({",
  "if (!online) setDesiredOnline(true)",
  "await callStart({data:{rideId:ride.id,safety_code:code}})",
]) if (!source.includes(required)) throw Error("[FAIL] QA280 missing "+required);
writeFileSync(path,source,"utf8");
console.log("[OK] QA280 Motorista: active GPS recovery is user initiated, read/ACK validated, no ride/PIN/finance modifications");
