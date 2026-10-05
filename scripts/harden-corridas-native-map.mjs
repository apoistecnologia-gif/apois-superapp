import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const target = resolve('.work/corridas/src/components/map/PassengerMap.tsx');
const mapServicePath = resolve('.work/corridas/src/services/maps/map-service.ts');
const routeConfigPath = resolve('.work/corridas/src/services/routes/route-config.ts');
let routeConfigSource = readFileSync(routeConfigPath, 'utf8');
routeConfigSource = routeConfigSource
  .replace('TOP: 100,', 'TOP: 72,')
  .replace('RIGHT: 50,', 'RIGHT: 28,')
  .replace('BOTTOM: 350,', 'BOTTOM: 220,')
  .replace('LEFT: 50,', 'LEFT: 28,');
writeFileSync(routeConfigPath, routeConfigSource, 'utf8');
// APOIS_MAP_CAMERA_PADDING_V1


let source = readFileSync(target, 'utf8');
let mapServiceSource = readFileSync(mapServicePath, 'utf8');

// Native Android maps are rendered below the WebView. Keep the native map bright
// and make the WebView/page transparent only on native builds.
if (mapServiceSource.includes('styles: MAP_STYLE_DARK')) {
  mapServiceSource = mapServiceSource
    .replace('import { MAP_STYLE_DARK, DEFAULT_ZOOM } from "./map-config";', 'import { DEFAULT_ZOOM } from "./map-config";')
    .replace('styles: MAP_STYLE_DARK,', 'styles: [],')
    .replace('strokeColor: ROUTE_CONFIG.STYLE.STROKE_COLOR,', 'strokeColor: "#E51B23",');
}

if (!mapServiceSource.includes('driverMarkerId: Map<string, string>')) {
  mapServiceSource = mapServiceSource.replace(
    '  private destinationMarkerId: Map<string, string> = new Map();',
    '  private destinationMarkerId: Map<string, string> = new Map();\n  private driverMarkerId: Map<string, string> = new Map();',
  );
}

