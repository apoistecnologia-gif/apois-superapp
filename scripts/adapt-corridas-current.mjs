import './sanitize-corridas-workspace-env.mjs';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const workspace = '.work/corridas';

function patch(path, transform, label) {
  const full = resolve(root, workspace, path);
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
  const source = readFileSync(resolve(root, workspace, path), 'utf8');
  const missing = markers.filter((marker) => !source.includes(marker));
  if (missing.length) throw new Error(`[FAIL] ${label}: ${missing.join(' | ')}`);
  console.log(`[OK] ${label}`);
}

patch('src/integrations/supabase/client.ts', (source) =>
  source.includes('storageKey: "apois-superapp-corridas-auth-v1"')
    ? source
    : source.replace(
        '      storage: typeof window !== "undefined" ? localStorage : undefined,\n      persistSession: true,',
        '      storage: typeof window !== "undefined" ? localStorage : undefined,\n      storageKey: "apois-superapp-corridas-auth-v1",\n      persistSession: true,',
      ),
'Corridas: sessão Supabase isolada no Superapp');

patch('src/hooks/use-location.tsx', (source) =>
  source.replace('const LAST_LOCATION_KEY = "apois-last-location";', 'const LAST_LOCATION_KEY = "apois-superapp-corridas-last-location";'),
'Corridas: cache de localização isolado por módulo');


patch('src/routes/_authenticated.inicio.tsx', (source) => {
  let next = source;
  next = next.replace(
`              <div className="w-10 h-10 rounded-full border-2 border-green-500 overflow-hidden bg-zinc-800">
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-white font-black text-xs">
                    {readString(profile?.full_name || profile?.name, "P")[0]}
                  </div>
                )}
              </div>`,
`              <div className="relative w-10 h-10 rounded-full border-2 border-apois-yellow/70 overflow-hidden bg-zinc-800">
                <div className="absolute inset-0 flex items-center justify-center text-apois-yellow font-black text-sm">
                  {readString(profile?.full_name || profile?.name, "A")[0]}
                </div>
                {profile?.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt="Foto do perfil"
                    className="relative z-10 w-full h-full object-cover"
                    onError={(event) => { event.currentTarget.style.display = "none"; }}
                  />
                ) : null}
              </div>`
  );
  next = next.replace(
    '<span className="text-[10px] text-zinc-500 font-medium">1 motorista próximo</span>',
    '<span className="text-[10px] text-zinc-500 font-medium">Motoristas disponíveis na região</span>',
  );
  return next;
}, 'Corridas: avatar quebrado usa fallback e home não inventa contagem de motoristas');

patch('src/components/map/PassengerMap.tsx', (source) => {
  let next = source;
  if (!next.includes('PolylineDecoder')) {
    next = next.replace(
      'import { googleMapsLoader } from "@/services/google/google-maps-loader";',
      'import { googleMapsLoader } from "@/services/google/google-maps-loader";\nimport { PolylineDecoder } from "@/services/routes/polyline-decoder";',
    );
  }
  if (!next.includes('  encodedPolyline,\n  driverLocation,')) {
    next = next.replace('  destination: customDestination,\n  driverLocation,', '  destination: customDestination,\n  encodedPolyline,\n  driverLocation,');
  }
  if (!next.includes('const displayedRoutePoints = useMemo')) {
    next = next.replace(
      '  const validDriverLocation = useMemo<Coordinate | null>(() => {',
      '  const displayedRoutePoints = useMemo(() => {\n    if (route?.decodedPoints && route.decodedPoints.length > 1) return route.decodedPoints;\n    if (!encodedPolyline) return [];\n    try {\n      return PolylineDecoder.decode(encodedPolyline);\n    } catch (error) {\n      console.warn("[PassengerMap] Polyline persistida inválida", error);\n      return [];\n    }\n  }, [encodedPolyline, route?.decodedPoints]);\n\n  const validDriverLocation = useMemo<Coordinate | null>(() => {',
    );
  }
  next = next.replace(
    '    if (route?.decodedPoints && route.decodedPoints.length > 1) {\n      const path = route.decodedPoints.map((point) => ({ lat: point.lat, lng: point.lng }));',
    '    if (displayedRoutePoints.length > 1) {\n      const path = displayedRoutePoints.map((point) => ({ lat: point.lat, lng: point.lng }));',
  );
  next = next.replace(
    '  }, [destination, orderedStops, origin, route?.decodedPoints, status]);',
    '  }, [destination, displayedRoutePoints, orderedStops, origin, status]);',
  );
  return next;
}, 'Corridas: PassengerMap restaura polyline persistida da corrida');

patch('src/hooks/rides/use-ride-request.tsx', (source) => {
  let next = source;
  if (!next.includes('import { usePickupAddress }')) {
    next = next.replace(
      'import { useRoute } from "@/hooks/use-route";',
      'import { useRoute } from "@/hooks/use-route";\nimport { usePickupAddress } from "@/hooks/use-pickup-address";\nimport { useDestination } from "@/hooks/use-destination";\nimport { usePaymentMethods } from "@/hooks/use-payment-methods";',
    );
  }
  if (!next.includes('paymentMethod: string | null;')) {
    next = next.replace('  destination: RouteCoordinates | null;\n}', '  destination: RouteCoordinates | null;\n  paymentMethod: string | null;\n}');
  }
  if (!next.includes('const { selectedMethod } = usePaymentMethods();')) {
    next = next.replace(
      '  const { route } = useRoute();',
      '  const { route } = useRoute();\n  const { address: pickupAddress, pickupLabel, pickupShortLabel, pickupPlaceId } = usePickupAddress();\n  const { destination } = useDestination();\n  const { selectedMethod } = usePaymentMethods();',
    );
  }
  next = next.replace(
    '    destination: null,\n  });',
    '    destination: null,\n    paymentMethod: null,\n  });',
  );
  next = next.replace(
    '      !sameCoordinates(currentOrigin, requestDataRef.current.origin) ||\n      !sameCoordinates(currentDestination, requestDataRef.current.destination);',
    '      !sameCoordinates(currentOrigin, requestDataRef.current.origin) ||\n      !sameCoordinates(currentDestination, requestDataRef.current.destination) ||\n      selectedMethod !== requestDataRef.current.paymentMethod;',
  );
  next = next.replace(
    '        destination: currentDestination,\n      };',
    '        destination: currentDestination,\n        paymentMethod: selectedMethod,\n      };',
  );
  next = next.replace(
    '  }, [selectedCategory, route, request.requestKey]);',
    '  }, [selectedCategory, selectedMethod, route, request.requestKey]);',
  );
  next = next.replace(
    '        origin_name: "Origem",\n        destination_name: "Destino",\n        distance_km: route.distanceMeters / 1000,\n        duration_min: route.durationSeconds / 60,\n        service_details: {},',
    '        origin_name: pickupLabel || pickupShortLabel || pickupAddress || "Origem",\n        destination_name: destination?.formattedAddress || destination?.label || "Destino",\n        distance_km: route.distanceMeters / 1000,\n        duration_min: route.durationSeconds / 60,\n        pickup_label: pickupLabel,\n        pickup_short_label: pickupShortLabel,\n        pickup_address: pickupAddress,\n        pickup_place_id: pickupPlaceId,\n        pickup_source: "gps",\n        payment_method: selectedMethod,\n        service_details: selectedCategory.details ?? {},',
  );
  next = next.replace(
    '  }, [user, selectedCategory, route, request.requestKey]);',
    '  }, [user, selectedCategory, route, request.requestKey, pickupAddress, pickupLabel, pickupShortLabel, pickupPlaceId, destination, selectedMethod]);',
  );
  next = next.replace(
    '    requestDataRef.current = { category: null, origin: null, destination: null };',
    '    requestDataRef.current = { category: null, origin: null, destination: null, paymentMethod: null };',
  );
  return next;
}, 'Corridas: solicitação usa endereço, destino e pagamento reais com idempotência');

