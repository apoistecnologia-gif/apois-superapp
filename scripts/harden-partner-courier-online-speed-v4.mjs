import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

// Minimize activation latency without bypassing the authoritative RPC, push
// registration or mandatory Android background location service.
const root = resolve(process.env.APOIS_ENTREGAS_WORKSPACE || ".work/partner-entregador");
const routePath = resolve(root, "src/routes/courier.tsx");
let route = readFileSync(routePath, "utf8");
const start = route.indexOf("  const toggleOnline = async () => {");
const end = route.indexOf("\n  const acceptOffer = async", start);
if (start < 0 || end <= start) throw Error("[FAIL] Courier online: toggle boundaries changed");
let toggle = route.slice(start, end);
const gpsStart = toggle.indexOf('        let coords: {');
const gpsEnd = toggle.indexOf('        const { error: locationError }', gpsStart);
if (gpsStart < 0 || gpsEnd <= gpsStart) throw Error("[FAIL] Courier online: native/web GPS acquisition boundaries changed");
const fastGps = `        // APOIS_COURIER_FAST_ONLINE_V4: native home already has a recent
        // GPS fix; otherwise use the existing platform-specific acquisition.
        // The server bootstrap and FGS still validate eligibility/permission.
        const gpsFix = currentPosition &&
          Date.now() - currentPosition.recordedAt <= 20_000 &&
          currentPosition.accuracy !== null &&
          currentPosition.accuracy <= 100 &&
          Number.isFinite(currentPosition.lat) &&
          Number.isFinite(currentPosition.lng)
          ? currentPosition : null;

        const initialPosition: CourierPosition = gpsFix ?? await (async () => {
          let coords: {
            latitude: number; longitude: number; accuracy: number;
            heading?: number | null; speed?: number | null;
          };
          if (isNativeCourierAndroid()) {
            let permission = await Geolocation.checkPermissions();
            if (permission.location !== "granted") {
              permission = await Geolocation.requestPermissions({
                permissions: ["location", "coarseLocation"],
              });
            }
            if (permission.location !== "granted") {
              throw new Error("Permita a localização para ficar online e receber entregas próximas.");
            }
            const nativePosition = await Geolocation.getCurrentPosition({
              enableHighAccuracy: true, timeout: 10_000, maximumAge: 5_000,
            });
            coords = nativePosition.coords;
          } else {
            if (!navigator.geolocation) {
              throw new Error("Este dispositivo não disponibiliza localização. Ative o GPS para ficar online.");
            }
            const webPosition = await new Promise<GeolocationPosition>((resolve, reject) =>
              navigator.geolocation.getCurrentPosition(
                resolve,
                (geoError) => {
                  const message = geoError.code === geoError.PERMISSION_DENIED
                    ? "Permita o acesso à localização para ficar online."
                    : geoError.code === geoError.POSITION_UNAVAILABLE
                      ? "Não foi possível obter sua localização agora. Verifique o GPS e tente novamente."
                      : "A localização demorou demais para responder. Verifique o GPS e tente novamente.";
                  reject(new Error(message));
                },
                { enableHighAccuracy: true, timeout: 10_000, maximumAge: 5_000 },
              ),
            );
            coords = webPosition.coords;
          }
          return {
            lat: coords.latitude, lng: coords.longitude,
            accuracy: Number.isFinite(coords.accuracy) ? coords.accuracy : null,
            heading: coords.heading !== null && Number.isFinite(coords.heading)
              ? (coords.heading ?? null) : null,
            speed: coords.speed !== null && Number.isFinite(coords.speed)
              ? (coords.speed ?? null) : null,
            recordedAt: Date.now(),
          };
        })();

`;
toggle = toggle.slice(0, gpsStart) + fastGps + toggle.slice(gpsEnd);
const onlineAnchor = '        setCurrentPosition(initialPosition);';
if (!toggle.includes(onlineAnchor)) throw Error("[FAIL] Courier online: FGS-confirmed state not found");
toggle = toggle.replace(onlineAnchor, onlineAnchor +
  '\n        // Render confirmed ONLINE immediately; history/metrics refresh must not block the switch.' +
  '\n        setAvailability((previous: any) => ({ ...(previous ?? {}), is_online: true }));');
const offlineAnchor = '        setCurrentPosition(null);';
if (!toggle.includes(offlineAnchor)) throw Error("[FAIL] Courier online: offline state not found");
toggle = toggle.replace(offlineAnchor, offlineAnchor +
  '\n        setAvailability((previous: any) => ({ ...(previous ?? {}), is_online: false }));');
const refreshAnchor = '      await loadCourierOperations(courier.id);';
if (!toggle.includes(refreshAnchor)) throw Error("[FAIL] Courier online: blocking refresh not found");
toggle = toggle.replace(refreshAnchor,
  '      // Background refresh is non-critical after server confirmation. Keep callbacks and errors.' +
  '\n      void loadCourierOperations(courier.id).catch((refreshError) => {' +
  '\n        console.warn("courier availability reconciliation failed", refreshError);' +
  '\n        setOperationsError("A disponibilidade foi atualizada, mas não foi possível atualizar as ofertas. Tente novamente.");' +
  '\n      });');
if (!toggle.includes('rpc("bootstrap_courier_location"') ||
    !toggle.includes('rpc("set_courier_online"') ||
    !toggle.includes('backgroundStarted = await startCourierNativeLocation();') ||
    !toggle.includes('ensureCourierPushRegistration(true)')) {
  throw Error("[FAIL] Courier online: required server, push or background checks changed");
}
route = route.slice(0, start) + toggle + route.slice(end);
writeFileSync(routePath, route, "utf8");

// Compact visible switch; keep the touch target >=44 px, disabled/busy state,
// aria semantics, and the existing backend-connected callback.
const panelPath = resolve(root, "src/components/CourierPremiumViews.tsx");
let panels = readFileSync(panelPath, "utf8");
const cardStart = panels.indexOf("export function CourierStatusCard(");
const cardEnd = panels.indexOf("export function CourierWaitingSheet(", cardStart);
if (cardStart < 0 || cardEnd <= cardStart) throw Error("[FAIL] Courier status card boundaries");
let card = panels.slice(cardStart, cardEnd);
function once(before, after, label) {
  if (card.split(before).length !== 2) throw Error("[FAIL] Courier status: " + label);
  card = card.replace(before, after);
}
once('relative h-12 w-[4.8rem] shrink-0 rounded-full',
     'relative h-11 w-[3.7rem] shrink-0 rounded-full', "toggle track size");
once('absolute top-1.5 grid h-9 w-9 place-items-center',
     'absolute top-1.5 grid h-8 w-8 place-items-center', "toggle thumb size");
once('left-[2.25rem] bg-black text-primary', 'left-[1.25rem] bg-black text-primary', "toggle thumb active alignment");
once('aria-label={online ? "Ficar offline" : "Ficar online"}',
     'aria-label={busy ? (online ? "Desativando disponibilidade" : "Ativando disponibilidade") : (online ? "Ficar offline" : "Ficar online")}\n          aria-busy={busy || undefined}\n          aria-pressed={online}', "busy accessibility");
panels = panels.slice(0, cardStart) + card + panels.slice(cardEnd);
writeFileSync(panelPath, panels, "utf8");
console.log("[OK] Courier toggle: 44px accessible switch, recent GPS reused, immediate confirmed state and asynchronous offer refresh.");
