import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const path = resolve(process.cwd(), '.work/corridas/src/components/map/PassengerMap.tsx');
let source = readFileSync(path, 'utf8');

if (source.includes('APOIS_PASSENGER_CAMERA_STABLE_V1')) {
  console.log('[OK] Passageiro: câmera estável já aplicada.');
  process.exit(0);
}

source = source.replace(
  '  const nativeSyncGenerationRef = useRef(0);',
  '  const nativeSyncGenerationRef = useRef(0);\n  const nativeCameraKeyRef = useRef<string | null>(null);',
);

const focusNeedle = [
  '      const focus = [',
  '        origin,',
  '        validDriverLocation,',
  '        ...orderedStops',
  '          .filter((stop) => isCoordinate(stop.latitude) && isCoordinate(stop.longitude))',
  '          .map((stop) => ({ lat: stop.latitude, lng: stop.longitude })),',
  '        destination,',
  '      ].filter(Boolean) as Coordinate[];',
  '',
  '      if (!focus.length) return;',
].join('\n');

const focusReplacement = [
  '      // APOIS_PASSENGER_CAMERA_STABLE_V1',
  '      const cameraKey = [',
  '        origin?.lat?.toFixed(5) ?? "",',
  '        origin?.lng?.toFixed(5) ?? "",',
  '        destination?.lat?.toFixed(5) ?? "",',
  '        destination?.lng?.toFixed(5) ?? "",',
  '        isStatic ? "static" : "live",',
  '      ].join(":");',
  '',
  '      if (nativeCameraKeyRef.current === cameraKey) return;',
  '      nativeCameraKeyRef.current = cameraKey;',
  '',
  '      const focus = [',
  '        origin,',
  '        validDriverLocation,',
  '        ...orderedStops',
  '          .filter((stop) => isCoordinate(stop.latitude) && isCoordinate(stop.longitude))',
  '          .map((stop) => ({ lat: stop.latitude, lng: stop.longitude })),',
  '        destination,',
  '      ].filter(Boolean) as Coordinate[];',
  '',
  '      if (!focus.length) return;',
].join('\n');

if (!source.includes(focusNeedle)) throw new Error('[FAIL] Passageiro: bloco de foco nativo não encontrado');
source = source.replace(focusNeedle, focusReplacement);

source = source.replace(
  '    if (nativeMapRef.current) {\n      void nativeMapRef.current.destroy().catch(() => undefined);',
  '    nativeCameraKeyRef.current = null;\n    if (nativeMapRef.current) {\n      void nativeMapRef.current.destroy().catch(() => undefined);',
);

for (const marker of ['APOIS_PASSENGER_CAMERA_STABLE_V1','nativeCameraKeyRef','if (nativeCameraKeyRef.current === cameraKey) return;']) {
  if (!source.includes(marker)) throw new Error('[FAIL] Passageiro: estabilização da câmera incompleta: ' + marker);
}

writeFileSync(path, source, 'utf8');
console.log('[OK] Passageiro: mapa atualiza motorista/rota sem refazer zoom a cada GPS.');