patch('src/services/places/places-service.ts', (source) => {
  let next = source;
  if (!next.includes('private initializationPromise: Promise<void> | null = null;')) {
    next = next.replace(
      '  private isInitializing: boolean = false;\n  private placesLib: any = null;',
      '  private isInitializing: boolean = false;\n  private initializationPromise: Promise<void> | null = null;\n  private placesLib: any = null;',
    );
  }
  const oldInit = `  public async initialize(): Promise<void> {\n    if (this.placesLib) return;\n    if (this.isInitializing) return;\n\n    this.isInitializing = true;\n    try {\n      this.placesLib = await googleMapsLoader.importLibrary("places");\n      this.createSessionToken();\n    } catch (error) {\n      console.error("Failed to initialize Places library:", error);\n      throw this.normalizeError("places_library_load_failed");\n    } finally {\n      this.isInitializing = false;\n    }\n  }`;
  const newInit = `  public async initialize(): Promise<void> {\n    if (this.placesLib) return;\n    if (this.initializationPromise) return this.initializationPromise;\n\n    this.isInitializing = true;\n    this.initializationPromise = (async () => {\n      try {\n        this.placesLib = await googleMapsLoader.importLibrary("places");\n        this.createSessionToken();\n      } catch (error) {\n        console.error("Failed to initialize Places library:", error);\n        throw this.normalizeError("places_library_load_failed");\n      } finally {\n        this.isInitializing = false;\n        this.initializationPromise = null;\n      }\n    })();\n    return this.initializationPromise;\n  }`;
  if (next.includes(oldInit)) next = next.replace(oldInit, newInit);

  const oldNormalize = `  private normalizeSuggestion(s: any): PlaceSuggestion {\n    // A estrutura moderna de AutocompleteSuggestion tem propriedades aninhadas\n    const p = s.placePrediction;\n    return {\n      placeId: p.placeId,\n      primaryText: p.text.mainText.text,\n      secondaryText: p.text.secondaryText?.text,\n      fullText: p.text.text,\n      types: p.types || [],\n      distanceMeters: p.distanceMeters,\n      // Guardamos a referência ao objeto de lugar para o fetchFields posterior\n      // @ts-ignore\n      place: p.toPlace(),\n    };\n  }`;
  const newNormalize = `  private normalizeSuggestion(s: any): PlaceSuggestion {\n    const p = s?.placePrediction;\n    if (!p || (!p.placeId && typeof p.toPlace !== "function")) {\n      throw this.normalizeError("places_invalid_prediction");\n    }\n    const textObject = p.text;\n    const fullText = typeof textObject?.text === "string"\n      ? textObject.text\n      : typeof textObject?.toString === "function"\n        ? String(textObject)\n        : "";\n    const primaryText = typeof textObject?.mainText?.text === "string" && textObject.mainText.text.trim()\n      ? textObject.mainText.text\n      : fullText.split(",")[0]?.trim() || fullText || "Local encontrado";\n    const secondaryText = typeof textObject?.secondaryText?.text === "string" && textObject.secondaryText.text.trim()\n      ? textObject.secondaryText.text\n      : fullText.startsWith(primaryText)\n        ? fullText.slice(primaryText.length).replace(/^\\s*,\\s*/, "").trim()\n        : fullText;\n    return {\n      placeId: p.placeId || primaryText,\n      primaryText,\n      secondaryText: secondaryText || undefined,\n      fullText: fullText || primaryText,\n      types: p.types || [],\n      distanceMeters: p.distanceMeters,\n      place: typeof p.toPlace === "function" ? p.toPlace() : undefined,\n    };\n  }`;
  if (next.includes(oldNormalize)) next = next.replace(oldNormalize, newNormalize);
  return next;
}, 'Corridas: Places aguarda inicialização concorrente e aceita shape real do autocomplete');

patch('src/types/places.ts', (source) =>
  source.includes('  place?: unknown;')
    ? source
    : source.replace(
        '  matchedSubstrings?: Array<{ length: number; offset: number }>;\n}',
        '  matchedSubstrings?: Array<{ length: number; offset: number }>;\n  /** Referência opaca retornada pelo SDK Places e consumida por selectPrediction. */\n  place?: unknown;\n}',
      ),
'Corridas: contrato da sugestão inclui referência opaca necessária à seleção');

patch('src/components/map/PassengerMap.tsx', (source) =>
  source.replace(
    '  }, [destination, displayedRoutePoints, orderedStops, origin, status]);',
    '  }, [destination, displayedRoutePoints, orderedStops, origin, status, validDriverLocation]);',
  ),
'Corridas: câmera reage à localização válida do motorista');


