import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { APOIS_MAP_BACKGROUND, APOIS_MAP_ROUTE, mapStyleDeclaration } from './apois-map-palette.mjs';

const target = resolve('.work/corridas/src/components/map/PassengerMap.tsx');
const mapServicePath = resolve('.work/corridas/src/services/maps/map-service.ts');
const routeConfigPath = resolve('.work/corridas/src/services/routes/route-config.ts');
const locationPath = resolve('.work/corridas/src/hooks/use-location.tsx');
const loaderPath = resolve('.work/corridas/src/services/google/google-maps-loader.ts');
const markerDir = resolve('.work/corridas/public/assets/markers');
const pickupMarkerPath = resolve(markerDir, 'apois-location.svg');

function replaceRequired(source, search, replacement, label) {
  if (source.includes(replacement)) return source;
  if (!source.includes(search)) throw new Error(`[FAIL] Native map: ${label}`);
  return source.replace(search, replacement);
}

function ensureSingleLine(source, line, anchor) {
  const lines = source.split('\n').filter((value) => value !== line);
  const normalized = lines.join('\n');
  if (!normalized.includes(anchor)) throw new Error(`[FAIL] Native map: import anchor ausente para ${line}`);
  return normalized.replace(anchor, `${anchor}\n${line}`);
}

// Ask for location permission on first use and prefer a fresh high-accuracy fix.
let locationSource = readFileSync(locationPath, 'utf8');
if (!locationSource.includes('APOIS_PRECISE_LOCATION_V1')) {
  locationSource = locationSource.replace(
    '  const requestPermission = useCallback(async () => {',
    '  // APOIS_PRECISE_LOCATION_V1\n  const requestPermission = useCallback(async () => {',
  );
  locationSource = locationSource.replace(
    'const status = await Geolocation.requestPermissions({ permissions: ["location"] });',
    'const status = await Geolocation.requestPermissions({ permissions: ["location", "coarseLocation"] });',
  );
  const oldStart = `    const start = async () => {
      const permission = await checkPermissions();
      if (!mountedRef.current || permission !== "granted") return;

      await refreshLocation();`;
  const newStart = `    const start = async () => {
      let permission = await checkPermissions();
      if (!mountedRef.current) return;

      if (permission === "prompt" || permission === "unknown") {
        try {
          const requested = await Geolocation.requestPermissions({
            permissions: ["location", "coarseLocation"],
          });
          permission = normalizePermission(requested.location);
          if (mountedRef.current) setPermissionState(permission);
        } catch (permissionError) {
          console.warn("[LocationProvider] Startup permission request failed", permissionError);
        }
      }

      if (!mountedRef.current || permission !== "granted") {
        if (mountedRef.current && permission !== "denied") {
          setError("Permita a localização precisa para mostrarmos seu ponto exato no mapa.");
        }
        return;
      }

      await refreshLocation();`;
  if (!locationSource.includes(oldStart)) {
    throw new Error('[FAIL] localização Corridas: bloco start não encontrado');
  }
  locationSource = locationSource.replace(oldStart, newStart);
  locationSource = locationSource
    .replace('maximumAge: 5_000,', 'maximumAge: 0,')
    .replace('maximumAge: 30_000,', 'maximumAge: 10_000,');
  writeFileSync(locationPath, locationSource, 'utf8');
}
locationSource = readFileSync(locationPath, 'utf8');
for (const marker of [
  'APOIS_PRECISE_LOCATION_V1',
  'permissions: ["location", "coarseLocation"]',
  'enableHighAccuracy: true',
  'maximumAge: 0',
  'Geolocation.watchPosition(',
]) {
  if (!locationSource.includes(marker)) throw new Error(`[FAIL] localização Corridas sem marcador: ${marker}`);
}

// Branded pickup marker materialized into Vite public assets.
mkdirSync(markerDir, { recursive: true });
writeFileSync(
  pickupMarkerPath,
  `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="78" viewBox="0 0 64 78"><defs><filter id="s" x="-30%" y="-20%" width="160%" height="170%"><feDropShadow dx="0" dy="5" stdDeviation="4" flood-color="#111111" flood-opacity=".22"/></filter></defs><g filter="url(#s)"><path d="M32 2C15.4 2 2 15.4 2 32c0 21.6 30 44 30 44s30-22.4 30-44C62 15.4 48.6 2 32 2Z" fill="#E51B23" stroke="#fff" stroke-width="4"/><circle cx="32" cy="31" r="15" fill="#fff"/><path d="M23 42 31.4 19h3.2L43 42h-6l-1.7-5H30.6l-1.7 5H23Zm9.1-10h1.8L33 28.8 32.1 32Z" fill="#E51B23"/></g></svg>`,
  'utf8',
);

