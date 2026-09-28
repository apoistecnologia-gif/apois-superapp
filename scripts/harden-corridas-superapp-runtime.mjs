import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();

function patch(path, transform, label) {
  const full = resolve(root, path);
  const before = readFileSync(full, 'utf8');
  const after = transform(before);
  if (after === before) {
    console.log(`[OK] ${label} (já aplicado ou nativo)`);
    return;
  }
  writeFileSync(full, after, 'utf8');
  console.log(`[OK] ${label}`);
}

function requireMarkers(path, markers, label) {
  const source = readFileSync(resolve(root, path), 'utf8');
  const missing = markers.filter((marker) => !source.includes(marker));
  if (missing.length) throw new Error(`[FAIL] ${label}: ${missing.join(' | ')}`);
  console.log(`[OK] ${label}`);
}

// O snapshot fixado usa PassengerMap diretamente na rota da corrida; não existe
// ActiveRideMap/RidePixPaymentCard neste pin. O hardening abaixo atua somente
// nos componentes reais do snapshot e preserva a proteção de ciclo de vida.
patch('.work/corridas/src/hooks/rides/use-active-ride.tsx', (source) => {
  let next = source;

  if (!next.includes('const RIDE_STATUS_ORDER: Record<RideStatus, number>')) {
    next = next.replace(
      'const POLLING_INTERVAL_MS = 12_000;',
      `const POLLING_INTERVAL_MS = 12_000;\n\nconst RIDE_STATUS_ORDER: Record<RideStatus, number> = {\n  agendada: 0,\n  procurar_motorista: 1,\n  motorista_a_caminho: 2,\n  motorista_chegou: 3,\n  em_viagem: 4,\n  finalizada: 5,\n  cancelada_passageiro: 5,\n  cancelada_motorista: 5,\n};\n\nconst isTerminalRideStatus = (status: RideStatus) =>\n  status === \"finalizada\" || status.startsWith(\"cancelada\");`,
    );
  }

  if (!next.includes('const lastAcceptedStatusRef = useRef<RideStatus | null>(null);')) {
    next = next.replace(
      '  const pollingPromiseRef = useRef<Promise<void> | null>(null);',
      '  const pollingPromiseRef = useRef<Promise<void> | null>(null);\n  const lastAcceptedStatusRef = useRef<RideStatus | null>(null);',
    );
  }

  if (!next.includes('lastAcceptedStatusRef.current = null;\n    void activeRideService.unsubscribe();')) {
    next = next.replace(
      '    pollingPromiseRef.current = null;\n    void activeRideService.unsubscribe();',
      '    pollingPromiseRef.current = null;\n    lastAcceptedStatusRef.current = null;\n    void activeRideService.unsubscribe();',
    );
  }

  if (!next.includes('RIDE_STATUS_ORDER[updatedRide.status] < RIDE_STATUS_ORDER[previousStatus]')) {
    next = next.replace(
      '  const handleUpdate = useCallback((updatedRide: ActiveRide) => {\n    if (currentRideIdRef.current && updatedRide.id !== currentRideIdRef.current) return;\n\n    setRide(updatedRide);',
      `  const handleUpdate = useCallback((updatedRide: ActiveRide) => {\n    if (currentRideIdRef.current && updatedRide.id !== currentRideIdRef.current) return;\n\n    const previousStatus = lastAcceptedStatusRef.current;\n    if (previousStatus) {\n      if (isTerminalRideStatus(previousStatus) && updatedRide.status !== previousStatus) return;\n      if (RIDE_STATUS_ORDER[updatedRide.status] < RIDE_STATUS_ORDER[previousStatus]) return;\n    }\n    lastAcceptedStatusRef.current = updatedRide.status;\n\n    setRide(updatedRide);`,
    );
  }

  if (!next.includes('if (currentRideIdRef.current !== rideId) lastAcceptedStatusRef.current = null;')) {
    next = next.replace(
      '        currentRideIdRef.current = rideId;\n        handleUpdate(data);',
      '        if (currentRideIdRef.current !== rideId) lastAcceptedStatusRef.current = null;\n        currentRideIdRef.current = rideId;\n        handleUpdate(data);',
    );
  }

  // Polling de segurança continua em paralelo ao Realtime. O snapshot já mudou
  // algumas vezes a formatação/condição desse efeito, então removemos somente a
  // guarda isRealtimeConnected quando ela estiver presente e validamos o efeito
  // pelo comportamento estrutural (pollCurrentRide + intervalo), não por whitespace.
  next = next
    .replace(/\n\s*isRealtimeConnected\s*\|\|/g, '')
    .replace(/\[isRealtimeConnected,\s*pollCurrentRide,\s*screenState,\s*userId\]/g, '[pollCurrentRide, screenState, userId]');

  if (!next.includes('await loadRide(currentRideId);')) {
    next = next.replace(
      `        if (!activeRide) {\n          if (!currentRideIdRef.current) {\n            setRide(null);\n            setScreenState(\"idle\");\n            setError(null);\n          }\n          return null;\n        }`,
      `        if (!activeRide) {\n          const currentRideId = currentRideIdRef.current;\n          if (currentRideId) {\n            await loadRide(currentRideId);\n          } else {\n            setRide(null);\n            setScreenState(\"idle\");\n            setError(null);\n          }\n          return null;\n        }`,
    );
  }

  return next;
}, 'Corridas: lifecycle monotônico, polling de segurança e retomada terminal');