patch('src/components/map/PassengerMap.tsx', (source) => {
  let next = source;
  if (!next.includes('import { Capacitor } from "@capacitor/core";')) {
    next = next.replace(
      'import { googleMapsLoader } from "@/services/google/google-maps-loader";',
      'import { googleMapsLoader } from "@/services/google/google-maps-loader";\nimport { Capacitor } from "@capacitor/core";\nimport { mapService } from "@/services/maps/map-service";',
    );
  }
  if (!next.includes('const WebPassengerMap: React.FC<PassengerMapProps> = (')) {
    next = next.replace(
      'const PassengerMap: React.FC<PassengerMapProps> = (',
      'const WebPassengerMap: React.FC<PassengerMapProps> = (',
    );
  }
  if (!next.includes('const NATIVE_PASSENGER_MAP_ID = "apois-passenger-native-map";')) {
    const marker = 'export default PassengerMap;';
    if (!next.includes(marker)) throw new Error('[FAIL] Corridas: export do PassengerMap não encontrado');
    next = next.replace(marker, `const NATIVE_PASSENGER_MAP_ID = "apois-passenger-native-map";

const NativePassengerMap: React.FC<PassengerMapProps> = ({
  origin: customOrigin,
  destination: customDestination,
  encodedPolyline,
  driverLocation,
  isStatic = false,
}) => {
  const { location } = useLocation();
  const { route } = useRoute();
  const { destination: globalDestination } = useDestination();
  const elementRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<MapStatus>("loading");
  const [reloadKey, setReloadKey] = useState(0);

  const origin = useMemo<Coordinate | null>(() => {
    const lat = customOrigin?.lat ?? location?.latitude;
    const lng = customOrigin?.lng ?? location?.longitude;
    return isCoordinate(lat) && isCoordinate(lng) ? { lat, lng } : null;
  }, [customOrigin?.lat, customOrigin?.lng, location?.latitude, location?.longitude]);

  const destination = useMemo<Coordinate | null>(() => {
    const value = customDestination ?? globalDestination;
    if (!value) return null;
    const lat = "latitude" in value ? value.latitude : value.lat;
    const lng = "longitude" in value ? value.longitude : value.lng;
    return isCoordinate(lat) && isCoordinate(lng) ? { lat, lng } : null;
  }, [customDestination, globalDestination]);

  const displayedRoutePoints = useMemo<Coordinate[]>(() => {
    if (route?.decodedPoints && route.decodedPoints.length > 1) {
      return route.decodedPoints.map((point) => ({ lat: point.lat, lng: point.lng }));
    }
    if (!encodedPolyline) return [];
    try {
      return PolylineDecoder.decode(encodedPolyline);
    } catch {
      return [];
    }
  }, [encodedPolyline, route?.decodedPoints]);

  useEffect(() => {
    let disposed = false;
    const element = elementRef.current;
    if (!element) return;

    const nodes: HTMLElement[] = [];
    let cursor: HTMLElement | null = element;
    while (cursor) {
      nodes.push(cursor);
      if (cursor === document.body) break;
      cursor = cursor.parentElement;
    }
    nodes.push(document.documentElement);
    const previous = nodes.map((node) => ({
      node,
      background: node.style.background,
      backgroundColor: node.style.backgroundColor,
    }));
    for (const item of previous) {
      item.node.style.background = "transparent";
      item.node.style.backgroundColor = "transparent";
    }

    void (async () => {
      setStatus("loading");
      const apiKey = String(import.meta.env.VITE_APOIS_ANDROID_MAPS_API_KEY ?? "").trim();
      if (!apiKey) {
        if (!disposed) setStatus("configuration-error");
        return;
      }
      try {
        await mapService.destroyMap(NATIVE_PASSENGER_MAP_ID).catch(() => undefined);
        if (disposed || !elementRef.current) return;
        elementRef.current.id = NATIVE_PASSENGER_MAP_ID;
        await mapService.createMap(elementRef.current, apiKey, origin ?? DEFAULT_CENTER);
        if (!disposed) setStatus("ready");
      } catch (error) {
        console.error("[PassengerMap] native map initialization failed", {
          message: error instanceof Error ? error.message : "native_map_error",
        });
        if (!disposed) setStatus("api-error");
      }
    })();

    return () => {
      disposed = true;
      void mapService.destroyMap(NATIVE_PASSENGER_MAP_ID).catch(() => undefined);
      for (const item of previous) {
        item.node.style.background = item.background;
        item.node.style.backgroundColor = item.backgroundColor;
      }
    };
  }, [reloadKey]);

  useEffect(() => {
    if (status !== "ready") return;
    void (async () => {
      try {
        mapService.resetCameraMovementState();
        if (origin) await mapService.upsertPickupMarker(NATIVE_PASSENGER_MAP_ID, origin);
        if (destination) {
          await mapService.upsertDestinationMarker(NATIVE_PASSENGER_MAP_ID, destination);
        } else {
          await mapService.removeDestinationMarker(NATIVE_PASSENGER_MAP_ID);
        }
        if (displayedRoutePoints.length > 1) {
          await mapService.upsertRoutePolyline(NATIVE_PASSENGER_MAP_ID, displayedRoutePoints);
          await mapService.fitRouteBounds(NATIVE_PASSENGER_MAP_ID, displayedRoutePoints);
        } else if (origin && destination) {
          await mapService.fitPickupAndDestination(NATIVE_PASSENGER_MAP_ID, origin, destination, 96);
        } else if (origin) {
          await mapService.centerOnPickup(NATIVE_PASSENGER_MAP_ID, origin);
        }
        if (!isStatic && driverLocation && isCoordinate(driverLocation.lat) && isCoordinate(driverLocation.lng)) {
          await mapService.setCamera(
            NATIVE_PASSENGER_MAP_ID,
            { coordinate: { lat: driverLocation.lat, lng: driverLocation.lng }, zoom: 15 },
            true,
          );
        }
      } catch (error) {
        console.error("[PassengerMap] native map update failed", {
          message: error instanceof Error ? error.message : "native_map_update_error",
        });
      }
    })();
  }, [destination, displayedRoutePoints, driverLocation?.lat, driverLocation?.lng, isStatic, origin, status]);

  return (
    <div className="relative h-full min-h-[320px] w-full overflow-hidden bg-transparent">
      <div ref={elementRef} className="absolute inset-0 h-full w-full bg-transparent" aria-label="Mapa da corrida" />
      {status === "loading" && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-zinc-950/70">
          <div className="flex flex-col items-center gap-3 rounded-3xl bg-zinc-900/95 px-6 py-5 shadow-xl">
            <div className="h-9 w-9 animate-spin rounded-full border-4 border-zinc-700 border-t-apois-yellow" />
            <p className="text-xs font-bold text-zinc-200">Carregando mapa...</p>
          </div>
        </div>
      )}
      {(status === "configuration-error" || status === "api-error") && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-zinc-950/90 p-6 text-center">
          <div className="max-w-xs space-y-4 rounded-3xl border border-white/10 bg-zinc-900 p-6 shadow-2xl">
            <p className="text-sm font-black uppercase tracking-tight text-apois-yellow">Mapa indisponível</p>
            <p className="text-xs leading-relaxed text-zinc-300">Não foi possível iniciar o mapa nativo. Tente novamente.</p>
            <button type="button" onClick={() => setReloadKey((value) => value + 1)} className="mx-auto flex items-center gap-2 rounded-xl bg-apois-yellow px-4 py-3 text-xs font-black text-black">
              <RefreshCw size={16} /> Tentar novamente
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const PassengerMap: React.FC<PassengerMapProps> = (props) =>
  Capacitor.isNativePlatform() ? <NativePassengerMap {...props} /> : <WebPassengerMap {...props} />;

export default PassengerMap;`);
  }
  return next;
}, 'Corridas: APK usa Google Maps nativo do Capacitor no Passageiro');



patch('src/hooks/use-location.tsx', (source) =>
  source.replace(
    '      const permission = await checkPermissions();\n      if (!mountedRef.current || permission !== "granted") return;\n\n      await refreshLocation();',
    '      let permission = await checkPermissions();\n      if (!mountedRef.current) return;\n      if (permission === "prompt" || permission === "unknown") {\n        await requestPermission();\n        permission = await checkPermissions();\n      }\n      if (!mountedRef.current || permission !== "granted") return;\n\n      await refreshLocation();',
  ),
'Corridas: solicita localização no primeiro acesso autenticado');

patch('src/routes/_authenticated.tsx', (source) =>
  source.replace(
    'function PushBootstrap() {\n  usePushNotifications();\n  return null;\n}',
    `function PushBootstrap() {
  usePushNotifications();

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const { PushNotifications } = await import("@capacitor/push-notifications");
        let permission = await PushNotifications.checkPermissions();
        if (!active) return;
        if (permission.receive === "prompt" || permission.receive === "prompt-with-rationale") {
          permission = await PushNotifications.requestPermissions();
        }
      } catch (error) {
        console.warn("[push] permission prompt unavailable", {
          message: error instanceof Error ? error.message : "push_permission_error",
        });
      }
    })();
    return () => { active = false; };
  }, []);

  return null;
}`,
  ),
'Corridas: solicita permissão nativa de notificações no runtime autenticado');

