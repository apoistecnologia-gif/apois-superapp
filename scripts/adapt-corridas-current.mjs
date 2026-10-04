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

patch('src/hooks/use-destination-search.tsx', (source) =>
  source.replace('    [location],\n  );', '    [currentPosition],\n  );'),
'Corridas: busca de destino usa a posição atual sem stale closure');

patch('src/hooks/use-ride-categories.tsx', (source) =>
  source
    .replace('  }, [selectedCategory]);', '  }, []);')
    .replace('  }, []);\n\n  const selectCategory', '  }, [fetchCategories]);\n\n  const selectCategory'),
'Corridas: categorias mantêm callback estável e efeito com dependência correta');

patch('src/services/google/google-maps-loader.ts', (source) => {
  let next = source
    .replace(
      '            googleWindow.google?.maps?.importLibrary\n              ? finish()\n              : finish(new Error("maps_api_unavailable"));',
      '            if (googleWindow.google?.maps?.importLibrary) finish();\n            else finish(new Error("maps_api_unavailable"));',
    )
    .replace(
      '        googleWindow.google?.maps?.importLibrary\n          ? finish()\n          : finish(new Error("maps_api_unavailable"));',
      '        if (googleWindow.google?.maps?.importLibrary) finish();\n        else finish(new Error("maps_api_unavailable"));',
    );

  if (!next.includes('maps_auth_failure')) {
    next = next.replace(
      '    this.loadPromise = new Promise<void>((resolve, reject) => {\n      let settled = false;',
      '    this.loadPromise = new Promise<void>((resolve, reject) => {\n      let settled = false;\n      const previousAuthFailure = googleWindow.gm_authFailure;',
    );
    next = next.replace(
      '      const timeoutId = window.setTimeout(',
      '      googleWindow.gm_authFailure = () => {\n        try { previousAuthFailure?.(); } catch {}\n        finish(new Error("maps_auth_failure"));\n      };\n\n      const timeoutId = window.setTimeout(',
    );
    next = next.replace(
      '      script.id = SCRIPT_ID;\n      script.async = true;',
      '      script.id = SCRIPT_ID;\n      script.referrerPolicy = "strict-origin-when-cross-origin";\n      script.async = true;',
    );
  }
  return next;
}, 'Corridas: loader de Maps detecta falha de autorização e fixa política de referrer do WebView');

requireMarkers('src/integrations/supabase/client.ts', ['storageKey: "apois-superapp-corridas-auth-v1"'], 'Corridas auth isolado');
requireMarkers('src/hooks/use-location.tsx', ['apois-superapp-corridas-last-location'], 'Corridas localização isolada');
requireMarkers('src/components/map/PassengerMap.tsx', ['encodedPolyline', 'PolylineDecoder', 'displayedRoutePoints'], 'Corridas mapa com rota persistida');
requireMarkers('src/hooks/rides/use-ride-request.tsx', ['paymentMethod: string | null', 'payment_method: selectedMethod', 'pickup_address: pickupAddress'], 'Corridas payload real e idempotente');
requireMarkers('src/services/places/places-service.ts', ['initializationPromise', 'fullText.split(",")[0]', 'typeof p.toPlace === "function"'], 'Corridas autocomplete robusto');
requireMarkers('src/types/places.ts', ['place?: unknown'], 'Corridas sugestão tipada sem any');
requireMarkers('src/components/map/PassengerMap.tsx', ['status, validDriverLocation]'], 'Corridas câmera sem stale driver');
requireMarkers('src/hooks/use-destination-search.tsx', ['[currentPosition]'], 'Corridas destino sem stale position');
requireMarkers('src/hooks/use-ride-categories.tsx', ['}, []);', '}, [fetchCategories]);'], 'Corridas categorias com hooks estáveis');

console.log('[OK] Corridas: adaptação atual concluída sem modificar a fonte protegida');
