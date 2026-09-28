import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const name = process.argv[2];

function replaceRequired(path, search, replacement, label) {
  const full = resolve(root, path);
  const before = readFileSync(full, 'utf8');

  const modernCorridasRideRequest =
    path === '.work/corridas/src/hooks/rides/use-ride-request.tsx' &&
    before.includes('const payload: RideRequestPayload = {') &&
    before.includes('payment_method: selectedMethod,') &&
    before.includes('service_details: toServiceDetails(serviceDetails),') &&
    before.includes('encoded_polyline: route.encodedPolyline || null,') &&
    before.includes('client_estimated_price: checkout.finalTotal,');

  if (modernCorridasRideRequest) {
    console.log(`[OK] ${label} (já nativo no snapshot fixado de Corridas)`);
    return;
  }

  if (before.includes(replacement)) {
    console.log(`[OK] ${label} (já aplicado)`);
    return;
  }

  if (!before.includes(search)) {
    console.error(`[FAIL] ${label}: padrão esperado não encontrado em ${path}`);
    process.exit(1);
  }
  const after = before.replace(search, replacement);
  writeFileSync(full, after);
  console.log(`[OK] ${label}`);
}

if (name === 'corridas') {
  replaceRequired(
    '.work/corridas/src/integrations/supabase/client.ts',
    '      storage: typeof window !== "undefined" ? localStorage : undefined,\n      persistSession: true,',
    '      storage: typeof window !== "undefined" ? localStorage : undefined,\n      storageKey: "apois-superapp-corridas-auth-v1",\n      persistSession: true,',
    'corridas: sessão Supabase isolada dentro do Superapp',
  );
  replaceRequired(
    '.work/corridas/src/hooks/use-location.tsx',
    'const LAST_LOCATION_KEY = "apois-last-location";',
    'const LAST_LOCATION_KEY = "apois-superapp-corridas-last-location";',
    'corridas: cache de localização isolado dentro do Superapp',
  );
  replaceRequired(
    '.work/corridas/src/hooks/use-location.tsx',
    '  }, [checkPermissions, refreshLocation, updateLocationState]);',
    '  }, [checkPermissions, permissionState, refreshLocation, updateLocationState]);',
    'corridas: watcher de localização reinicia após mudança de permissão',
  );
  replaceRequired(
    '.work/corridas/src/components/map/PassengerMap.tsx',
    'import { googleMapsLoader } from "@/services/google/google-maps-loader";',
    'import { googleMapsLoader } from "@/services/google/google-maps-loader";\nimport { PolylineDecoder } from "@/services/routes/polyline-decoder";',
    'corridas: mapa ativo importa decoder de polyline persistida',
  );
  replaceRequired(
    '.work/corridas/src/components/map/PassengerMap.tsx',
    '  destination: customDestination,\n  driverLocation,',
    '  destination: customDestination,\n  encodedPolyline,\n  driverLocation,',
    'corridas: mapa ativo consome polyline recebida da corrida',
  );
  replaceRequired(
    '.work/corridas/src/components/map/PassengerMap.tsx',
    '  const validDriverLocation = useMemo<Coordinate | null>(() => {',
    '  const displayedRoutePoints = useMemo(() => {\n    if (route?.decodedPoints && route.decodedPoints.length > 1) return route.decodedPoints;\n    if (!encodedPolyline) return [];\n    try {\n      return PolylineDecoder.decode(encodedPolyline);\n    } catch (error) {\n      console.warn("[PassengerMap] Polyline persistida inválida", error);\n      return [];\n    }\n  }, [encodedPolyline, route?.decodedPoints]);\n\n  const validDriverLocation = useMemo<Coordinate | null>(() => {',
    'corridas: mapa restaura rota da corrida mesmo sem estado global',
  );
  replaceRequired(
    '.work/corridas/src/components/map/PassengerMap.tsx',
    '    if (route?.decodedPoints && route.decodedPoints.length > 1) {\n      const path = route.decodedPoints.map((point) => ({ lat: point.lat, lng: point.lng }));',
    '    if (displayedRoutePoints.length > 1) {\n      const path = displayedRoutePoints.map((point) => ({ lat: point.lat, lng: point.lng }));',
    'corridas: desenho da rota usa fallback persistido',
  );
  replaceRequired(
    '.work/corridas/src/components/map/PassengerMap.tsx',
    '  }, [destination, orderedStops, origin, route?.decodedPoints, status]);',
    '  }, [destination, displayedRoutePoints, orderedStops, origin, route?.decodedPoints, status]);',
    'corridas: atualização do mapa acompanha rota persistida',
  );
  replaceRequired(
    '.work/corridas/src/components/map/PassengerMap.tsx',
    'import { googleMapsLoader } from "@/services/google/google-maps-loader";\nimport { PolylineDecoder } from "@/services/routes/polyline-decoder";',
    'import { googleMapsLoader } from "@/services/google/google-maps-loader";\nimport { PolylineDecoder } from "@/services/routes/polyline-decoder";\nimport { Capacitor } from "@capacitor/core";\nimport { mapService } from "@/services/maps/map-service";',
    'corridas: mapa do passageiro carrega fallback nativo do Capacitor',
  );
  replaceRequired(
    '.work/corridas/src/components/map/PassengerMap.tsx',
    'const PassengerMap: React.FC<PassengerMapProps> = (',
    'const WebPassengerMap: React.FC<PassengerMapProps> = (',
    'corridas: implementação web do mapa permanece como fallback',
  );
  replaceRequired(
    '.work/corridas/src/components/map/PassengerMap.tsx',
    'export default PassengerMap;',
    `const NATIVE_PASSENGER_MAP_ID = "apois-passenger-native-map";

const NativePassengerMap: React.FC<PassengerMapProps> = ({
  origin: customOrigin,
  destination: customDestination,
  encodedPolyline,
  driverLocation,
  isStatic = false,
}) => {
  const { location } = useLocation();
  const { route } = useRoute();
  const { orderedStops } = useRideStops();
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

    const transparentNodes: HTMLElement[] = [];
    let cursor: HTMLElement | null = element;
    while (cursor) {
      transparentNodes.push(cursor);
      if (cursor === document.body) break;
      cursor = cursor.parentElement;
    }
    transparentNodes.push(document.documentElement);
    const previousBackgrounds = transparentNodes.map((node) => ({
      node,
      background: node.style.background,
      backgroundColor: node.style.backgroundColor,
    }));
    for (const item of previousBackgrounds) {
      item.node.style.background = "transparent";
      item.node.style.backgroundColor = "transparent";
    }

    const initialize = async () => {
      setStatus("loading");
      const apiKey = String(import.meta.env.VITE_APOIS_ANDROID_MAPS_API_KEY ?? "").trim();
      if (!apiKey) {
        setStatus("configuration-error");
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
    };

    void initialize();
    return () => {
      disposed = true;
      void mapService.destroyMap(NATIVE_PASSENGER_MAP_ID).catch(() => undefined);
      for (const item of previousBackgrounds) {
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
        if (origin) {
          await mapService.upsertPickupMarker(NATIVE_PASSENGER_MAP_ID, origin);
        }
        if (destination) {
          await mapService.upsertDestinationMarker(NATIVE_PASSENGER_MAP_ID, destination);
        } else {
          await mapService.removeDestinationMarker(NATIVE_PASSENGER_MAP_ID);
        }
        if (displayedRoutePoints.length > 1) {
          await mapService.upsertRoutePolyline(NATIVE_PASSENGER_MAP_ID, displayedRoutePoints);
          await mapService.fitRouteBounds(NATIVE_PASSENGER_MAP_ID, displayedRoutePoints);
        } else {
          await mapService.removeRoutePolyline(NATIVE_PASSENGER_MAP_ID);
          if (origin && destination) {
            await mapService.fitPickupAndDestination(NATIVE_PASSENGER_MAP_ID, origin, destination, 96);
          } else if (origin) {
            await mapService.centerOnPickup(NATIVE_PASSENGER_MAP_ID, origin);
          }
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
  }, [destination, displayedRoutePoints, driverLocation?.lat, driverLocation?.lng, isStatic, origin, orderedStops, status]);

  const retry = () => setReloadKey((value) => value + 1);

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
            <p className="text-xs leading-relaxed text-zinc-300">
              Não foi possível iniciar o mapa nativo. Tente novamente.
            </p>
            <button type="button" onClick={retry} className="mx-auto flex items-center gap-2 rounded-xl bg-apois-yellow px-4 py-3 text-xs font-black text-black">
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

export default PassengerMap;`,
    'corridas: APK usa mapa nativo Android e web mantém JavaScript Maps',
  );
  replaceRequired(
    '.work/corridas/src/hooks/rides/use-active-ride.tsx',
    '      !passengerId ||\n      screenState !== "active" ||\n      isRealtimeConnected ||\n      !currentRideIdRef.current',
    '      !passengerId ||\n      screenState !== "active" ||\n      !currentRideIdRef.current',
    'corridas: polling de segurança continua mesmo com Realtime conectado',
  );
  replaceRequired(
    '.work/corridas/src/hooks/rides/use-ride-request.tsx',
    'import { useRoute } from "@/hooks/use-route";',
    'import { useRoute } from "@/hooks/use-route";\nimport { usePickupAddress } from "@/hooks/use-pickup-address";\nimport { useDestination } from "@/hooks/use-destination";\nimport { usePaymentMethods } from "@/hooks/use-payment-methods";',
    'corridas: solicitação importa endereço, destino e pagamento reais',
  );
  replaceRequired(
    '.work/corridas/src/hooks/rides/use-ride-request.tsx',
    '  destination: RouteCoordinates | null;\n}',
    '  destination: RouteCoordinates | null;\n  paymentMethod: string | null;\n}',
    'corridas: idempotência considera método de pagamento',
  );
  replaceRequired(
    '.work/corridas/src/hooks/rides/use-ride-request.tsx',
    '  const { route } = useRoute();',
    '  const { route } = useRoute();\n  const { address: pickupAddress, pickupLabel, pickupShortLabel, pickupPlaceId } = usePickupAddress();\n  const { destination } = useDestination();\n  const { selectedMethod } = usePaymentMethods();',
    'corridas: solicitação lê dados reais da revisão',
  );
  replaceRequired(
    '.work/corridas/src/hooks/rides/use-ride-request.tsx',
    '    destination: null,\n  });',
    '    destination: null,\n    paymentMethod: null,\n  });',
    'corridas: snapshot inicia pagamento isolado',
  );
  replaceRequired(
    '.work/corridas/src/hooks/rides/use-ride-request.tsx',
    '      !sameCoordinates(currentOrigin, requestDataRef.current.origin) ||\n      !sameCoordinates(currentDestination, requestDataRef.current.destination);',
    '      !sameCoordinates(currentOrigin, requestDataRef.current.origin) ||\n      !sameCoordinates(currentDestination, requestDataRef.current.destination) ||\n      selectedMethod !== requestDataRef.current.paymentMethod;',
    'corridas: nova forma de pagamento gera nova chave idempotente',
  );
  replaceRequired(
    '.work/corridas/src/hooks/rides/use-ride-request.tsx',
    '        destination: currentDestination,\n      };',
    '        destination: currentDestination,\n        paymentMethod: selectedMethod,\n      };',
    'corridas: snapshot persiste forma de pagamento',
  );
  replaceRequired(
    '.work/corridas/src/hooks/rides/use-ride-request.tsx',
    '  }, [selectedCategory, route, request.requestKey]);',
    '  }, [selectedCategory, selectedMethod, route, request.requestKey]);',
    'corridas: revisão reage à forma de pagamento',
  );
  replaceRequired(
    '.work/corridas/src/hooks/rides/use-ride-request.tsx',
    '        origin_name: "Origem",\n        destination_name: "Destino",\n        distance_km: route.distanceMeters / 1000,\n        duration_min: route.durationSeconds / 60,\n        service_details: {},',
    '        origin_name: pickupLabel || pickupShortLabel || pickupAddress || "Origem",\n        destination_name: destination?.formattedAddress || destination?.label || "Destino",\n        distance_km: route.distanceMeters / 1000,\n        duration_min: route.durationSeconds / 60,\n        pickup_label: pickupLabel,\n        pickup_short_label: pickupShortLabel,\n        pickup_address: pickupAddress,\n        pickup_place_id: pickupPlaceId,\n        pickup_source: "gps",\n        payment_method: selectedMethod,\n        service_details: selectedCategory.details ?? {},',
    'corridas: backend recebe endereço, pagamento e detalhes reais do serviço',
  );
  replaceRequired(
    '.work/corridas/src/hooks/rides/use-ride-request.tsx',
    '  }, [user, selectedCategory, route, request.requestKey]);',
    '  }, [user, selectedCategory, route, request.requestKey, pickupAddress, pickupLabel, pickupShortLabel, pickupPlaceId, destination, selectedMethod]);',
    'corridas: confirmação acompanha todos os dados enviados',
  );
  replaceRequired(
    '.work/corridas/src/hooks/rides/use-ride-request.tsx',
    '    requestDataRef.current = { category: null, origin: null, destination: null };',
    '    requestDataRef.current = { category: null, origin: null, destination: null, paymentMethod: null };',
    'corridas: reset limpa snapshot idempotente completo',
  );
  console.log('[OK] corridas: createHashHistory + base relativa já são nativos do módulo');
  process.exit(0);
}