patch('src/services/places/places-service.ts', (source) => {
  let next = source;
  if (!next.includes('import { Capacitor } from "@capacitor/core";')) {
    next = next.replace(
      'import { googleMapsLoader } from "../google/google-maps-loader";',
      'import { googleMapsLoader } from "../google/google-maps-loader";\nimport { Capacitor } from "@capacitor/core";\nimport { supabase } from "@/integrations/supabase/client";',
    );
  }

  next = next.replace(
    '    await this.initialize();\n\n    const requestId = ++this.lastRequestId;',
    `    const requestId = ++this.lastRequestId;

    if (Capacitor.isNativePlatform()) {
      try {
        const { data, error } = await supabase.functions.invoke("google-maps-address", {
          body: { action: "autocomplete", input: normalizedQuery },
        });
        if (error) throw error;
        if (requestId !== this.lastRequestId) throw this.normalizeError("places_cancelled");
        const predictions = Array.isArray(data?.predictions) ? data.predictions : [];
        const suggestions: PlaceSuggestion[] = predictions
          .map((prediction: any) => ({
            placeId: String(prediction?.place_id ?? ""),
            primaryText: String(prediction?.structured_formatting?.main_text ?? prediction?.description ?? ""),
            secondaryText: String(prediction?.structured_formatting?.secondary_text ?? ""),
            fullText: String(prediction?.description ?? ""),
            types: Array.isArray(prediction?.types) ? prediction.types : [],
          }))
          .filter((prediction: PlaceSuggestion) => Boolean(prediction.placeId && prediction.primaryText));
        this.cache.set(cacheKey, { data: suggestions, timestamp: Date.now() });
        return suggestions;
      } catch (error: any) {
        if (error?.code === "places_cancelled") throw error;
        console.error("Native Places Search Error:", error);
        throw this.normalizeError("places_network_error");
      }
    }

    await this.initialize();`,
  );

  next = next.replace(
    '  public async selectPrediction(prediction: any): Promise<DestinationAddress> {\n    await this.initialize();',
    `  public async selectPrediction(prediction: any): Promise<DestinationAddress> {
    if (Capacitor.isNativePlatform()) {
      try {
        const { data, error } = await supabase.functions.invoke("google-maps-address", {
          body: { action: "place_details", placeId: prediction.placeId },
        });
        if (error || !data?.result) throw error ?? new Error("place_details_missing");
        const result = data.result;
        const latitude = Number(result?.geometry?.location?.lat);
        const longitude = Number(result?.geometry?.location?.lng);
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
          throw this.normalizeError("places_invalid_location");
        }

        const components: AddressComponent = {};
        for (const component of result.address_components ?? []) {
          const types = Array.isArray(component?.types) ? component.types : [];
          if (types.includes("route")) components.rua = component.long_name;
          if (types.includes("street_number")) components.numero = component.long_name;
          if (types.includes("neighborhood") || types.includes("sublocality_level_1")) components.bairro = component.long_name;
          if (types.includes("locality")) components.cidade = component.long_name;
          if (types.includes("administrative_area_level_1")) {
            components.estado = component.long_name;
            components.estadoSigla = component.short_name;
          }
          if (types.includes("postal_code")) components.cep = component.long_name;
          if (types.includes("country")) components.pais = component.long_name;
        }

        const fullText = String(prediction.fullText ?? prediction.primaryText ?? "Local selecionado");
        return {
          placeId: String(prediction.placeId),
          latitude,
          longitude,
          label: String(prediction.primaryText ?? fullText.split(",")[0] ?? "Local selecionado"),
          subLabel: String(prediction.secondaryText ?? ""),
          formattedAddress: fullText,
          name: String(prediction.primaryText ?? ""),
          components,
          types: Array.isArray(prediction.types) ? prediction.types : [],
          selectedAt: new Date().toISOString(),
          source: "google_places",
        };
      } catch (error) {
        console.error("Native Place Details Error:", error);
        throw this.normalizeError("places_details_unavailable");
      }
    }

    await this.initialize();`,
  );

  return next;
}, 'Corridas: autocomplete nativo usa Edge Function autenticada e não depende do Maps JS no WebView');

patch('src/lib/geocoding.ts', (source) => {
  let next = source;
  if (!next.includes('import { Capacitor } from "@capacitor/core";')) {
    next = next.replace(
      'import { LocationData } from "@/hooks/use-location";',
      'import { LocationData } from "@/hooks/use-location";\nimport { Capacitor } from "@capacitor/core";\nimport { supabase } from "@/integrations/supabase/client";',
    );
  }
  next = next.replace(
    '  try {\n    // Call the APOIS backend geocoding endpoint',
    `  try {
    if (Capacitor.isNativePlatform()) {
      const { data, error } = await supabase.functions.invoke("google-maps-address", {
        body: { action: "reverse_geocode", lat: location.latitude, lng: location.longitude },
      });
      if (error) throw error;
      const first = Array.isArray(data?.results) ? data.results[0] : null;
      const formatted = typeof first?.formatted_address === "string" ? first.formatted_address.trim() : "";
      if (formatted) {
        cache[cacheKey] = { address: formatted, timestamp: Date.now() };
        return formatted;
      }
      const components = Array.isArray(first?.address_components) ? first.address_components : [];
      const read = (type: string) => {
        const component = components.find((item: any) => Array.isArray(item?.types) && item.types.includes(type));
        return typeof component?.long_name === "string" ? component.long_name.trim() : "";
      };
      const road = read("route");
      const number = read("street_number");
      const neighborhood = read("sublocality_level_1") || read("neighborhood");
      const city = read("locality");
      const region = read("administrative_area_level_1");
      const address = [
        [road, number].filter(Boolean).join(", "),
        neighborhood,
        city,
        region,
      ].filter(Boolean).join(" - ");
      if (!address) throw new Error("geocode_empty_result");
      cache[cacheKey] = { address, timestamp: Date.now() };
      return address;
    }

    // Call the APOIS backend geocoding endpoint`,
  );
  return next;
}, 'Corridas: reverse geocoding nativo usa Edge Function autenticada');

patch('src/hooks/use-destination-search.tsx', (source) =>
  source.replace('    [location],\n  );', '    [currentPosition],\n  );'),
'Corridas: busca de destino usa a posição atual sem stale closure');

patch('src/hooks/use-ride-categories.tsx', (source) =>
  source
    .replace('  }, [selectedCategory]);', '  }, []);')
    .replace('  }, []);\n\n  const selectCategory', '  }, [fetchCategories]);\n\n  const selectCategory'),
'Corridas: categorias mantêm callback estável e efeito com dependência correta');

patch('src/services/maps/map-service.ts', (source) =>
  source
    .replace('        iconUrl: "assets/markers/pickup.png",\n        opacity: 1,', '        tintColor: { r: 246, g: 190, b: 28, a: 255 },\n        opacity: 1,')
    .replace('        iconUrl: "assets/markers/destination.png",\n        opacity: 1,', '        tintColor: { r: 255, g: 255, b: 255, a: 255 },\n        opacity: 1,'),
'Corridas: mapa nativo usa marcadores legíveis sem assets quebrados');

