import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const workspace = process.env.APOIS_MOTORISTA_WORKSPACE || '.work/partner-motorista';
const path = resolve(process.cwd(), workspace, 'src/routes/motorista.app.tsx');
let source = readFileSync(path, 'utf8');

if (source.includes('APOIS_DRIVER_START_NAV_V1')) {
  console.log('[OK] Motorista: navegação imediata pós-PIN já aplicada.');
  process.exit(0);
}

const needle = '              setActive((prev) => (prev && prev.id === active.id ? { ...prev, status: "em_viagem" } : prev));';
if (!source.includes(needle)) throw new Error('[FAIL] Motorista: transição otimista para em_viagem não encontrada');

const replacement = needle + `
              // APOIS_DRIVER_START_NAV_V1
              setPolyline([]);
              setRouteSteps([]);
              setEtaSeconds(null);
              setLegKm(null);
              lastRouteRequestKeyRef.current = null;
              lastFitKeyRef.current = null;
              autoFollowRef.current = true;
              if (position && mapRef.current) {
                applyNavigationCamera(
                  mapRef.current,
                  position,
                  [],
                  { lat: active.destination_lat, lng: active.destination_lng },
                  true,
                );
              }`;

source = source.replace(needle, replacement);

for (const marker of [
  'APOIS_DRIVER_START_NAV_V1',
  'lastRouteRequestKeyRef.current = null;',
  'applyNavigationCamera(',
  '{ lat: active.destination_lat, lng: active.destination_lng }',
]) {
  if (!source.includes(marker)) throw new Error('[FAIL] Motorista: navegação pós-PIN incompleta: ' + marker);
}

writeFileSync(path, source, 'utf8');
console.log('[OK] Motorista: ao validar PIN, câmera entra imediatamente em navegação e força nova rota ao destino.');
