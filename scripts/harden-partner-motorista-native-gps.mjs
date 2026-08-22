import './harden-partner-motorista-push-runtime.mjs';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const workspace = process.env.APOIS_MOTORISTA_WORKSPACE || '.work/partner-motorista';
const path = resolve(root, workspace, 'src/routes/motorista.app.tsx');
let source = readFileSync(path, 'utf8');

const routerImport = 'import { createFileRoute, useNavigate } from "@tanstack/react-router";';
if (!source.includes('import { Geolocation } from "@capacitor/geolocation";')) {
  if (!source.includes(routerImport)) throw new Error('Motorista Parceiro: import principal não encontrado.');
  const additions = ['import { Geolocation } from "@capacitor/geolocation";'];
  // back-navigation roda antes deste hardener e já pode ter inserido Capacitor.
  // Nunca duplique o mesmo binding ES module, pois isso quebra a compilação TS/Vite.
  if (!source.includes('import { Capacitor } from "@capacitor/core";')) {
    additions.push('import { Capacitor } from "@capacitor/core";');
  }
  source = source.replace(routerImport, `${routerImport}\n${additions.join('\n')}`);
}
if (!source.includes('import { Capacitor } from "@capacitor/core";')) {
  if (!source.includes(routerImport)) throw new Error('Motorista Parceiro: import principal ausente para Capacitor.');
  source = source.replace(routerImport, `${routerImport}\nimport { Capacitor } from "@capacitor/core";`);
}

const capacitorImportCount = (source.match(/import \{ Capacitor \} from "@capacitor\/core";/g) || []).length;
if (capacitorImportCount !== 1) {
  throw new Error(`[FAIL] Motorista Parceiro: esperado exatamente 1 import de Capacitor; encontrados ${capacitorImportCount}.`);
}

const gpsTypeAnchor = '  type GpsStatus = "prompt" | "loading" | "granted" | "denied" | "timeout" | "unavailable" | "error";';
if (!source.includes('const isNativeDriverAndroid =')) {
  if (!source.includes(gpsTypeAnchor)) throw new Error('Motorista Parceiro: âncora de estado GPS não encontrada.');
  source = source.replace(
    gpsTypeAnchor,
    `${gpsTypeAnchor}\n  const isNativeDriverAndroid = () => Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";`,
  );
}

const oldFastRequest = `    const requestFastLocation = () => {
      navigator.geolocation.getCurrentPosition(
        onSuccess,
        (err) => {
          if (import.meta.env.DEV) console.warn("[APOIS MOTORISTA] GPS tentativa rápida falhou:", err.code, err.message);
          if (err.code === err.PERMISSION_DENIED) {
            finalFail(err);
            return;
          }
          navigator.geolocation.getCurrentPosition(
            onSuccess,
            finalFail,
            { enableHighAccuracy: true, timeout: 30000, maximumAge: 300000 },
          );
        },
        { enableHighAccuracy: false, timeout: 12000, maximumAge: 300000 },
      );
    };`;

const newFastRequest = `    const requestFastLocation = () => {
      if (isNativeDriverAndroid()) {
        void (async () => {
          let permission = await Geolocation.checkPermissions();
          if (permission.location !== "granted") {
            permission = await Geolocation.requestPermissions({ permissions: ["location", "coarseLocation"] });
          }
          if (permission.location !== "granted") {
            setGpsStatus("denied");
            setGpsMessage("Permita a localização do aparelho para ficar online e receber corridas.");
            return;
          }
          const nativePosition = await Geolocation.getCurrentPosition({
            enableHighAccuracy: true,
            timeout: 20_000,
            maximumAge: 0,
          });
          const coords = nativePosition.coords;
          const rawLat = coords.latitude;
          const rawLng = coords.longitude;
          if (!isBrazilCoordinate(rawLat, rawLng)) {
            setGpsStatus("error");
            setGpsMessage("Sua localização não parece estar no Brasil. Ative o GPS real do aparelho e tente novamente.");
            return;
          }
          const heading = coords.heading !== null && coords.heading !== undefined && Number.isFinite(coords.heading) ? coords.heading : null;
          const speed = coords.speed !== null && coords.speed !== undefined && Number.isFinite(coords.speed) ? coords.speed : null;
          activateOnlineWithCoords(rawLat, rawLng, heading, speed, false);
        })().catch((error) => {
          console.warn("[APOIS MOTORISTA] GPS nativo falhou:", error);
          setGpsStatus("error");
          setGpsMessage("Não foi possível obter sua localização. Verifique se o GPS está ativo e tente novamente.");
        });
        return;
      }

      navigator.geolocation.getCurrentPosition(
        onSuccess,
        (err) => {
          if (import.meta.env.DEV) console.warn("[APOIS MOTORISTA] GPS tentativa rápida falhou:", err.code, err.message);
          if (err.code === err.PERMISSION_DENIED) {
            finalFail(err);
            return;
          }
          navigator.geolocation.getCurrentPosition(
            onSuccess,
            finalFail,
            { enableHighAccuracy: true, timeout: 30000, maximumAge: 300000 },
          );
        },
        { enableHighAccuracy: false, timeout: 12000, maximumAge: 300000 },
      );
    };`;