patch('src/services/maps/map-config.ts', (source) =>
  source
    .replace('{ color: "#212121" }', '{ color: "#171a1f" }')
    .replace('{ color: "#000000" }', '{ color: "#101b24" }')
    .replace('{ color: "#2c2c2c" }', '{ color: "#30343a" }')
    .replace('{ color: "#373737" }', '{ color: "#3a3f46" }')
    .replace('{ color: "#3c3c3c" }', '{ color: "#444a52" }')
    .replace('{ color: "#8a8a8a" }', '{ color: "#b7bcc4" }')
    .replace('{ color: "#616161" }', '{ color: "#9298a1" }'),
'Corridas: mapa escuro ganha contraste e leitura melhores');

patch('src/services/google/google-maps-loader.ts', (source) =>
  source
    .replace(
      '            googleWindow.google?.maps?.importLibrary\n              ? finish()\n              : finish(new Error("maps_api_unavailable"));',
      '            if (googleWindow.google?.maps?.importLibrary) finish();\n            else finish(new Error("maps_api_unavailable"));',
    )
    .replace(
      '        googleWindow.google?.maps?.importLibrary\n          ? finish()\n          : finish(new Error("maps_api_unavailable"));',
      '        if (googleWindow.google?.maps?.importLibrary) finish();\n        else finish(new Error("maps_api_unavailable"));',
    ),
'Corridas: loader de Maps usa controle de fluxo explícito');


patch('src/styles.css', (source) =>
  source.replace(
    '    padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom)\n      env(safe-area-inset-left);',
    '    padding: 0;',
  ),
'Corridas: viewport não soma safe-area ao 100dvh e evita corte inferior');

patch('src/routes/_authenticated.tsx', (source) =>
  source
    .replace(
      '                                  <div className="min-h-[100dvh] bg-zinc-950 flex justify-center selection:bg-yellow-500/30 overflow-hidden">\n                                    <div className="relative w-full max-w-[430px] h-[100dvh] bg-black overflow-hidden flex flex-col">\n                                      <div className="flex-1 relative overflow-hidden flex flex-col">',
      '                                  <div className="h-[100dvh] bg-zinc-950 flex justify-center selection:bg-yellow-500/30 overflow-hidden">\n                                    <div className="relative w-full max-w-[430px] h-full bg-black overflow-hidden flex flex-col">\n                                      <div className="min-h-0 flex-1 relative overflow-hidden flex flex-col">',
    ),
'Corridas: shell ocupa exatamente a viewport e reserva espaço real para navegação');

patch('src/components/BottomNavigation.tsx', (source) =>
  source.replace(
    'className="relative w-full bg-black border-t border-white/10 flex justify-around py-3 px-2 z-[100] pb-[calc(12px+env(safe-area-inset-bottom))] shadow-[0_-4px_20px_rgba(0,0,0,0.5)] shrink-0"',
    'className="relative w-full min-h-[76px] bg-black border-t border-white/10 flex items-start justify-around pt-3 px-2 z-[100] pb-[max(14px,env(safe-area-inset-bottom))] shadow-[0_-4px_20px_rgba(0,0,0,0.5)] shrink-0"',
  ),
'Corridas: navegação inferior respeita barra do Android sem cortar rótulos');

patch('src/hooks/use-auth.tsx', (source) => {
  let next = source;
  next = next.replace('.eq("id", userId)\n        .maybeSingle();', '.eq("auth_user_id", userId)\n        .maybeSingle();');
  next = next.replace(
    '        const normalizedProfile = normalizeProfile(data);\n        setProfile(normalizedProfile);\n        return normalizedProfile;',
    `        const normalizedProfile = normalizeProfile(data);
        if (normalizedProfile?.avatar_url && !/^https?:\\/\\//i.test(normalizedProfile.avatar_url) && !normalizedProfile.avatar_url.startsWith("data:")) {
          const { data: signedAvatar } = await supabase.storage
            .from("profile-photos")
            .createSignedUrl(normalizedProfile.avatar_url, 60 * 60);
          if (signedAvatar?.signedUrl) normalizedProfile.avatar_url = signedAvatar.signedUrl;
        }
        if (!normalizedProfile?.avatar_url) {
          const { data: authUser } = await supabase.auth.getUser();
          const metadataAvatar = authUser.user?.user_metadata?.avatar_url ?? authUser.user?.user_metadata?.picture;
          if (typeof metadataAvatar === "string" && metadataAvatar.trim()) normalizedProfile.avatar_url = metadataAvatar.trim();
        }
        setProfile(normalizedProfile);
        return normalizedProfile;`,
  );
  return next;
}, 'Corridas: perfil resolve usuário por auth_user_id e assina foto privada do Storage');

patch('src/routes/_authenticated.perfil.tsx', (source) =>
  source.replace(
    '<AvatarImage src={currentProfile.avatarUrl} />',
    '<AvatarImage src={currentProfile.avatarUrl} alt={currentProfile.name} referrerPolicy="no-referrer" />',
  ),
'Corridas: foto de perfil usa URL assinada e fallback seguro');

patch('src/routes/_authenticated.carteira.tsx', () => `import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, RefreshCw, ShieldCheck, WalletCards } from "lucide-react";
import { useWallet } from "@/hooks/use-wallet";

export const Route = createFileRoute("/_authenticated/carteira")({
  component: CarteiraPage,
});

const money = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

function CarteiraPage() {
  const { wallet, state, isLoading, refresh } = useWallet();

  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-black px-5 pt-[max(24px,env(safe-area-inset-top))] pb-8 text-white">
      <div className="mx-auto w-full max-w-md space-y-5">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-zinc-500">APOIS</p>
          <h1 className="mt-1 text-3xl font-black">Sua carteira</h1>
          <p className="mt-1 text-sm text-zinc-400">Saldo e pendências relacionadas às suas corridas.</p>
        </div>

        <section className="rounded-[28px] border border-amber-400/20 bg-gradient-to-br from-zinc-900 to-black p-6 shadow-2xl">
          <div className="flex items-center justify-between">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-400/10 text-apois-yellow">
              <WalletCards size={25} />
            </div>
            <button type="button" onClick={() => void refresh()} disabled={isLoading} className="rounded-xl border border-white/10 p-3 text-zinc-300 disabled:opacity-50" aria-label="Atualizar carteira">
              <RefreshCw size={18} className={isLoading ? "animate-spin" : ""} />
            </button>
          </div>

          <p className="mt-7 text-sm text-zinc-400">Saldo disponível</p>
          <p className="mt-1 text-4xl font-black tracking-tight text-white">
            {state === "available" || state === "blocked" ? money(wallet?.available_balance ?? 0) : "R$ 0,00"}
          </p>

          <div className="mt-6 rounded-2xl border border-white/5 bg-white/[0.03] p-4">
            {isLoading && <p className="text-sm text-zinc-400">Carregando sua carteira...</p>}
            {!isLoading && state === "not_found" && (
              <div className="flex gap-3">
                <ShieldCheck className="mt-0.5 text-apois-yellow" size={20} />
                <div>
                  <p className="font-bold">Nenhuma carteira financeira criada</p>
                  <p className="mt-1 text-xs leading-relaxed text-zinc-400">Sua conta está ativa. A carteira será usada somente quando houver saldo ou cobrança vinculada às corridas.</p>
                </div>
              </div>
            )}
            {!isLoading && state === "available" && (
              <div className="flex gap-3">
                <ShieldCheck className="mt-0.5 text-emerald-500" size={20} />
                <div>
                  <p className="font-bold">Carteira ativa</p>
                  <p className="mt-1 text-xs text-zinc-400">Saldo disponível para operações permitidas no aplicativo.</p>
                </div>
              </div>
            )}
            {!isLoading && state === "blocked" && (
              <div className="flex gap-3">
                <AlertTriangle className="mt-0.5 text-red-500" size={20} />
                <div>
                  <p className="font-bold text-red-400">Carteira bloqueada</p>
                  <p className="mt-1 text-xs text-red-300/80">{wallet?.blockedReason || "Existe uma pendência que precisa ser regularizada."}</p>
                </div>
              </div>
            )}
            {!isLoading && state === "failed" && (
              <div className="flex gap-3">
                <AlertTriangle className="mt-0.5 text-red-500" size={20} />
                <div>
                  <p className="font-bold text-red-400">Não foi possível carregar a carteira</p>
                  <button type="button" onClick={() => void refresh()} className="mt-2 text-sm font-bold text-apois-yellow">Tentar novamente</button>
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="rounded-3xl border border-white/5 bg-[#111214] p-5">
          <h2 className="font-black">Como funciona</h2>
          <p className="mt-2 text-sm leading-relaxed text-zinc-400">Esta área mostra saldo, bloqueios e pendências financeiras do passageiro. Nenhuma cobrança é criada apenas por abrir esta tela.</p>
        </section>
      </div>
    </div>
  );
}
`,
'Corridas: Carteira deixa de ser placeholder preto e mostra estado financeiro real');