// Camera padding: keep most of the map visible above the compact bottom sheet.
let routeConfigSource = readFileSync(routeConfigPath, 'utf8');
routeConfigSource = routeConfigSource
  .replace('TOP: 100,', 'TOP: 72,')
  .replace('RIGHT: 50,', 'RIGHT: 28,')
  .replace('BOTTOM: 350,', 'BOTTOM: 220,')
  .replace('LEFT: 50,', 'LEFT: 28,');
writeFileSync(routeConfigPath, routeConfigSource, 'utf8');

// WebView: preserve full Referer for website-restricted Maps JavaScript keys.
// origin-only opt-in requires a corresponding pathless domain restriction.
// Keep the Google Cloud key restrictions intact; do NOT relax billing or access.
let loaderSource = readFileSync(loaderPath, 'utf8');
if (!loaderSource.includes('APOIS_WEBVIEW_REFERRER_COMPAT_V1')) {
  const oldReferrer = '          auth_referrer_policy: "origin",';
  if (!loaderSource.includes(oldReferrer)) throw new Error('[FAIL] Google Maps loader: origin-only parameter not found');
  loaderSource = loaderSource.replace(
    oldReferrer,
    '          // APOIS_WEBVIEW_REFERRER_COMPAT_V1: normal HTTP referrer, sem origin-only',
  );
}
if (loaderSource.includes('auth_referrer_policy: "origin"')) throw new Error('[FAIL] Referrer origin-only ainda ativo');
writeFileSync(loaderPath, loaderSource, 'utf8');

// Native map service: bright map, APOIS red route, driver marker support and no missing PNG assets.
let mapServiceSource = readFileSync(mapServicePath, 'utf8');
const nativeStyle = mapStyleDeclaration('APOIS_MAP_STYLE_LIGHT_NATIVE');
if (!mapServiceSource.includes('APOIS_MAP_STYLE_LIGHT_NATIVE')) {
  mapServiceSource = mapServiceSource.replace('class MapService {', nativeStyle + '\n\nclass MapService {');
}

mapServiceSource = mapServiceSource
  .replace('import { MAP_STYLE_DARK, DEFAULT_ZOOM } from "./map-config";', 'import { DEFAULT_ZOOM } from "./map-config";')
  .replace('styles: MAP_STYLE_DARK,', 'styles: APOIS_MAP_STYLE_LIGHT_NATIVE,')
  .replace('strokeColor: ROUTE_CONFIG.STYLE.STROKE_COLOR,', 'strokeColor: "#E51B23",')
  .replace('        iconUrl: "assets/markers/pickup.png",\n', '        iconUrl: "assets/markers/apois-location.svg",\n')
  .replace('        iconUrl: "assets/markers/destination.png",\n', '');

if (!mapServiceSource.includes('driverMarkerId: Map<string, string>')) {
  mapServiceSource = replaceRequired(
    mapServiceSource,
    '  private destinationMarkerId: Map<string, string> = new Map();',
    '  private destinationMarkerId: Map<string, string> = new Map();\n  private driverMarkerId: Map<string, string> = new Map();',
    'estado do marcador do motorista não pôde ser inserido',
  );
}

if (!mapServiceSource.includes('public async upsertDriverMarker(')) {
  const anchor = '  public async removeDestinationMarker(mapId: string): Promise<void> {';
  const methods = `  public async upsertDriverMarker(mapId: string, coordinate: MapCoordinates): Promise<void> {
    const map = this.maps.get(mapId);
    if (!map) return;
    const existingId = this.driverMarkerId.get(mapId);
    try {
      if (existingId) await map.removeMarker(existingId);
      const markerId = await map.addMarker({ coordinate, title: "Motorista", opacity: 1 });
      this.driverMarkerId.set(mapId, markerId);
    } catch (error) {
      console.error("Error upserting driver marker:", error);
    }
  }

  public async removeDriverMarker(mapId: string): Promise<void> {
    const map = this.maps.get(mapId);
    if (!map) return;
    const id = this.driverMarkerId.get(mapId);
    if (!id) return;
    try {
      await map.removeMarker(id);
    } finally {
      this.driverMarkerId.delete(mapId);
    }
  }

`;
  const index = mapServiceSource.indexOf(anchor);
  if (index < 0) throw new Error('[FAIL] Native map: âncora do marcador de destino ausente');
  mapServiceSource = mapServiceSource.slice(0, index) + methods + mapServiceSource.slice(index);
}

