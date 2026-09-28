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

patch('src/hooks/use-destination-search.tsx', (source) =>
  source.replace('    [location],\n  );', '    [currentPosition],\n  );'),
'Corridas: busca de destino usa a posição atual sem stale closure');

patch('src/hooks/use-ride-categories.tsx', (source) =>
  source
    .replace('  }, [selectedCategory]);', '  }, []);')
    .replace('  }, []);\n\n  const selectCategory', '  }, [fetchCategories]);\n\n  const selectCategory'),
'Corridas: categorias mantêm callback estável e efeito com dependência correta');

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

requireMarkers('src/routes/_authenticated.inicio.tsx', ['onError={(event) => { event.currentTarget.style.display = "none"; }}', 'Motoristas disponíveis na região'], 'Corridas home sem avatar quebrado nem contagem fictícia');
requireMarkers('src/integrations/supabase/client.ts', ['storageKey: "apois-superapp-corridas-auth-v1"'], 'Corridas auth isolado');
requireMarkers('src/hooks/use-location.tsx', ['apois-superapp-corridas-last-location'], 'Corridas localização isolada');
requireMarkers('src/components/map/PassengerMap.tsx', ['encodedPolyline', 'PolylineDecoder', 'displayedRoutePoints'], 'Corridas mapa com rota persistida');
requireMarkers('src/hooks/rides/use-ride-request.tsx', ['paymentMethod: string | null', 'payment_method: selectedMethod', 'pickup_address: pickupAddress'], 'Corridas payload real e idempotente');
requireMarkers('src/services/places/places-service.ts', ['initializationPromise', 'fullText.split(",")[0]', 'typeof p.toPlace === "function"'], 'Corridas autocomplete robusto');
requireMarkers('src/types/places.ts', ['place?: unknown'], 'Corridas sugestão tipada sem any');
requireMarkers('src/components/map/PassengerMap.tsx', ['status, validDriverLocation]', 'apois-passenger-native-map', 'VITE_APOIS_ANDROID_MAPS_API_KEY', 'Capacitor.isNativePlatform()'], 'Corridas mapa nativo e câmera sem stale driver');
requireMarkers('src/hooks/use-location.tsx', ['await requestPermission();', 'permission === "prompt" || permission === "unknown"'], 'Corridas pede localização nativa');
requireMarkers('src/routes/_authenticated.tsx', ['PushNotifications.requestPermissions()', '[push] permission prompt unavailable'], 'Corridas pede notificações nativas');
requireMarkers('src/services/places/places-service.ts', ['google-maps-address', 'Capacitor.isNativePlatform()', 'action: "autocomplete"', 'action: "place_details"'], 'Corridas autocomplete nativo usa backend autenticado');
requireMarkers('src/hooks/use-destination-search.tsx', ['[currentPosition]'], 'Corridas destino sem stale position');
requireMarkers('src/hooks/use-ride-categories.tsx', ['}, []);', '}, [fetchCategories]);'], 'Corridas categorias com hooks estáveis');

console.log('[OK] Corridas: adaptação atual concluída sem modificar a fonte protegida');