patch('src/components/BottomNavigation.tsx', () => `import { Home, History, CreditCard, Bell, User } from "lucide-react";
import { Link, useLocation } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

export const BottomNavigation = () => {
  const location = useLocation();

  const navItems = [
    { label: "Início", icon: Home, path: "/inicio" },
    { label: "Corridas", icon: History, path: "/corridas" },
    { label: "Carteira", icon: CreditCard, path: "/carteira" },
    { label: "Notificações", icon: Bell, path: "/notificacoes" },
    { label: "Perfil", icon: User, path: "/perfil" },
  ];

  return (
    <nav className="relative z-[100] grid w-full shrink-0 grid-cols-5 border-t border-white/10 bg-black/95 px-1.5 pt-2.5 pb-[max(14px,env(safe-area-inset-bottom))] shadow-[0_-10px_30px_rgba(0,0,0,0.55)] backdrop-blur-xl">
      {navItems.map((item) => {
        const isActive = location.pathname === item.path;
        return (
          <Link
            key={item.path}
            to={item.path}
            className={\`flex min-h-[64px] min-w-0 flex-col items-center justify-center gap-1 rounded-2xl px-1 transition-all active:scale-95 \${
              isActive ? "text-apois-yellow" : "text-zinc-400"
            }\`}
          >
            <item.icon size={24} strokeWidth={isActive ? 2.8 : 2.1} />
            <span
              className={cn(
                "text-[11px] font-bold leading-none tracking-tight",
                isActive ? "text-apois-yellow" : "text-zinc-400",
              )}
            >
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
};
`),
'Corridas: navegação inferior ganha grade estável, legibilidade e alvos de toque consistentes');

patch('src/routes/_authenticated.perfil.tsx', (source) =>
  source
    .replace(
      '<div className="flex flex-col min-h-screen bg-black text-white pb-24">',
      '<div className="min-h-0 flex-1 overflow-y-auto bg-black pb-6 text-white">',
    )
    .replace(
      '<div className="p-6 pt-12 flex flex-col items-center border-b border-gray-900">',
      '<div className="flex flex-col items-center border-b border-gray-900 px-5 pb-6 pt-[max(24px,env(safe-area-inset-top))]">',
    )
    .replace(
      '<Avatar className="w-24 h-24 mb-4 border-2 border-yellow-500 p-1">',
      '<Avatar className="mb-4 h-24 w-24 border-2 border-apois-yellow p-1 shadow-[0_0_28px_rgba(255,184,0,0.12)]">',
    )
    .replace(
      '<h2 className="text-2xl font-bold">{currentProfile.name}</h2>',
      '<h2 className="max-w-full truncate px-3 text-center text-2xl font-black">{currentProfile.name}</h2>',
    )
    .replace(
      '<p className="text-gray-400 text-sm">{user?.email}</p>',
      '<p className="max-w-full truncate px-3 text-center text-sm text-zinc-400">{user?.email}</p>',
    )
    .replace(
      '<div className="p-4 space-y-2">',
      '<div className="space-y-2 px-4 pb-2 pt-1">',
    )
    .replace(
      '<div className="p-6 mt-4">',
      '<div className="mt-2 px-4 pb-6">',
    )
    .replace(
      'className="w-full flex items-center justify-between p-4 bg-[#121212] hover:bg-[#1a1a1a] rounded-xl transition-colors text-left group"',
      'className="group flex min-h-[68px] w-full items-center justify-between rounded-2xl border border-white/5 bg-[#111214] p-4 text-left transition-colors active:bg-[#1a1a1a]"',
    )
    .replace(
      '<div className="flex items-center gap-4">',
      '<div className="min-w-0 flex items-center gap-4">',
    )
    .replace(
      '<div>\n          <p className="text-sm font-medium">{label}</p>',
      '<div className="min-w-0">\n          <p className="text-sm font-bold">{label}</p>',
    )
    .replace(
      'className="text-xs text-gray-500 truncate max-w-[200px]"',
      'className="max-w-[240px] truncate text-xs text-zinc-500"',
    ),
'Corridas: Perfil usa viewport do shell, textos truncados e cards tocáveis');

patch('src/routes/_authenticated.notificacoes.tsx', (source) =>
  source
    .replace(
      '<div className="min-h-screen bg-black px-5 pb-24 pt-8 text-white">',
      '<div className="min-h-0 flex-1 overflow-y-auto bg-black px-5 pb-6 pt-[max(24px,env(safe-area-inset-top))] text-white">',
    )
    .replace(
      'className="mb-6 flex items-start justify-between gap-4"',
      'className="mb-5 flex min-w-0 items-start justify-between gap-4"',
    )
    .replace(
      '<div>\n          <p className="text-xs font-black uppercase tracking-[0.2em] text-apois-yellow">',
      '<div className="min-w-0">\n          <p className="text-xs font-black uppercase tracking-[0.2em] text-apois-yellow">',
    )
    .replace(
      '<h1 className="mt-1 text-2xl font-black">Notificações</h1>',
      '<h1 className="mt-1 truncate text-2xl font-black">Notificações</h1>',
    ),
'Corridas: Notificações usa viewport real do shell e não fica atrás do rodapé');

