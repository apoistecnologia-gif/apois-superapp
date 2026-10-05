import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const target = resolve('.work/corridas/src/components/map/PassengerMap.tsx');
let source = readFileSync(target, 'utf8');

if (!source.includes('APOIS_NATIVE_MAP_FALLBACK_V1')) {
  source = source.replace(
    'import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";',
    'import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";\nimport { Capacitor } from "@capacitor/core";\nimport { mapService } from "@/services/maps/map-service";',
  );

  source = source.replace(
    '  const [status, setStatus] = useState<MapStatus>("loading");\n  const [reloadKey, setReloadKey] = useState(0);',
    '  const [status, setStatus] = useState<MapStatus>("loading");\n  const [reloadKey, setReloadKey] = useState(0);\n  const nativeModeRef = useRef(false);\n  const nativeMapIdRef = useRef("apois-passenger-native-map");\n  const nativeApiKey = String(import.meta.env["VITE_GOOGLE_MAPS_NATIVE_API_KEY"] ?? "").trim();\n  // APOIS_NATIVE_MAP_FALLBACK_V1',
  );

  source = source.replace(
    '  const initializeMap = useCallback(async (): Promise<void> => {\n    console.log("[PassengerMap] Initializing map...", { reloadKey, hasElement: !!mapElementRef.current });\n    if (!mapElementRef.current) return;\n    setStatus("loading");',
    '  const initializeMap = useCallback(async (): Promise<void> => {\n    console.log("[PassengerMap] Initializing map...", { reloadKey, hasElement: !!mapElementRef.current });\n    if (!mapElementRef.current) return;\n    setStatus("loading");\n\n    if (Capacitor.isNativePlatform() && nativeApiKey) {\n      try {\n        nativeModeRef.current = true;\n        mapElementRef.current.id = nativeMapIdRef.current;\n        await mapService.destroyMap(nativeMapIdRef.current).catch(() => undefined);\n        await mapService.createMap(mapElementRef.current, nativeApiKey, origin ?? DEFAULT_CENTER);\n        if (origin) await mapService.upsertPickupMarker(nativeMapIdRef.current, origin);\n        setStatus("ready");\n        console.log("[PassengerMap] Native Google Map ready");\n        return;\n      } catch (nativeError) {\n        nativeModeRef.current = false;\n        console.error("[PassengerMap] Native map failed, falling back to JS map", nativeError);\n      }\n    }',
  );

  source = source.replace(
    '  }, [isStatic, origin, reloadKey]);',
    '  }, [isStatic, nativeApiKey, origin, reloadKey]);',
  );

  source = source.replace(
    '      if (driverAnimationRef.current !== null) cancelAnimationFrame(driverAnimationRef.current);',
    '      if (driverAnimationRef.current !== null) cancelAnimationFrame(driverAnimationRef.current);\n      if (nativeModeRef.current) void mapService.destroyMap(nativeMapIdRef.current).catch(() => undefined);',
  );

  const nativeEffect = '\n  useEffect(() => {\n    if (!nativeModeRef.current || status !== "ready") return;\n    const mapId = nativeMapIdRef.current;\n    void (async () => {\n      if (origin) await mapService.upsertPickupMarker(mapId, origin);\n      if (destination) await mapService.upsertDestinationMarker(mapId, destination);\n      else await mapService.removeDestinationMarker(mapId);\n\n      const points = route?.decodedPoints?.map((point) => ({ lat: point.lat, lng: point.lng })) ?? [];\n      if (points.length > 1) {\n        await mapService.upsertRoutePolyline(mapId, points);\n        await mapService.fitRouteBounds(mapId, points);\n      } else {\n        await mapService.removeRoutePolyline(mapId);\n        if (origin && destination) await mapService.fitPickupAndDestination(mapId, origin, destination, 110);\n        else if (origin) await mapService.setCamera(mapId, { coordinate: origin, zoom: 16 });\n      }\n    })().catch((error) => console.error("[PassengerMap] Native marker/route sync failed", error));\n  }, [destination, origin, route?.decodedPoints, status]);\n';

  const effectAnchor = '  useEffect(() => {\n    if (!mapRef.current || status !== "ready") return;\n    const maps = (window as any).google?.maps;';
  const idx = source.indexOf(effectAnchor);
  if (idx < 0) throw new Error('[FAIL] Native map: marker effect anchor not found');
  source = source.slice(0, idx) + nativeEffect + source.slice(idx);

  source = source.replace(
    '  const retry = () => {\n    googleMapsLoader.reset();',
    '  const retry = () => {\n    if (nativeModeRef.current) void mapService.destroyMap(nativeMapIdRef.current).catch(() => undefined);\n    nativeModeRef.current = false;\n    googleMapsLoader.reset();',
  );

  writeFileSync(target, source, 'utf8');
}

for (const marker of [
  'APOIS_NATIVE_MAP_FALLBACK_V1',
  'VITE_GOOGLE_MAPS_NATIVE_API_KEY',
  'Capacitor.isNativePlatform()',
  'mapService.createMap',
  'mapService.upsertPickupMarker',
  'mapService.upsertDestinationMarker',
]) {
  if (!source.includes(marker)) throw new Error(`[FAIL] Native map hardener missing marker: ${marker}`);
}
console.log('[OK] Corridas: Android usa mapa nativo quando disponível e mantém JS Maps como fallback web.');