if (source.includes(oldFastRequest)) source = source.replace(oldFastRequest, newFastRequest);

const permissionAnchor = `    const permsApi = (navigator as Navigator & { permissions?: { query: (p: { name: PermissionName }) => Promise<PermissionStatus> } }).permissions;
    if (permsApi?.query) {`;
const permissionReplacement = `    if (isNativeDriverAndroid()) {
      requestFastLocation();
      return;
    }

    const permsApi = (navigator as Navigator & { permissions?: { query: (p: { name: PermissionName }) => Promise<PermissionStatus> } }).permissions;
    if (permsApi?.query) {`;
if (!source.includes('if (isNativeDriverAndroid()) {\n      requestFastLocation();\n      return;')) {
  if (!source.includes(permissionAnchor)) throw new Error('Motorista Parceiro: âncora de permissão web do toggle não encontrada.');
  source = source.replace(permissionAnchor, permissionReplacement);
}

const activationEnd = `  const activateOnlineWithCoords = useCallback(
    (lat: number, lng: number, heading: number | null, speed: number | null, isTest: boolean) => {
      if (!isBrazilCoordinate(lat, lng)) {
        if (import.meta.env.DEV) console.warn("[APOIS MOTORISTA] activate ignorado — coord inválida:", { lat, lng });
        return;
      }
      setPosition({ lat, lng, heading, speed });
      setGpsStatus("granted");
      setGpsMessage(isTest ? "Modo teste ativo com localização no Brasil." : null);
      setShowTestLocationButton(false);
      if (mapRef.current) {
        smoothPanZoom(mapRef.current, { lat, lng }, 16, 700);
        initialCenteredRef.current = true;
      }
      if (!isTest) startWatch();
      setDesiredOnline(true);
      if (import.meta.env.DEV) console.log(\`[APOIS MOTORISTA] online: true (\${isTest ? "modo teste" : "GPS real"})\`);
    },
    [userId, startWatch],
  );`;

const resumeBlock = `${activationEnd}

  // Se o app foi fechado/reaberto enquanto o motorista havia escolhido ficar ONLINE,
  // reidrata a posição pelo GPS nativo antes de republicar a presença. Sem isso a UI
  // podia mostrar ONLINE pelo localStorage enquanto o backend permanecia offline por
  // falta de coordenada válida no novo processo/WebView.
  useEffect(() => {
    if (!userId || !online || position || !isNativeDriverAndroid()) return;
    let cancelled = false;
    void (async () => {
      const permission = await Geolocation.checkPermissions();
      if (permission.location !== "granted") {
        if (!cancelled) {
          setDesiredOnline(false);
          setGpsStatus("denied");
          setGpsMessage("Localização precisa ser permitida novamente para continuar online.");
        }
        return;
      }
      const nativePosition = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 20_000,
        maximumAge: 10_000,
      });
      if (cancelled) return;
      const coords = nativePosition.coords;
      if (!isBrazilCoordinate(coords.latitude, coords.longitude)) {
        setDesiredOnline(false);
        setGpsStatus("error");
        setGpsMessage("Não foi possível confirmar sua localização para restaurar o modo online.");
        return;
      }
      const heading = coords.heading !== null && coords.heading !== undefined && Number.isFinite(coords.heading) ? coords.heading : null;
      const speed = coords.speed !== null && coords.speed !== undefined && Number.isFinite(coords.speed) ? coords.speed : null;
      activateOnlineWithCoords(coords.latitude, coords.longitude, heading, speed, false);
    })().catch((error) => {
      if (cancelled) return;
      console.warn("[APOIS MOTORISTA] restauração do GPS nativo falhou:", error);
      setDesiredOnline(false);
      setGpsStatus("error");
      setGpsMessage("Não conseguimos restaurar sua localização. Toque em Ficar online para tentar novamente.");
    });
    return () => { cancelled = true; };
  }, [userId, online, position, activateOnlineWithCoords, setDesiredOnline]);`;

if (!source.includes('restauração do GPS nativo falhou')) {
  if (!source.includes(activationEnd)) throw new Error('Motorista Parceiro: bloco de ativação online não encontrado.');
  source = source.replace(activationEnd, resumeBlock);
}

for (const marker of [
  'import { Geolocation } from "@capacitor/geolocation";',
  'import { Capacitor } from "@capacitor/core";',
  'const isNativeDriverAndroid = () =>',
  'Geolocation.requestPermissions({ permissions: ["location", "coarseLocation"] })',
  'Geolocation.getCurrentPosition({',
  'if (isNativeDriverAndroid()) {\n      requestFastLocation();',
  'restauração do GPS nativo falhou',
  'Não conseguimos restaurar sua localização. Toque em Ficar online para tentar novamente.',
]) {
  if (!source.includes(marker)) throw new Error(`Motorista Parceiro: hardening GPS nativo incompleto (${marker}).`);
}

writeFileSync(path, source, 'utf8');
console.log('[OK] Motorista Parceiro: entrada ONLINE usa GPS nativo no Android, sem import Capacitor duplicado, e restaura presença após reabertura sem estado ONLINE fantasma.');