patch('src/routes/_authenticated.revisar-solicitacao.tsx', (source) =>
  source
    .replace(
      '<div className="flex flex-col min-h-screen bg-black text-white pb-safe">',
      '<div className="min-h-0 flex-1 overflow-hidden bg-black text-white flex flex-col">',
    )
    .replace(
      'className="px-5 py-6 flex items-center gap-4 border-b border-white/5 bg-zinc-900/50 backdrop-blur-md sticky top-0 z-10"',
      'className="sticky top-0 z-10 flex items-center gap-3 border-b border-white/5 bg-zinc-900/90 px-4 pb-4 pt-[max(16px,env(safe-area-inset-top))] backdrop-blur-md"',
    )
    .replace(
      'className="p-2 -ml-2 text-zinc-400"',
      'className="-ml-1 grid h-11 w-11 shrink-0 place-items-center rounded-full text-zinc-300 active:bg-white/5"',
    )
    .replace(
      'className="flex-1 px-5 py-6 space-y-6 overflow-y-auto"',
      'className="min-h-0 flex-1 space-y-6 overflow-y-auto px-4 pb-6 pt-5"',
    ),
'Corridas: revisão da solicitação usa safe-area, scroll interno e botão voltar tocável');

patch('src/routes/_authenticated.buscar-destino.tsx', (source) =>
  source
    .replace(
      '<div className="flex flex-col min-h-screen bg-transparent relative">',
      '<div className="relative min-h-0 flex-1 overflow-hidden bg-transparent">',
    )
    .replace(
      'className="fixed bottom-10 left-5 right-5 z-50"',
      'className="fixed bottom-[max(20px,env(safe-area-inset-bottom))] left-5 right-5 z-50"',
    )
    .replace(
      'className="p-2 -ml-2 text-white active:bg-white/10 rounded-full transition-colors"',
      'className="-ml-2 grid h-11 w-11 shrink-0 place-items-center rounded-full text-white transition-colors active:bg-white/10"',
    )
    .replace(
      'className="absolute right-4 p-1 text-gray-400"',
      'className="absolute right-1 grid h-11 w-11 place-items-center rounded-xl text-gray-400 active:bg-white/5"',
    )
    .replace(
      'className="w-full flex items-center gap-4 p-4 bg-[#2a2a2a] rounded-2xl border border-white/5 active:scale-[0.98] transition-all"',
      'className="flex min-h-[64px] w-full items-center gap-4 rounded-2xl border border-white/5 bg-[#2a2a2a] p-4 transition-all active:scale-[0.98]"',
    ),
'Corridas: busca de destino respeita viewport, safe-area e alvos de toque');

patch('src/routes/_authenticated.corrida.$rideId.tsx', (source) =>
  source
    .replaceAll('min-h-screen', 'min-h-0 flex-1')
    .replaceAll('h-screen', 'h-full')
    .replace(
      'className="flex h-full flex-col bg-black text-white"',
      'className="min-h-0 flex-1 overflow-hidden bg-black text-white flex flex-col"',
    ),
'Corridas: tela da corrida não cria segunda viewport dentro do shell');

patch('src/routes/_authenticated.corridas.tsx', () => `import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { CarFront, ChevronRight, Clock3, Loader2, MapPin, RefreshCw, Route as RouteIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/corridas")({
  component: CorridasPage,
});

type RideRow = {
  id: string;
  status: string;
  origin_name: string | null;
  destination_name: string | null;
  estimated_price: number | null;
  final_price: number | null;
  created_at: string;
  category: string | null;
};

const statusLabel = (status: string) => {
  const labels: Record<string, string> = {
    agendada: "Agendada",
    procurar_motorista: "Procurando motorista",
    motorista_a_caminho: "Motorista a caminho",
    motorista_chegou: "Motorista chegou",
    em_viagem: "Em viagem",
    finalizada: "Finalizada",
    cancelada_passageiro: "Cancelada",
    cancelada_motorista: "Cancelada",
  };
  return labels[status] ?? status.replaceAll("_", " ");
};

const money = (value: number | null) =>
  typeof value === "number" && Number.isFinite(value)
    ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)
    : "—";

function CorridasPage() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [rides, setRides] = useState<RideRow[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");

  const load = useCallback(async () => {
    if (!profile?.id) {
      setRides([]);
      setState("ready");
      return;
    }
    setState("loading");
    const { data, error } = await supabase
      .from("rides")
      .select("id,status,origin_name,destination_name,estimated_price,final_price,created_at,category")
      .eq("passenger_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) {
      console.error("[RideHistory] load failed", { code: error.code, message: error.message });
      setState("failed");
      return;
    }
    setRides((data ?? []) as RideRow[]);
    setState("ready");
  }, [profile?.id]);

  useEffect(() => { void load(); }, [load]);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-black px-4 pb-6 pt-[max(24px,env(safe-area-inset-top))] text-white">
      <div className="mx-auto w-full max-w-md">
        <header className="mb-5 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-apois-yellow">APOIS</p>
            <h1 className="mt-1 text-3xl font-black">Suas corridas</h1>
            <p className="mt-1 text-sm text-zinc-500">Histórico e corridas em andamento.</p>
          </div>
          <button type="button" onClick={() => void load()} className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-white/10 bg-zinc-900" aria-label="Atualizar corridas">
            <RefreshCw size={18} className={state === "loading" ? "animate-spin" : ""} />
          </button>
        </header>

        {state === "loading" && (
          <div className="flex min-h-[45vh] items-center justify-center"><Loader2 className="animate-spin text-apois-yellow" size={32} /></div>
        )}

        {state === "failed" && (
          <div className="flex min-h-[45vh] flex-col items-center justify-center gap-4 rounded-3xl border border-white/5 bg-zinc-950 p-6 text-center">
            <RouteIcon size={38} className="text-zinc-700" />
            <div><h2 className="font-black">Não foi possível carregar</h2><p className="mt-1 text-sm text-zinc-500">Tente atualizar o histórico.</p></div>
            <button type="button" onClick={() => void load()} className="rounded-xl bg-apois-yellow px-5 py-3 text-sm font-black text-black">Tentar novamente</button>
          </div>
        )}

        {state === "ready" && rides.length === 0 && (
          <div className="flex min-h-[45vh] flex-col items-center justify-center gap-4 text-center">
            <div className="grid h-20 w-20 place-items-center rounded-full bg-zinc-900"><CarFront size={34} className="text-zinc-600" /></div>
            <div><h2 className="font-black">Nenhuma corrida ainda</h2><p className="mt-1 text-sm text-zinc-500">Quando você pedir uma corrida, ela aparecerá aqui.</p></div>
            <button type="button" onClick={() => void navigate({ to: "/inicio" })} className="rounded-2xl bg-apois-yellow px-5 py-3 text-sm font-black text-black">Pedir uma corrida</button>
          </div>
        )}

        {state === "ready" && rides.length > 0 && (
          <div className="space-y-3">
            {rides.map((ride) => (
              <button
                key={ride.id}
                type="button"
                onClick={() => void navigate({ to: "/corrida/$rideId", params: { rideId: ride.id } })}
                className="w-full rounded-3xl border border-white/5 bg-[#111214] p-4 text-left transition-transform active:scale-[0.99]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <CarFront size={18} className="shrink-0 text-apois-yellow" />
                      <p className="truncate text-sm font-black capitalize">{ride.category || "Corrida"}</p>
                    </div>
                    <div className="mt-3 space-y-2">
                      <div className="flex items-start gap-2 text-xs text-zinc-400"><MapPin size={15} className="mt-0.5 shrink-0 text-apois-yellow" /><span className="line-clamp-1">{ride.origin_name || "Origem"}</span></div>
                      <div className="flex items-start gap-2 text-xs text-zinc-300"><RouteIcon size={15} className="mt-0.5 shrink-0 text-white" /><span className="line-clamp-1">{ride.destination_name || "Destino"}</span></div>
                    </div>
                  </div>
                  <ChevronRight size={19} className="mt-1 shrink-0 text-zinc-600" />
                </div>
                <div className="mt-4 flex items-center justify-between border-t border-white/5 pt-3">
                  <div className="flex items-center gap-1.5 text-[11px] text-zinc-500"><Clock3 size={14} />{new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(ride.created_at))}</div>
                  <div className="text-right"><p className="text-xs font-black text-apois-yellow">{money(ride.final_price ?? ride.estimated_price)}</p><p className="mt-0.5 text-[10px] font-bold text-zinc-500">{statusLabel(ride.status)}</p></div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
`,
'Corridas: histórico deixa de ser placeholder e usa layout móvel real');