if (!mapServiceSource.includes('this.destinationMarkerId.delete(mapId);\n      this.driverMarkerId.delete(mapId);')) {
  mapServiceSource = replaceRequired(
    mapServiceSource,
    '      this.destinationMarkerId.delete(mapId);',
    '      this.destinationMarkerId.delete(mapId);\n      this.driverMarkerId.delete(mapId);',
    'cleanup do marcador do motorista não pôde ser inserido',
  );
}
if (mapServiceSource.includes('assets/markers/pickup.png') || mapServiceSource.includes('assets/markers/destination.png')) {
  throw new Error('[FAIL] Native map: referência a marker PNG inexistente permaneceu');
}
writeFileSync(mapServicePath, mapServiceSource, 'utf8');

// PassengerMap: the Corridas adapter already restores persisted polylines.
// This hardener layers native Android rendering on top without duplicating imports/state.
let source = readFileSync(target, 'utf8');

// APOIS Maps V3: a versao JavaScript/fallback compartilha exatamente o mesmo
// esquema de ruas, agua azul-marinho e construcoes do SDK nativo Android.
const webDeclaration = mapStyleDeclaration('APOIS_PASSENGER_MAP_STYLE_V3');
if (!source.includes('const APOIS_PASSENGER_MAP_STYLE_V3 =')) {
  source = replaceRequired(source, 'type MapStatus =', webDeclaration + String.fromCharCode(10, 10) + 'type MapStatus =', 'estilo visual unificado do mapa web ausente');
}
// Diagnostic classification: never display the API key, script URL or cookies.
const diagMarker = 'APOIS_MAP_ERROR_DIAGNOSTIC_V1';
const expectedWebOptions = '        styles: APOIS_PASSENGER_MAP_STYLE_V3,';
if (!source.includes(expectedWebOptions)) {
  source = replaceRequired(
    source,
    '        backgroundColor: "#e5e7eb",',
    '        backgroundColor: "' + APOIS_MAP_BACKGROUND + '",' + String.fromCharCode(10) + expectedWebOptions,
    'aplicacao do mapa APOIS no fallback web ausente',
  );
}
source = source.replace('strokeColor: "#FFB800",', 'strokeColor: "' + APOIS_MAP_ROUTE + '",');


source = ensureSingleLine(
  source,
  'import { Capacitor } from "@capacitor/core";',
  'import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";',
);
source = ensureSingleLine(
  source,
  'import { mapService } from "@/services/maps/map-service";',
  'import { Capacitor } from "@capacitor/core";',
);
source = ensureSingleLine(
  source,
  'import { PolylineDecoder } from "@/services/routes/polyline-decoder";',
  'import { googleMapsLoader } from "@/services/google/google-maps-loader";',
);

const polylineImport = 'import { PolylineDecoder } from "@/services/routes/polyline-decoder";';
if ((source.split(polylineImport).length - 1) !== 1) {
  throw new Error('[FAIL] Native map: PolylineDecoder deve ser importado exatamente uma vez');
}

if (!source.includes('  encodedPolyline,\n  driverLocation,')) {
  source = replaceRequired(
    source,
    '  destination: customDestination,\n  driverLocation,',
    '  destination: customDestination,\n  encodedPolyline,\n  driverLocation,',
    'encodedPolyline não pôde ser ligado ao PassengerMap',
  );
}