patch('.work/corridas/src/hooks/use-push-notifications.tsx', (source) => {
  if (source.includes('VITE_APOIS_SUPERAPP_RIDES_PUSH_ENABLED')) return source;
  return source.replace(
    '  useEffect(() => {\n    let cancelled = false;\n\n    const syncPushSession = async () => {',
    '  useEffect(() => {\n    if (import.meta.env["VITE_APOIS_SUPERAPP_RIDES_PUSH_ENABLED"] !== "1") return;\n\n    let cancelled = false;\n\n    const syncPushSession = async () => {',
  );
}, 'Corridas: Push nativo próprio fica isolado até Firebase unificado ser habilitado');


patch('.work/corridas/src/components/map/PassengerMap.tsx', (source) => {
  if (source.includes('APOIS_NATIVE_PASSENGER_MAP_V1')) return source;
  let next = source;

  if (!next.includes('import { Capacitor } from "@capacitor/core";')) {
    next = next.replace(
      'import { googleMapsLoader } from "@/services/google/google-maps-loader";',
      'import { googleMapsLoader } from "@/services/google/google-maps-loader";\nimport { Capacitor } from "@capacitor/core";\nimport { GoogleMap } from "@capacitor/google-maps";',
    );
  }

  next = next.replace(
    '  const mapElementRef = useRef<HTMLDivElement>(null);\n  const mapRef = useRef<any>(null);',
    '  const mapElementRef = useRef<HTMLElement>(null);\n  const mapRef = useRef<any>(null);\n  const nativeMapRef = useRef<GoogleMap | null>(null);\n  const nativeMarkerIdsRef = useRef<string[]>([]);\n  const nativePolylineIdsRef = useRef<string[]>([]);\n  const nativeSyncGenerationRef = useRef(0);',
  );

  next = next.replace(
    '  const [status, setStatus] = useState<MapStatus>("loading");\n  const [reloadKey, setReloadKey] = useState(0);',
    '  const [status, setStatus] = useState<MapStatus>("loading");\n  const [reloadKey, setReloadKey] = useState(0);\n  const nativeAndroid = Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";',
  );

  const initNeedle = '    setStatus("loading");\n\n    authFailureCleanupRef.current?.();';
  const initReplacement = `    setStatus("loading");

    // APOIS_NATIVE_PASSENGER_MAP_V1
    if (nativeAndroid) {
      try {
        const nativeApiKey = String(import.meta.env["VITE_APOIS_ANDROID_MAPS_API_KEY"] ?? "").trim();
        if (!nativeApiKey) throw new Error("android_maps_key_empty");

        document.documentElement.style.backgroundColor = "transparent";
        document.body.style.backgroundColor = "transparent";

        if (nativeMapRef.current) {
          await nativeMapRef.current.destroy().catch(() => undefined);
          nativeMapRef.current = null;
        }

        nativeMapRef.current = await GoogleMap.create({
          id: "apois-passenger-home-map",
          element: mapElementRef.current,
          apiKey: nativeApiKey,
          forceCreate: true,
          config: {
            center: origin ?? DEFAULT_CENTER,
            zoom: origin ? 16 : 13,
          },
        });
        setStatus("ready");
        return;
      } catch (error) {
        console.error("[PassengerMap] Native Google Maps initialization failed", {
          code: error instanceof Error ? error.message : "native_maps_unknown_error",
        });
        setStatus("configuration-error");
        return;
      }
    }

    authFailureCleanupRef.current?.();`;
  if (!next.includes(initNeedle)) throw new Error('[FAIL] PassengerMap: ponto de inicialização não encontrado');
  next = next.replace(initNeedle, initReplacement);

  next = next.replace(
    '  }, [isStatic, origin, reloadKey]);',
    '  }, [isStatic, nativeAndroid, origin, reloadKey]);',
  );

  const effectNeedle = `  useEffect(() => {
    if (!mapRef.current || status !== "ready") return;`;
  const nativeEffect = `  useEffect(() => {
    if (!nativeAndroid || status !== "ready" || !nativeMapRef.current) return;
    const generation = ++nativeSyncGenerationRef.current;
    let cancelled = false;

    void (async () => {
      const nativeMap = nativeMapRef.current;
      if (!nativeMap) return;

      const previousMarkers = nativeMarkerIdsRef.current;
      const previousPolylines = nativePolylineIdsRef.current;
      nativeMarkerIdsRef.current = [];
      nativePolylineIdsRef.current = [];
      if (previousMarkers.length) await nativeMap.removeMarkers(previousMarkers).catch(() => undefined);
      if (previousPolylines.length) await nativeMap.removePolylines(previousPolylines).catch(() => undefined);
      if (cancelled || generation !== nativeSyncGenerationRef.current) return;

      const markers: Array<any> = [];
      if (origin) {
        markers.push({
          coordinate: origin,
          title: "Sua localização",
          tintColor: { r: 246, g: 190, b: 28, a: 255 },
        });
      }
      orderedStops.forEach((stop, index) => {
        if (!isCoordinate(stop.latitude) || !isCoordinate(stop.longitude)) return;
        markers.push({
          coordinate: { lat: stop.latitude, lng: stop.longitude },
          title: stop.label || \`Parada \${index + 1}\`,
        });
      });
      if (destination) {
        markers.push({
          coordinate: destination,
          title: "Destino",
          tintColor: { r: 17, g: 17, b: 17, a: 255 },
        });
      }
      if (validDriverLocation) {
        markers.push({
          coordinate: validDriverLocation,
          title: "Motorista",
          tintColor: { r: 37, g: 99, b: 235, a: 255 },
          zIndex: 50,
        });
      }

      if (markers.length) {
        const ids = await nativeMap.addMarkers(markers);
        if (cancelled || generation !== nativeSyncGenerationRef.current) {
          await nativeMap.removeMarkers(ids).catch(() => undefined);
          return;
        }
        nativeMarkerIdsRef.current = ids;
      }

      if (displayedRoutePoints.length > 1) {
        const ids = await nativeMap.addPolylines([{
          path: displayedRoutePoints.map((point) => ({ lat: point.lat, lng: point.lng })),
          strokeColor: "#F6BE1C",
          strokeWidth: 6,
          geodesic: false,
        }]);
        if (!cancelled && generation === nativeSyncGenerationRef.current) nativePolylineIdsRef.current = ids;
      }

      const focus = [
        origin,
        validDriverLocation,
        ...orderedStops
          .filter((stop) => isCoordinate(stop.latitude) && isCoordinate(stop.longitude))
          .map((stop) => ({ lat: stop.latitude, lng: stop.longitude })),
        destination,
      ].filter(Boolean) as Coordinate[];

      if (!focus.length) return;
      if (focus.length === 1) {
        await nativeMap.setCamera({ coordinate: focus[0], zoom: 16, animate: true });
        return;
      }

      const latMin = Math.min(...focus.map((point) => point.lat));
      const latMax = Math.max(...focus.map((point) => point.lat));
      const lngMin = Math.min(...focus.map((point) => point.lng));
      const lngMax = Math.max(...focus.map((point) => point.lng));
      const span = Math.max(latMax - latMin, lngMax - lngMin);
      const zoom = span < 0.006 ? 16 : span < 0.02 ? 14 : span < 0.08 ? 12 : 10;
      await nativeMap.setCamera({
        coordinate: { lat: (latMin + latMax) / 2, lng: (lngMin + lngMax) / 2 },
        zoom,
        animate: true,
      });
    })().catch((error) => {
      console.error("[PassengerMap] native map sync failed", {
        code: error instanceof Error ? error.message : "native_maps_sync_error",
      });
      if (!cancelled) setStatus("api-error");
    });

    return () => {
      cancelled = true;
    };
  }, [destination, displayedRoutePoints, nativeAndroid, orderedStops, origin, status, validDriverLocation]);

${effectNeedle}`;
  if (!next.includes(effectNeedle)) throw new Error('[FAIL] PassengerMap: efeito web não encontrado');
  next = next.replace(effectNeedle, nativeEffect);

  next = next.replace(
    `    return () => {
      resizeObserverRef.current?.disconnect();
      resizeObserverRef.current = null;
      authFailureCleanupRef.current?.();
      authFailureCleanupRef.current = null;
      if (driverAnimationRef.current !== null) cancelAnimationFrame(driverAnimationRef.current);
    };`,
    `    return () => {
      resizeObserverRef.current?.disconnect();
      resizeObserverRef.current = null;
      authFailureCleanupRef.current?.();
      authFailureCleanupRef.current = null;
      if (driverAnimationRef.current !== null) cancelAnimationFrame(driverAnimationRef.current);
      if (nativeAndroid) {
        nativeSyncGenerationRef.current += 1;
        const nativeMap = nativeMapRef.current;
        nativeMapRef.current = null;
        nativeMarkerIdsRef.current = [];
        nativePolylineIdsRef.current = [];
        void nativeMap?.destroy().catch(() => undefined);
        document.documentElement.style.backgroundColor = "";
        document.body.style.backgroundColor = "";
      }
    };`,
  );

  next = next.replace(
    `  const retry = () => {
    googleMapsLoader.reset();`,
    `  const retry = () => {
    if (nativeMapRef.current) {
      void nativeMapRef.current.destroy().catch(() => undefined);
      nativeMapRef.current = null;
      nativeMarkerIdsRef.current = [];
      nativePolylineIdsRef.current = [];
    }
    googleMapsLoader.reset();`,
  );

  const mapElementNeedle = '      <div ref={mapElementRef} className="absolute inset-0 h-full w-full" aria-label="Mapa da corrida" />';
  const mapElementReplacement = `      {nativeAndroid
        ? React.createElement("capacitor-google-map", {
            ref: mapElementRef,
            "aria-label": "Mapa da corrida",
            style: {
              display: "block",
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              background: "transparent",
            },
          })
        : <div ref={mapElementRef as React.RefObject<HTMLDivElement>} className="absolute inset-0 h-full w-full" aria-label="Mapa da corrida" />}`;
  if (!next.includes(mapElementNeedle)) throw new Error('[FAIL] PassengerMap: elemento visual do mapa não encontrado');
  next = next.replace(mapElementNeedle, mapElementReplacement);

  next = next.replace(
    '    <div ref={containerRef} className="relative h-full min-h-[320px] w-full overflow-hidden bg-zinc-200">',
    '    <div ref={containerRef} className={\`relative h-full min-h-[320px] w-full overflow-hidden \${nativeAndroid ? "bg-transparent" : "bg-zinc-200"}\`}>',
  );

  for (const marker of [
    'APOIS_NATIVE_PASSENGER_MAP_V1',
    'GoogleMap.create({',
    'VITE_APOIS_ANDROID_MAPS_API_KEY',
    'capacitor-google-map',
    'nativeMap.addMarkers',
    'nativeMap.addPolylines',
  ]) {
    if (!next.includes(marker)) throw new Error('[FAIL] PassengerMap nativo incompleto: ' + marker);
  }
  return next;
}, 'Corridas: mapa inicial usa Google Maps nativo no Android e mantém fallback web');