if (name === 'entregas') {
  replaceRequired(
    '.work/entregas/src/router.tsx',
    'import { createRouter } from "@tanstack/react-router";',
    'import { createRouter, createHashHistory } from "@tanstack/react-router";',
    'entregas: importar createHashHistory',
  );
  replaceRequired(
    '.work/entregas/src/router.tsx',
    '  const router = createRouter({\n    routeTree,',
    '  const hashHistory = typeof window !== "undefined" ? createHashHistory() : undefined;\n\n  const router = createRouter({\n    routeTree,\n    ...(hashHistory ? { history: hashHistory } : {}),',
    'entregas: usar Hash History apenas no WebView/browser',
  );
  replaceRequired(
    '.work/entregas/vite.config.ts',
    'export default defineConfig({\n',
    'export default defineConfig({\n  vite: { base: "./" },\n',
    'entregas: gerar assets com caminhos relativos',
  );
  replaceRequired(
    '.work/entregas/src/routes/index.tsx',
    'src="/apois-logo.svg"',
    'src="./apois-logo.svg"',
    'entregas: logo principal relativa ao módulo',
  );
  replaceRequired(
    '.work/entregas/src/components/ApoisLaunchSplash.tsx',
    'src="/apois-app-icon.png"',
    'src="./apois-app-icon.png"',
    'entregas: ícone do splash relativo ao módulo',
  );
  replaceRequired(
    '.work/entregas/src/integrations/supabase/client.ts',
    '    storage: typeof window !== "undefined" ? window.localStorage : undefined,\n    // Merchant uses a dedicated auth namespace.',
    '    storage: typeof window !== "undefined" ? window.localStorage : undefined,\n    storageKey: "apois-superapp-entregas-auth-v1",\n    // Merchant uses a dedicated auth namespace.',
    'entregas: sessão Supabase isolada dentro do Superapp',
  );
  // GoogleLoginButton.tsx deriva o scheme nativo de VITE_APOIS_NATIVE_SCHEME
  // (com fallback por produto) via getNativeAuthCallback(), e o pós-login já
  // usa getProductHomeRoute() com prefixo de hash nativamente. O Superapp só
  // precisa definir VITE_APOIS_NATIVE_SCHEME=br.com.apois.app no ambiente de
  // build (.apois/modules.json), sem patch textual do componente.
  {
    const googleLoginPath = resolve(root, '.work/entregas/src/components/GoogleLoginButton.tsx');
    const googleLoginSource = readFileSync(googleLoginPath, 'utf8');
    if (
      !googleLoginSource.includes('function getNativeAuthCallback()') ||
      !googleLoginSource.includes('VITE_APOIS_NATIVE_SCHEME')
    ) {
      console.error(
        '[FAIL] entregas: callback Google usa package unificado: getNativeAuthCallback()/VITE_APOIS_NATIVE_SCHEME não encontrados em GoogleLoginButton.tsx',
      );
      process.exit(1);
    }
    console.log('[OK] entregas: callback Google usa package unificado (via VITE_APOIS_NATIVE_SCHEME)');
  }
  replaceRequired(
    '.work/entregas/src/routes/register.tsx',
    '          emailRedirectTo: `${window.location.origin}/auth/callback`,',
    '          emailRedirectTo: "br.com.apois.app://auth/callback",',
    'entregas: confirmação de cadastro retorna ao Superapp',
  );
  replaceRequired(
    '.work/entregas/src/routes/login.tsx',
    '      redirectTo: `${window.location.origin}/redefinir-senha`,',
    '      redirectTo: "br.com.apois.app://auth/reset",',
    'entregas: recuperação de senha retorna ao Superapp',
  );
  replaceRequired(
    '.work/entregas/src/routes/auth.callback.tsx',
    '      const params = new URLSearchParams(window.location.search);',
    '      const routeQuery = window.location.hash.includes("?")\n        ? window.location.hash.slice(window.location.hash.indexOf("?") + 1)\n        : "";\n      const params = new URLSearchParams(window.location.search || routeQuery);',
    'entregas: callback lê parâmetros dentro do Hash History',
  );
  replaceRequired(
    '.work/entregas/src/routes/redefinir-senha.tsx',
    '      const params = new URLSearchParams(window.location.search);',
    '      const routeQuery = window.location.hash.includes("?")\n        ? window.location.hash.slice(window.location.hash.indexOf("?") + 1)\n        : "";\n      const params = new URLSearchParams(window.location.search || routeQuery);',
    'entregas: recuperação lê parâmetros dentro do Hash History',
  );
  replaceRequired(
    '.work/entregas/src/lib/customer-push.ts',
    'export function isNativeCustomerAndroid() {\n  return (\n    getApoisProductMode() === "customer" &&\n    Capacitor.isNativePlatform() &&\n    Capacitor.getPlatform() === "android"\n  );\n}',
    'export function isNativeCustomerAndroid() {\n  const superappPushEnabled = import.meta.env["VITE_APOIS_SUPERAPP_PUSH_ENABLED"] !== "0";\n  return (\n    superappPushEnabled &&\n    getApoisProductMode() === "customer" &&\n    Capacitor.isNativePlatform() &&\n    Capacitor.getPlatform() === "android"\n  );\n}',
    'entregas: push só inicializa quando Firebase do Superapp estiver pronto',
  );
  replaceRequired(
    '.work/entregas/src/lib/customer-push.ts',
    '"register_customer_push_device"',
    '"register_superapp_customer_push_device"',
    'entregas: token FCM registra package do Superapp sem afetar app cliente',
  );
  replaceRequired(
    '.work/entregas/src/lib/customer-push.ts',
    '"remove_customer_push_devices"',
    '"remove_superapp_customer_push_devices"',
    'entregas: logout remove somente token FCM do Superapp',
  );
  replaceRequired(
    '.work/entregas/src/lib/customer-push.ts',
    '    ? `/pedido/${encodeURIComponent(orderId)}`\n    : "/notificacoes";',
    '    ? `#/pedido/${encodeURIComponent(orderId)}`\n    : "#/notificacoes";',
    'entregas: push abre rotas compatíveis com Hash History',
  );
  replaceRequired(
    '.work/entregas/src/lib/customer-push.ts',
    '        if (window.location.pathname !== target) window.location.assign(target);',
    '        if (window.location.hash !== target) window.location.assign(target);',
    'entregas: navegação de push compara hash no Superapp',
  );
  process.exit(0);
}

console.error(`Módulo desconhecido: ${name}`);
process.exit(1);