if (!source.includes('APOIS_NATIVE_MAP_FALLBACK_V3')) {
  source = replaceRequired(
    source,
    '  const [status, setStatus] = useState<MapStatus>("loading");\n  const [reloadKey, setReloadKey] = useState(0);',
    '  const [status, setStatus] = useState<MapStatus>("loading");\n  const [reloadKey, setReloadKey] = useState(0);\n  const nativeModeRef = useRef(false);\n  const nativeMapIdRef = useRef("apois-passenger-native-map");\n  const nativeApiKey = String(import.meta.env["VITE_GOOGLE_MAPS_NATIVE_API_KEY"] ?? "").trim();\n  // APOIS_NATIVE_MAP_FALLBACK_V3',
    'estado nativo não pôde ser inserido',
  );

  const legacyPoints = `  const displayedRoutePoints = useMemo(() => {
    if (route?.decodedPoints && route.decodedPoints.length > 1) return route.decodedPoints;
    if (!encodedPolyline) return [];
    try {
      return PolylineDecoder.decode(encodedPolyline);
    } catch (error) {
      console.warn("[PassengerMap] Polyline persistida inválida", error);
      return [];
    }
  }, [encodedPolyline, route?.decodedPoints]);`;
  const preferredPoints = `  const displayedRoutePoints = useMemo(() => {
    if (encodedPolyline) {
      try {
        return PolylineDecoder.decode(encodedPolyline);
      } catch (error) {
        console.warn("[PassengerMap] Polyline persistida inválida", error);
      }
    }
    if (route?.decodedPoints && route.decodedPoints.length > 1) return route.decodedPoints;
    return [];
  }, [encodedPolyline, route?.decodedPoints]);`;
  if (source.includes(legacyPoints)) source = source.replace(legacyPoints, preferredPoints);
  if (!source.includes(preferredPoints)) {
    if (source.includes('  const validDriverLocation = useMemo<Coordinate | null>(() => {')) {
      source = source.replace(
        '  const validDriverLocation = useMemo<Coordinate | null>(() => {',
        preferredPoints + '\n\n  const validDriverLocation = useMemo<Coordinate | null>(() => {',
      );
    } else {
      throw new Error('[FAIL] Native map: displayedRoutePoints ausente');
    }
  }

  source = replaceRequired(
    source,
    '  const initializeMap = useCallback(async (): Promise<void> => {\n    console.log("[PassengerMap] Initializing map...", { reloadKey, hasElement: !!mapElementRef.current });\n    if (!mapElementRef.current) return;\n    setStatus("loading");',
    '  const initializeMap = useCallback(async (): Promise<void> => {\n    console.log("[PassengerMap] Initializing map...", { reloadKey, hasElement: !!mapElementRef.current });\n    if (!mapElementRef.current) return;\n    setStatus("loading");\n\n    if (Capacitor.isNativePlatform() && nativeApiKey) {\n      try {\n        nativeModeRef.current = true;\n        mapElementRef.current.id = nativeMapIdRef.current;\n        await mapService.destroyMap(nativeMapIdRef.current).catch(() => undefined);\n        await mapService.createMap(mapElementRef.current, nativeApiKey, origin ?? DEFAULT_CENTER);\n        if (origin) await mapService.upsertPickupMarker(nativeMapIdRef.current, origin);\n        setStatus("ready");\n        console.log("[PassengerMap] Native Google Map ready");\n        return;\n      } catch (nativeError) {\n        nativeModeRef.current = false;\n        console.error("[PassengerMap] Native map failed, falling back to JS map", nativeError);\n      }\n    }',
    'inicialização nativa não pôde ser inserida',
  );

  source = source
    .replace('  }, [isStatic, origin, reloadKey]);', '  }, [isStatic, nativeApiKey, reloadKey]);')
    .replace('  }, [isStatic, nativeApiKey, origin, reloadKey]);', '  }, [isStatic, nativeApiKey, reloadKey]);');

  const initEffectAnchor = '  useEffect(() => {\n    void initializeMap();';
  const transparentEffect = `  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const previousHtml = document.documentElement.style.backgroundColor;
    const previousBody = document.body.style.backgroundColor;
    const changed: Array<{ element: HTMLElement; backgroundColor: string }> = [];
    let element: HTMLElement | null = containerRef.current;
    while (element) {
      changed.push({ element, backgroundColor: element.style.backgroundColor });
      element.style.backgroundColor = "transparent";
      element = element.parentElement;
    }
    document.documentElement.style.backgroundColor = "transparent";
    document.body.style.backgroundColor = "transparent";
    return () => {
      for (const entry of changed) entry.element.style.backgroundColor = entry.backgroundColor;
      document.documentElement.style.backgroundColor = previousHtml;
      document.body.style.backgroundColor = previousBody;
    };
  }, []);

`;
  const initIndex = source.indexOf(initEffectAnchor);
  if (initIndex < 0) throw new Error('[FAIL] Native map: effect de inicialização ausente');
  source = source.slice(0, initIndex) + transparentEffect + source.slice(initIndex);

  if (!source.includes('void mapService.destroyMap(nativeMapIdRef.current).catch(() => undefined);')) {
    source = replaceRequired(
      source,
      '      if (driverAnimationRef.current !== null) cancelAnimationFrame(driverAnimationRef.current);',
      '      if (driverAnimationRef.current !== null) cancelAnimationFrame(driverAnimationRef.current);\n      if (nativeModeRef.current) void mapService.destroyMap(nativeMapIdRef.current).catch(() => undefined);',
      'cleanup do mapa nativo não pôde ser inserido',
    );
  }

  const nativeEffect = `
  useEffect(() => {
    if (!nativeModeRef.current || status !== "ready") return;
    const mapId = nativeMapIdRef.current;
    void (async () => {
      if (origin) await mapService.upsertPickupMarker(mapId, origin);
      if (destination) await mapService.upsertDestinationMarker(mapId, destination);
      else await mapService.removeDestinationMarker(mapId);

      if (validDriverLocation) await mapService.upsertDriverMarker(mapId, validDriverLocation);
      else await mapService.removeDriverMarker(mapId);

      const points = displayedRoutePoints;
      if (points.length > 1) {
        await mapService.upsertRoutePolyline(mapId, points);
        await mapService.fitRouteBounds(mapId, points);
      } else {
        await mapService.removeRoutePolyline(mapId);
        if (origin && destination) await mapService.fitPickupAndDestination(mapId, origin, destination, 110);
        else if (origin) await mapService.setCamera(mapId, { coordinate: origin, zoom: 16 });
        else if (validDriverLocation) await mapService.setCamera(mapId, { coordinate: validDriverLocation, zoom: 16 });
      }
    })().catch((error) => console.error("[PassengerMap] Native marker/route sync failed", error));
  }, [destination, displayedRoutePoints, origin, status, validDriverLocation]);

`;
  const jsEffectAnchor = '  useEffect(() => {\n    if (!mapRef.current || status !== "ready") return;\n    const maps = (window as any).google?.maps;';
  const jsIndex = source.indexOf(jsEffectAnchor);
  if (jsIndex < 0) throw new Error('[FAIL] Native map: effect JS ausente');
  source = source.slice(0, jsIndex) + nativeEffect + source.slice(jsIndex);

  source = replaceRequired(
    source,
    '  const retry = () => {\n    googleMapsLoader.reset();',
    '  const retry = () => {\n    if (nativeModeRef.current) void mapService.destroyMap(nativeMapIdRef.current).catch(() => undefined);\n    nativeModeRef.current = false;\n    googleMapsLoader.reset();',
    'retry nativo não pôde ser inserido',
  );

  source = source
    .replace(
      'className="relative h-full min-h-[320px] w-full overflow-hidden bg-zinc-200"',
      'className="relative h-full min-h-[320px] w-full overflow-hidden bg-transparent"',
    )
    .replace(
      'className="absolute inset-0 h-full w-full" aria-label="Mapa da corrida"',
      'className="absolute inset-0 h-full w-full bg-transparent" aria-label="Mapa da corrida"',
    );
}