patch('.work/corridas/src/routes/_authenticated.corrida.$rideId.tsx', (source) => {
  let next = source;
  next = next.replace(
    '                {status === "motorista_a_caminho" && (\n                  <SecurityCodeCard code={ride.security_code} />\n                )}',
    '                {["motorista_a_caminho", "motorista_chegou"].includes(status) && (\n                  <SecurityCodeCard code={ride.security_code} />\n                )}',
  );
  return next;
}, 'Corridas: PIN permanece disponível até o início efetivo da viagem');

patch('.work/corridas/src/components/rides/active/RideStatusHeader.tsx', (source) =>
  source.replace(
    'Confira o veículo e informe o PIN somente no embarque.',
    'Informe o código de segurança ao motorista para iniciar.',
  ),
'Corridas: orientação de chegada usa linguagem direta');

const activeRideSource = readFileSync(resolve(root, '.work/corridas/src/hooks/rides/use-active-ride.tsx'), 'utf8');
for (const marker of [
  'const RIDE_STATUS_ORDER: Record<RideStatus, number>',
  'lastAcceptedStatusRef',
  'await loadRide(currentRideId)',
  'pollCurrentRide',
  'POLLING_INTERVAL_MS',
]) {
  if (!activeRideSource.includes(marker)) throw new Error(`[FAIL] Corridas runtime: ${marker}`);
}
if (/screenState\s*!==\s*["']active["'][\s\S]{0,180}isRealtimeConnected\s*\|\|/.test(activeRideSource)) {
  throw new Error('[FAIL] Corridas: polling de segurança ainda depende de isRealtimeConnected');
}
console.log('[OK] Corridas runtime reconciliado com o snapshot atual');

requireMarkers(
  '.work/corridas/src/routes/_authenticated.corrida.$rideId.tsx',
  ['PassengerMap', '["motorista_a_caminho", "motorista_chegou"].includes(status)'],
  'Corridas usa mapa ativo e PIN do snapshot real',
);

console.log('[OK] Corridas: hardening de runtime alinhado ao pin 7b047f75 sem componentes obsoletos');
