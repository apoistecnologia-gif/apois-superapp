import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const path = resolve('.work/corridas/src/components/map/ActiveRideMap.tsx');
let source = readFileSync(path, 'utf8');

function fail(message) {
  throw new Error(`[FAIL] passageiro viewport: ${message}`);
}

if (!source.includes('const isTrip = ride.status === "em_viagem";')) {
  fail('fase em_viagem não foi criada pelo hardener de rota anterior');
}
if (!source.includes('const isApproach = ride.status === "motorista_a_caminho" || ride.status === "motorista_chegou";')) {
  fail('fase de aproximação não foi criada pelo hardener anterior');
}

// A rota já é devolvida pela Directions API; linha geodésica cria arcos visuais
// incorretos em trajetos rodoviários longos.
source = source.replaceAll('geodesic: true,', 'geodesic: false,');
if (!source.includes('geodesic: false,')) fail('configuração da polyline não encontrada');

// Remove o padding antigo exagerado sem depender da formatação dos hardeners anteriores.
source = source
  .replaceAll('top: 132,', 'top: 76,')
  .replaceAll('right: 36,', 'right: 24,')
  .replaceAll('bottom: 265,', 'bottom: 92,')
  .replaceAll('left: 36,', 'left: 24,');

const refsNeedle = '  const firstDriverViewportRef = useRef(false);';
if (!source.includes('stablePassengerViewportKeyRef')) {
  if (!source.includes(refsNeedle)) fail('ref de viewport original não encontrada');
  source = source.replace(
    refsNeedle,
    `${refsNeedle}\n  const stablePassengerViewportKeyRef = useRef<string | null>(null);\n  const stablePassengerCameraLocationRef = useRef<Coordinate | null>(null);`,
  );
}

const marker = 'APOIS_STABLE_PASSENGER_CAMERA_V4';
if (!source.includes(marker)) {
  const retryNeedle = '  const retry = () => {';
  if (!source.includes(retryNeedle)) fail('ponto de inserção do viewport estável não encontrado');

  const lines = [
    `  // ${marker}`,
    '  useEffect(() => {',
    '    if (status !== "ready" || !mapRef.current || !driverLocation) return;',
    '    const maps = (window as any).google?.maps;',
    '    if (!maps) return;',
    '',
    '    const navMap = mapRef.current as any;',
    '    navMap.setHeading?.(0);',
    '    navMap.setTilt?.(0);',
    '',
    '    const metersBetween = (a: Coordinate, b: Coordinate) => {',
    '      const toRad = (value: number) => (value * Math.PI) / 180;',
    '      const dLat = toRad(b.lat - a.lat);',
    '      const dLng = toRad(b.lng - a.lng);',
    '      const lat1 = toRad(a.lat);',
    '      const lat2 = toRad(b.lat);',
    '      const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;',
    '      return 6371000 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));',
    '    };',
    '',
    '    const cameraKey = ride.id + ":" + (isApproach ? "approach" : isTrip ? "trip" : "other");',
    '    const phaseChanged = stablePassengerViewportKeyRef.current !== cameraKey;',
    '    const lastCameraLocation = stablePassengerCameraLocationRef.current;',
    '    const driverMovedMeters = lastCameraLocation ? metersBetween(lastCameraLocation, driverLocation) : Number.POSITIVE_INFINITY;',
    '    const center = mapRef.current.getCenter?.();',
    '    const currentCenter = center ? { lat: center.lat(), lng: center.lng() } : null;',
    '    const currentZoom = mapRef.current.getZoom?.();',
    '',
    '    if (isTrip) {',
    '      const centerDriftMeters = currentCenter ? metersBetween(currentCenter, driverLocation) : Number.POSITIVE_INFINITY;',
    '      const zoomInvalid = typeof currentZoom !== "number" || currentZoom < 13 || currentZoom > 18;',
    '      if (phaseChanged || driverMovedMeters >= 18 || centerDriftMeters >= 35 || zoomInvalid) {',
    '        mapRef.current.panTo(driverLocation);',
    '        if (phaseChanged || zoomInvalid) mapRef.current.setZoom(15);',
    '        stablePassengerCameraLocationRef.current = driverLocation;',
    '      }',
    '      stablePassengerViewportKeyRef.current = cameraKey;',
    '      firstDriverViewportRef.current = true;',
    '      return;',
    '    }',
    '',
    '    if (isApproach) {',
    '      const pickupDistanceMeters = metersBetween(driverLocation, origin);',
    '      if (pickupDistanceMeters <= 120) {',
    '        const desiredCenter = {',
    '          lat: (driverLocation.lat + origin.lat) / 2,',
    '          lng: (driverLocation.lng + origin.lng) / 2,',
    '        };',
    '        const centerDriftMeters = currentCenter ? metersBetween(currentCenter, desiredCenter) : Number.POSITIVE_INFINITY;',
    '        const zoomInvalid = typeof currentZoom !== "number" || currentZoom < 16 || currentZoom > 18;',
    '        if (phaseChanged || driverMovedMeters >= 12 || centerDriftMeters >= 25 || zoomInvalid) {',
    '          mapRef.current.panTo(desiredCenter);',
    '          if (phaseChanged || zoomInvalid) mapRef.current.setZoom(17);',
    '          stablePassengerCameraLocationRef.current = driverLocation;',
    '        }',
    '      } else if (phaseChanged) {',
    '        const bounds = new maps.LatLngBounds();',
    '        bounds.extend(driverLocation);',
    '        bounds.extend(origin);',
    '        mapRef.current.fitBounds(bounds, { top: 76, right: 24, bottom: 92, left: 24 });',
    '        maps.event.addListenerOnce(mapRef.current, "idle", () => {',
    '          const zoom = mapRef.current?.getZoom?.();',
    '          if (typeof zoom === "number" && zoom > 16) mapRef.current.setZoom(16);',
    '        });',
    '        stablePassengerCameraLocationRef.current = driverLocation;',
    '      } else {',
    '        const currentBounds = mapRef.current.getBounds?.();',
    '        if (driverMovedMeters >= 40 && currentBounds && !currentBounds.contains(driverLocation)) {',
    '          const bounds = new maps.LatLngBounds();',
    '          bounds.extend(driverLocation);',
    '          bounds.extend(origin);',
    '          mapRef.current.fitBounds(bounds, { top: 76, right: 24, bottom: 92, left: 24 });',
    '          stablePassengerCameraLocationRef.current = driverLocation;',
    '        }',
    '      }',
    '      stablePassengerViewportKeyRef.current = cameraKey;',
    '      firstDriverViewportRef.current = true;',
    '      return;',
    '    }',
    '',
    '    stablePassengerViewportKeyRef.current = null;',
    '    stablePassengerCameraLocationRef.current = null;',
    '  }, [driverLocation, isApproach, isTrip, origin, ride.id, status]);',
    '',
  ];
  source = source.replace(retryNeedle, `${lines.join('\n')}${retryNeedle}`);
}

for (const required of [
  marker,
  'stablePassengerViewportKeyRef',
  'pickupDistanceMeters',
  'navMap.setHeading?.(0)',
  'mapRef.current.setZoom(17)',
  'mapRef.current.setZoom(15)',
  'driverMovedMeters >= 12',
  'geodesic: false',
]) {
  if (!source.includes(required)) fail(`viewport estável incompleto: ${required}`);
}

writeFileSync(path, source, 'utf8');
console.log('[OK] Passageiro: câmera estável por fase, sem fitBounds a cada atualização GPS e sem jitter na coleta.');
