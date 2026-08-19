import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const path = 'scripts/adapt-module-for-superapp.mjs';
const full = resolve(root, path);
let source = readFileSync(full, 'utf8');

function replaceAdapterLiteral(oldValue, currentValue, label) {
  if (source.includes(currentValue)) {
    console.log(`[OK] corridas: ${label} já acompanha snapshot atual`);
    return;
  }
  if (!source.includes(oldValue)) {
    console.error(`[FAIL] corridas: ${label} não pôde ser normalizado com segurança`);
    process.exit(1);
  }
  source = source.replace(oldValue, currentValue);
  console.log(`[OK] corridas: ${label} normalizado para snapshot atual`);
}

// The pinned Corridas snapshot now ships a newer ride-request implementation
// natively (real origin/destination/payment, route polyline, checkout total and
// idempotency signature). The historical Superapp adapter still contains
// replaceRequired calls for the old implementation. Patch only the transient
// adapter used in this checkout so those obsolete replacements are skipped.
const helperNeedle = "  const before = readFileSync(full, 'utf8');\n  if (!before.includes(search)) {";
const helperReplacement = "  const before = readFileSync(full, 'utf8');\n\n  const modernCorridasRideRequest =\n    path === '.work/corridas/src/hooks/rides/use-ride-request.tsx' &&\n    before.includes('const payload: RideRequestPayload = {') &&\n    before.includes('payment_method: selectedMethod,') &&\n    before.includes('service_details: toServiceDetails(serviceDetails),') &&\n    before.includes('encoded_polyline: route.encodedPolyline || null,') &&\n    before.includes('client_estimated_price: checkout.finalTotal,');\n\n  if (modernCorridasRideRequest) {\n    console.log(`[OK] ${label} (já nativo no snapshot atual de Corridas)`);\n    return;\n  }\n\n  if (!before.includes(search)) {";

if (!source.includes('modernCorridasRideRequest')) {
  if (!source.includes(helperNeedle)) {
    console.error(`[FAIL] corridas: helper inesperado em ${path}; não é seguro normalizar o adaptador`);
    process.exit(1);
  }
  source = source.replace(helperNeedle, helperReplacement);
  console.log('[OK] corridas: adapter compatível com ride-request moderno do snapshot atual');
}

// use-location.tsx gained requestPermission in the effect dependency list.
replaceAdapterLiteral(
  "    '  }, [checkPermissions, refreshLocation, updateLocationState]);',",
  "    '  }, [checkPermissions, refreshLocation, requestPermission, updateLocationState]);',",
  'busca do watcher de localização',
);
replaceAdapterLiteral(
  "    '  }, [checkPermissions, permissionState, refreshLocation, updateLocationState]);',",
  "    '  }, [checkPermissions, permissionState, refreshLocation, requestPermission, updateLocationState]);',",
  'resultado do watcher de localização',
);

// PassengerMap gained compact/selection/camera dependencies around the route.
replaceAdapterLiteral(
  "    '  }, [destination, orderedStops, origin, route?.decodedPoints, status]);',",
  "    '  }, [compact, destination, emitMapCenter, orderedStops, origin, route?.decodedPoints, selectionMode, status, validDriverLocation]);',",
  'busca das dependências do PassengerMap',
);
replaceAdapterLiteral(
  "    '  }, [destination, displayedRoutePoints, orderedStops, origin, status]);',",
  "    '  }, [compact, destination, displayedRoutePoints, emitMapCenter, orderedStops, origin, selectionMode, status, validDriverLocation]);',",
  'resultado das dependências do PassengerMap',
);

// use-active-ride.tsx now names the authenticated identity passengerId.
const legacySearch = '      !userId ||\\n      screenState !== "active" ||\\n      isRealtimeConnected ||\\n      !currentRideIdRef.current';
const currentSearch = '      !passengerId ||\\n      screenState !== "active" ||\\n      isRealtimeConnected ||\\n      !currentRideIdRef.current';
const legacyReplacement = '      !userId ||\\n      screenState !== "active" ||\\n      !currentRideIdRef.current';
const currentReplacement = '      !passengerId ||\\n      screenState !== "active" ||\\n      !currentRideIdRef.current';

if (!source.includes(currentSearch)) {
  if (!source.includes(legacySearch)) {
    console.error(`[FAIL] corridas: guarda Realtime inesperada em ${path}`);
    process.exit(1);
  }
  source = source.replace(legacySearch, currentSearch);
}
if (!source.includes(currentReplacement)) {
  if (!source.includes(legacyReplacement)) {
    console.error(`[FAIL] corridas: replacement do polling inesperado em ${path}`);
    process.exit(1);
  }
  source = source.replace(legacyReplacement, currentReplacement);
}

writeFileSync(full, source);
console.log('[OK] corridas: adaptador totalmente normalizado para o snapshot fixado antes de preparar .work');
