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
    '  }, [checkPermissions, refreshLocation, requestPermission, updateLocationState]);',
    '  }, [checkPermissions, permissionState, refreshLocation, requestPermission, updateLocationState]);',
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
    '  }, [compact, destination, emitMapCenter, orderedStops, origin, route?.decodedPoints, selectionMode, status, validDriverLocation]);',
    '  }, [compact, destination, displayedRoutePoints, emitMapCenter, orderedStops, origin, selectionMode, status, validDriverLocation]);',
    'corridas: atualização do mapa acompanha rota persistida',
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
  replaceRequired(
    '.work/entregas/src/components/GoogleLoginButton.tsx',
    'const CUSTOMER_OAUTH_CALLBACK = "br.com.apois.cliente://auth/callback";',
    'const CUSTOMER_OAUTH_CALLBACK = "br.com.apois.app://auth/callback";',
    'entregas: callback Google usa package unificado',
  );
  replaceRequired(
    '.work/entregas/src/components/GoogleLoginButton.tsx',
    '      window.location.replace("/inicio");',
    '      window.location.replace("#/inicio");',
    'entregas: pós-login Google respeita Hash History do Superapp',
  );
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