requireMarkers('src/routes/_authenticated.inicio.tsx', ['onError={(event) => { event.currentTarget.style.display = "none"; }}', 'Motoristas disponíveis na região'], 'Corridas home sem avatar quebrado nem contagem fictícia');
requireMarkers('src/integrations/supabase/client.ts', ['storageKey: "apois-superapp-corridas-auth-v1"'], 'Corridas auth isolado');
requireMarkers('src/hooks/use-auth.tsx', ['.eq("auth_user_id", userId)', '.from("profile-photos")', 'createSignedUrl'], 'Corridas perfil usa domínio correto e foto privada assinada');
requireMarkers('src/routes/_authenticated.carteira.tsx', ['useWallet', 'Saldo disponível', 'Carteira ativa'], 'Corridas carteira materializada e funcional');
requireMarkers('src/routes/_authenticated.corridas.tsx', ['from("rides")', 'Histórico e corridas em andamento.', 'Pedir uma corrida'], 'Corridas histórico funcional e sem placeholder');
requireMarkers('src/routes/_authenticated.perfil.tsx', ['min-h-0 flex-1 overflow-y-auto', 'min-h-[68px]', 'pt-[max(24px,env(safe-area-inset-top))]'], 'Corridas perfil cabe na viewport e tem alvos confortáveis');
requireMarkers('src/routes/_authenticated.notificacoes.tsx', ['min-h-0 flex-1 overflow-y-auto', 'pt-[max(24px,env(safe-area-inset-top))]'], 'Corridas notificações cabe na viewport');
requireMarkers('src/routes/_authenticated.revisar-solicitacao.tsx', ['min-h-0 flex-1 overflow-hidden', 'min-h-0 flex-1 space-y-6 overflow-y-auto'], 'Corridas revisão usa scroll interno');
requireMarkers('src/routes/_authenticated.buscar-destino.tsx', ['relative min-h-0 flex-1 overflow-hidden', 'bottom-[max(20px,env(safe-area-inset-bottom))]'], 'Corridas busca respeita viewport e safe-area');
requireMarkers('src/styles.css', ['padding: 0;'], 'Corridas viewport sem safe-area duplicada');
requireMarkers('src/components/BottomNavigation.tsx', ['grid-cols-5', 'min-h-[64px]', '<item.icon size={24}', 'text-[11px]', 'text-zinc-400'], 'Corridas navegação inferior legível, estável e protegida');
requireMarkers('src/hooks/use-location.tsx', ['apois-superapp-corridas-last-location'], 'Corridas localização isolada');
requireMarkers('src/components/map/PassengerMap.tsx', ['encodedPolyline', 'PolylineDecoder', 'displayedRoutePoints'], 'Corridas mapa com rota persistida');
requireMarkers('src/hooks/rides/use-ride-request.tsx', ['paymentMethod: string | null', 'payment_method: selectedMethod', 'pickup_address: pickupAddress'], 'Corridas payload real e idempotente');
requireMarkers('src/services/places/places-service.ts', ['initializationPromise', 'fullText.split(",")[0]', 'typeof p.toPlace === "function"'], 'Corridas autocomplete robusto');
requireMarkers('src/types/places.ts', ['place?: unknown'], 'Corridas sugestão tipada sem any');
requireMarkers('src/components/map/PassengerMap.tsx', ['status, validDriverLocation]', 'apois-passenger-native-map', 'VITE_APOIS_ANDROID_MAPS_API_KEY', 'Capacitor.isNativePlatform()'], 'Corridas mapa nativo e câmera sem stale driver');
requireMarkers('src/services/maps/map-service.ts', ['tintColor: { r: 246, g: 190, b: 28, a: 255 }', 'tintColor: { r: 255, g: 255, b: 255, a: 255 }'], 'Corridas mapa nativo sem marcadores quebrados');
requireMarkers('src/hooks/use-location.tsx', ['await requestPermission();', 'permission === "prompt" || permission === "unknown"'], 'Corridas pede localização nativa');
requireMarkers('src/routes/_authenticated.tsx', ['PushNotifications.requestPermissions()', '[push] permission prompt unavailable'], 'Corridas pede notificações nativas');
requireMarkers('src/services/places/places-service.ts', ['google-maps-address', 'Capacitor.isNativePlatform()', 'action: "autocomplete"', 'action: "place_details"'], 'Corridas autocomplete nativo usa backend autenticado');
requireMarkers('src/lib/geocoding.ts', ['google-maps-address', 'action: "reverse_geocode"', 'Capacitor.isNativePlatform()'], 'Corridas endereço do ponto de partida usa backend autenticado');
requireMarkers('src/hooks/use-destination-search.tsx', ['[currentPosition]'], 'Corridas destino sem stale position');
requireMarkers('src/hooks/use-ride-categories.tsx', ['}, []);', '}, [fetchCategories]);'], 'Corridas categorias com hooks estáveis');


for (const relativePath of [
  'src/routes/_authenticated.perfil.tsx',
  'src/routes/_authenticated.notificacoes.tsx',
  'src/routes/_authenticated.revisar-solicitacao.tsx',
  'src/routes/_authenticated.buscar-destino.tsx',
]) {
  const source = readFileSync(resolve(root, workspace, relativePath), 'utf8');
  if (/\b(?:min-)?h-screen\b/.test(source)) {
    throw new Error(`[FAIL] Corridas layout: viewport duplicada permaneceu em ${relativePath}`);
  }
}
{
  const nav = readFileSync(resolve(root, workspace, 'src/components/BottomNavigation.tsx'), 'utf8');
  if (nav.includes('text-[9px]') || nav.includes('text-zinc-600')) {
    throw new Error('[FAIL] Corridas layout: rodapé voltou a usar rótulo pequeno/contraste fraco');
  }
}
console.log('[OK] Corridas layout: telas autenticadas auditadas sem viewport duplicada; rodapé permanece legível.');

console.log('[OK] Corridas: adaptação atual concluída sem modificar a fonte protegida');