source = source.replace(
  'const easeOutCubic = (progress: number): number => 1 - Math.pow(1 - progress, 3);',
  "const easeOutCubic = (progress: number): number => 1 - Math.pow(1 - progress, 3);\n\nconst APOIS_MAP_STYLE_LIGHT_JS = [\n  { elementType: \"geometry\", stylers: [{ color: \"#F4F5F7\" }] },\n  { elementType: \"labels.text.fill\", stylers: [{ color: \"#4B5563\" }] },\n  { elementType: \"labels.text.stroke\", stylers: [{ color: \"#FFFFFF\" }] },\n  { featureType: \"road\", elementType: \"geometry\", stylers: [{ color: \"#FFFFFF\" }] },\n  { featureType: \"road\", elementType: \"geometry.stroke\", stylers: [{ color: \"#E3E6EA\" }] },\n  { featureType: \"road.highway\", elementType: \"geometry\", stylers: [{ color: \"#ECEFF2\" }] },\n  { featureType: \"poi.park\", elementType: \"geometry\", stylers: [{ color: \"#E8F3EC\" }] },\n  { featureType: \"water\", elementType: \"geometry\", stylers: [{ color: \"#DDEBF5\" }] },\n  { featureType: \"transit\", stylers: [{ visibility: \"off\" }] },\n];",
);
source = source.replace(
  'backgroundColor: "#e5e7eb",',
  'backgroundColor: "#F4F5F7",\n        styles: APOIS_MAP_STYLE_LIGHT_JS,',
);
source = source.replace(
  'if (origin) addCircleMarker(origin, "Sua localização", "#FFB800");',
  'if (origin) {\n      const marker = new maps.Marker({\n        map: mapRef.current,\n        position: origin,\n        title: "Sua localização",\n        optimized: true,\n        zIndex: 80,\n        label: { text: "A", color: "#FFFFFF", fontWeight: "900", fontSize: "13px" },\n        icon: {\n          path: "M 0,-18 C -10,-18 -17,-10 -17,0 C -17,12 0,28 0,28 C 0,28 17,12 17,0 C 17,-10 10,-18 0,-18 Z",\n          scale: 1,\n          fillColor: "#E51B23",\n          fillOpacity: 1,\n          strokeColor: "#FFFFFF",\n          strokeWeight: 3,\n          labelOrigin: new maps.Point(0, 0),\n        },\n      });\n      staticMarkersRef.current.push(marker);\n      bounds.extend(origin);\n      pointCount += 1;\n    }',
);