if (!mapServiceSource.includes('upsertDriverMarker(')) {
  const anchor = '  public async removeDestinationMarker(mapId: string): Promise<void> {';
  const driverMethods = `  public async upsertDriverMarker(mapId: string, coordinate: MapCoordinates): Promise<void> {
    const map = this.maps.get(mapId);
    if (!map) return;

    const existingId = this.driverMarkerId.get(mapId);
    try {
      if (existingId) await map.removeMarker(existingId);
      const markerId = await map.addMarker({
        coordinate,
        title: "Motorista",
        opacity: 1,
      });
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
  if (index < 0) throw new Error('[FAIL] Native map: destination marker method anchor not found');
  mapServiceSource = mapServiceSource.slice(0, index) + driverMethods + mapServiceSource.slice(index);
}

if (!mapServiceSource.includes('this.destinationMarkerId.delete(mapId);\n      this.driverMarkerId.delete(mapId);')) {
  mapServiceSource = mapServiceSource.replace(
    '      this.destinationMarkerId.delete(mapId);',
    '      this.destinationMarkerId.delete(mapId);\n      this.driverMarkerId.delete(mapId);',
  );
}

mapServiceSource = mapServiceSource
  .replace('        iconUrl: "assets/markers/pickup.png",\n', '')
  .replace('        iconUrl: "assets/markers/destination.png",\n', '');
if (mapServiceSource.includes('assets/markers/')) {
  throw new Error('[FAIL] Native map: referências a marker PNG inexistente permaneceram');
}
// missing marker PNGs removed

writeFileSync(mapServicePath, mapServiceSource, 'utf8');
mapServiceSource = readFileSync(mapServicePath, 'utf8');

for (const marker of ['styles: []', 'upsertDriverMarker(', 'removeDriverMarker(', 'driverMarkerId']) {
  if (!mapServiceSource.includes(marker)) throw new Error(`[FAIL] Native map service missing marker: ${marker}`);
}

source = source
  .replaceAll('"#FFB800"', '"#E51B23"')
  .replace(
    'mapRef.current.fitBounds(bounds, { top: 170, right: 40, bottom: 330, left: 40 });',
    'mapRef.current.fitBounds(bounds, { top: 120, right: 28, bottom: 240, left: 28 });',
  );

if (!source.includes('APOIS_NATIVE_MAP_FALLBACK_V2')) {
  source = source.replace(
    'import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";',
    'import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";\nimport { Capacitor } from "@capacitor/core";\nimport { mapService } from "@/services/maps/map-service";',
  );

  const polylineImport = 'import { PolylineDecoder } from "@/services/routes/polyline-decoder";';
  const polylineImportCount = source.split(polylineImport).length - 1;
  if (polylineImportCount === 0) {
    source = source.replace(
      'import { googleMapsLoader } from "@/services/google/google-maps-loader";',
      'import { googleMapsLoader } from "@/services/google/google-maps-loader";\n' + polylineImport,
    );
  } else if (polylineImportCount > 1) {
    let kept = false;
    source = source.split('\n').filter((line) => {
      if (line !== polylineImport) return true;
      if (kept) return false;
      kept = true;
      return true;
    }).join('\n');
  }
  if ((source.split(polylineImport).length - 1) !== 1) {
    throw new Error('[FAIL] Native map: PolylineDecoder import deve existir exatamente uma vez');
  }
  // POLYLINE_IMPORT_DEDUP_V1

  source = source.replace(
    'const PassengerMap: React.FC<PassengerMapProps> = ({\n  origin: customOrigin,\n  destination: customDestination,\n  driverLocation,',
    'const PassengerMap: React.FC<PassengerMapProps> = ({\n  origin: customOrigin,\n  destination: customDestination,\n  encodedPolyline,\n  driverLocation,',
  );
  if (!source.includes('encodedPolyline,\n  driverLocation,')) {
    throw new Error('[FAIL] Native map: PassengerMap receives encodedPolyline');
  }

  source = source.replace(
    '  const [status, setStatus] = useState<MapStatus>("loading");\n  const [reloadKey, setReloadKey] = useState(0);',
    '  const [status, setStatus] = useState<MapStatus>("loading");\n  const [reloadKey, setReloadKey] = useState(0);\n  const nativeModeRef = useRef(false);\n  const nativeMapIdRef = useRef("apois-passenger-native-map");\n  const nativeApiKey = String(import.meta.env["VITE_GOOGLE_MAPS_NATIVE_API_KEY"] ?? "").trim();\n  // APOIS_NATIVE_MAP_FALLBACK_V2',
  );

  const legacyDisplayedRoutePoints = `  const displayedRoutePoints = useMemo(() => {
    if (route?.decodedPoints && route.decodedPoints.length > 1) return route.decodedPoints;
    if (!encodedPolyline) return [];
    try {
      return PolylineDecoder.decode(encodedPolyline);
    } catch (error) {
      console.warn("[PassengerMap] Polyline persistida inválida", error);
      return [];
    }
  }, [encodedPolyline, route?.decodedPoints]);`;
  const preferredDisplayedRoutePoints = `  const displayedRoutePoints = useMemo(() => {
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
  if (source.includes(legacyDisplayedRoutePoints)) {
    source = source.replace(legacyDisplayedRoutePoints, preferredDisplayedRoutePoints);
  }
  if (!source.includes(preferredDisplayedRoutePoints)) {
    throw new Error('[FAIL] Native map: displayedRoutePoints não foi materializado pelo adaptador');
  }
  // APOIS_ROUTE_POINTS_PRECEDENCE_V1

  source = source.replace(
    '  const initializeMap = useCallback(async (): Promise<void> => {\n    console.log("[PassengerMap] Initializing map...", { reloadKey, hasElement: !!mapElementRef.current });\n    if (!mapElementRef.current) return;\n    setStatus("loading");',
    '  const initializeMap = useCallback(async (): Promise<void> => {\n    console.log("[PassengerMap] Initializing map...", { reloadKey, hasElement: !!mapElementRef.current });\n    if (!mapElementRef.current) return;\n    setStatus("loading");\n\n    if (Capacitor.isNativePlatform() && nativeApiKey) {\n      try {\n        nativeModeRef.current = true;\n        mapElementRef.current.id = nativeMapIdRef.current;\n        await mapService.destroyMap(nativeMapIdRef.current).catch(() => undefined);\n        await mapService.createMap(mapElementRef.current, nativeApiKey, origin ?? DEFAULT_CENTER);\n        if (origin) await mapService.upsertPickupMarker(nativeMapIdRef.current, origin);\n        setStatus("ready");\n        console.log("[PassengerMap] Native Google Map ready");\n        return;\n      } catch (nativeError) {\n        nativeModeRef.current = false;\n        console.error("[PassengerMap] Native map failed, falling back to JS map", nativeError);\n      }\n    }',
  );

  source = source.replace(
    '  }, [isStatic, origin, reloadKey]);',
    '  }, [isStatic, nativeApiKey, reloadKey]);',
  );

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
  const initEffectIndex = source.indexOf(initEffectAnchor);
  if (initEffectIndex < 0) throw new Error('[FAIL] Native map: initialize effect anchor not found');
  source = source.slice(0, initEffectIndex) + transparentEffect + source.slice(initEffectIndex);

  source = source.replace(
    '      if (driverAnimationRef.current !== null) cancelAnimationFrame(driverAnimationRef.current);',
    '      if (driverAnimationRef.current !== null) cancelAnimationFrame(driverAnimationRef.current);\n      if (nativeModeRef.current) void mapService.destroyMap(nativeMapIdRef.current).catch(() => undefined);',
  );

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
  const jsEffectIndex = source.indexOf(jsEffectAnchor);
  if (jsEffectIndex < 0) throw new Error('[FAIL] Native map: JS marker effect anchor not found');
  source = source.slice(0, jsEffectIndex) + nativeEffect + source.slice(jsEffectIndex);

  source = source.replace(
    '  const retry = () => {\n    googleMapsLoader.reset();',
    '  const retry = () => {\n    if (nativeModeRef.current) void mapService.destroyMap(nativeMapIdRef.current).catch(() => undefined);\n    nativeModeRef.current = false;\n    googleMapsLoader.reset();',
  );

  source = source
    .replaceAll(
      'if (route?.decodedPoints && route.decodedPoints.length > 1) {\n      const path = route.decodedPoints.map((point) => ({ lat: point.lat, lng: point.lng }));',
      'if (displayedRoutePoints.length > 1) {\n      const path = displayedRoutePoints;',
    )
    .replace(
      '}, [destination, orderedStops, origin, route?.decodedPoints, status]);',
      '}, [destination, displayRoutePoints, orderedStops, origin, status]);',
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

  writeFileSync(target, source, 'utf8');
}

source = readFileSync(target, 'utf8');
for (const marker of [
  'APOIS_NATIVE_MAP_FALLBACK_V2',
  '[isStatic, nativeApiKey, reloadKey]',
  'VITE_GOOGLE_MAPS_NATIVE_API_KEY',
  'Capacitor.isNativePlatform()',
  'mapService.createMap',
  'mapService.upsertPickupMarker',
  'mapService.upsertDestinationMarker',
  'mapService.upsertDriverMarker',
  'PolylineDecoder',
  'POLYLINE_IMPORT_DEDUP_V1',
  'displayedRoutePoints',
  'APOIS_ROUTE_POINTS_PRECEDENCE_V1',
  'bottom: 240',
  'encodedPolyline,\n  driverLocation,',
  'const previousHtml = document.documentElement.style.backgroundColor',
  'const changed: Array<{ element: HTMLElement',
  'document.body.style.backgroundColor = "transparent"',
  'bg-transparent',
  'Native Google Map ready',
]) {
  if (!source.includes(marker)) throw new Error(`[FAIL] Native PassengerMap missing marker: ${marker}`);
}

routeConfigSource = readFileSync(routeConfigPath, 'utf8');
for (const marker of ['TOP: 72', 'RIGHT: 28', 'BOTTOM: 220', 'LEFT: 28']) {
  if (!routeConfigSource.includes(marker)) throw new Error(`[FAIL] Native map route config missing marker: ${marker}`);
}

mapServiceSource = readFileSync(mapServicePath, 'utf8');
for (const marker of ['styles: []', 'strokeColor: "#E51B23"', 'upsertDriverMarker(', 'removeDriverMarker(']) {
  if (!mapServiceSource.includes(marker)) throw new Error(`[FAIL] Native map service missing final marker: ${marker}`);
}
if (mapServiceSource.includes('assets/markers/')) {
  throw new Error('[FAIL] Native map service reintroduziu marker PNG inexistente');
}

console.log('[OK] Corridas: Android usa mapa nativo claro/transparente, sincroniza motorista e mantém JS Maps como fallback web.');