source = source
  .replaceAll('"#FFB800"', '"#E51B23"')
  .replace(
    'mapRef.current.fitBounds(bounds, { top: 170, right: 40, bottom: 330, left: 40 });',
    'mapRef.current.fitBounds(bounds, { top: 120, right: 28, bottom: 240, left: 28 });',
  );

// Erro do mapa precisa ser exibido ACIMA do BottomSheet, que ocupa a metade
// inferior da home. Isso muda apenas a apresentacao do erro, nunca o GPS.
const errorContainerBefore = 'className="absolute inset-0 z-20 flex items-center justify-center bg-zinc-950/90 p-6 text-center"';
const errorContainerAfter = 'className="pointer-events-none absolute inset-x-3 top-[17%] z-[150] flex items-start justify-center text-center"';
source = replaceRequired(source, errorContainerBefore, errorContainerAfter, 'painel de erro do mapa visivel acima dos enderecos');
source = replaceRequired(
  source,
  'className="max-w-xs space-y-4 rounded-3xl border border-white/10 bg-zinc-900 p-6 shadow-2xl"',
  'className="pointer-events-auto w-full max-w-[360px] space-y-3 rounded-[20px] border border-[#F3C9CB] bg-white/95 px-4 py-4 text-[#111827] shadow-[0_14px_40px_rgba(0,0,0,.24)]"',
  'cartao de erro do mapa legivel e clicavel',
);
source = source
  .replace('className="text-sm font-black uppercase tracking-tight text-apois-yellow"', 'className="text-sm font-black uppercase tracking-tight text-[#E51B23]"')
  .replace('className="text-xs leading-relaxed text-zinc-300"', 'className="text-xs leading-relaxed text-[#374151]"')
  .replace('className="mx-auto flex items-center gap-2 rounded-xl bg-apois-yellow px-4 py-3 text-xs font-black text-black"', 'className="mx-auto flex items-center gap-2 rounded-xl bg-[#E51B23] px-4 py-3 text-xs font-black text-white"');

// Error code surfaced to the tester, never a credential or raw script URL.
if (!source.includes('APOIS_MAP_ERROR_DIAGNOSTIC_V1')) {
  source = replaceRequired(
    source,
    '  const [reloadKey, setReloadKey] = useState(0);',
    '  const [mapDiagnostic, setMapDiagnostic] = useState<string>("loading"); // APOIS_MAP_ERROR_DIAGNOSTIC_V1' + String.fromCharCode(10) + '  const [reloadKey, setReloadKey] = useState(0);',
    'safe map diagnostics state',
  );
}
source = source.replace(
  '    setStatus("loading");\\n\\n    authFailureCleanupRef.current?.();',
  '    setStatus("loading");' + String.fromCharCode(10) + '    setMapDiagnostic("loading");' + String.fromCharCode(10, 10) + '    authFailureCleanupRef.current?.();',
);
source = source.replace(
  'googleWindow.gm_authFailure = () => setStatus("configuration-error");',
  'googleWindow.gm_authFailure = () => { setMapDiagnostic("maps_auth_failure"); setStatus("configuration-error"); };',
);
source = source.replace(
  '      setStatus(isConfigError ? "configuration-error" : "api-error");',
  '      setMapDiagnostic(["maps_script_failed", "maps_timeout", "maps_api_unavailable", "api_key_empty", "configuration_missing"].find((label) => code.includes(label)) ?? "maps_init_failed");' + String.fromCharCode(10) + '      setStatus(isConfigError ? "configuration-error" : "api-error");',
);
source = source.replace(
  '              {status === "configuration-error"',
  '              {status === "configuration-error"',
);
const retryClick = source.indexOf('onClick={retry}');
if (!source.includes('APOIS_MAP_ERROR_DIAGNOSTIC_V1')) throw new Error('[FAIL] PassengerMap: diagnostic state not found');
if (!source.includes('Diagnóstico do mapa:')) {
  if (retryClick < 0) throw new Error('[FAIL] PassengerMap: retry button missing');
  const buttonAt = source.lastIndexOf('<button', retryClick);
  if (buttonAt < 0) throw new Error('[FAIL] PassengerMap: button tag missing');
  const insertAt = source.lastIndexOf(String.fromCharCode(10), buttonAt) + 1;
  source = source.slice(0, insertAt)
    + '            <p className="rounded-lg bg-[#F5F5F6] px-3 py-2 text-[12px] font-semibold text-[#111827]">Diagnóstico do mapa: {mapDiagnostic}</p>'
    + String.fromCharCode(10)
    + source.slice(insertAt);
}

for (const token of ['APOIS_PASSENGER_MAP_STYLE_V3', 'styles: APOIS_PASSENGER_MAP_STYLE_V3,']) {
  if (!source.includes(token)) throw new Error('[FAIL] PassengerMap: mapa estilizado nao aplicado (' + token + ')');
}
writeFileSync(target, source, 'utf8');

// Final invariants.
source = readFileSync(target, 'utf8');
const requiredPassengerMarkers = [
  'APOIS_NATIVE_MAP_FALLBACK_V3',
  '[isStatic, nativeApiKey, reloadKey]',
  'VITE_GOOGLE_MAPS_NATIVE_API_KEY',
  'Capacitor.isNativePlatform()',
  'mapService.createMap',
  'mapService.upsertPickupMarker',
  'mapService.upsertDestinationMarker',
  'mapService.upsertDriverMarker',
  'displayedRoutePoints',
  'if (encodedPolyline)',
  'bottom: 240',
  'encodedPolyline,\n  driverLocation,',
  'const previousHtml = document.documentElement.style.backgroundColor',
  'const changed: Array<{ element: HTMLElement',
  'document.body.style.backgroundColor = "transparent"',
  'bg-transparent',
  'APOIS_MAP_STYLE_LIGHT_JS',
  'label: { text: "A"',
  'strokeColor: "#E51B23"',
  'Native Google Map ready',
];
for (const marker of requiredPassengerMarkers) {
  if (!source.includes(marker)) throw new Error(`[FAIL] Native PassengerMap missing marker: ${marker}`);
}
if ((source.split(polylineImport).length - 1) !== 1) {
  throw new Error('[FAIL] Native PassengerMap: PolylineDecoder duplicado após hardening');
}

routeConfigSource = readFileSync(routeConfigPath, 'utf8');
for (const marker of ['TOP: 72', 'RIGHT: 28', 'BOTTOM: 220', 'LEFT: 28']) {
  if (!routeConfigSource.includes(marker)) throw new Error(`[FAIL] Native map route config missing marker: ${marker}`);
}

mapServiceSource = readFileSync(mapServicePath, 'utf8');
for (const marker of ['APOIS_MAP_STYLE_LIGHT_NATIVE', 'styles: APOIS_MAP_STYLE_LIGHT_NATIVE', 'strokeColor: "#E51B23"', 'iconUrl: "assets/markers/apois-location.svg"', 'upsertDriverMarker(', 'removeDriverMarker(']) {
  if (!mapServiceSource.includes(marker)) throw new Error(`[FAIL] Native map service missing marker: ${marker}`);
}
if (mapServiceSource.includes('assets/markers/pickup.png') || mapServiceSource.includes('assets/markers/destination.png')) {
  throw new Error('[FAIL] Native map service reintroduziu marker PNG inexistente');
}

console.log('[OK] Corridas: mapa nativo V3 sem import duplicado, rota persistida, motorista e fallback web.');
