import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const workspace = process.env.APOIS_ENTREGAS_WORKSPACE || '.work/partner-entregador';
const path = resolve(root, workspace, 'src/components/CourierRouteMap.tsx');
let source = readFileSync(path, 'utf8');

const refAnchor = '  const lastPersistedRef = useRef<RouteMetrics | null>(null);';
if (!source.includes('const cameraTargetRef = useRef<LatLng | null>(null);')) {
  if (!source.includes(refAnchor)) throw new Error('Entregador Parceiro: âncora de refs do mapa ativo não encontrada.');
  source = source.replace(
    refAnchor,
    `${refAnchor}\n  const cameraTargetRef = useRef<LatLng | null>(null);`,
  );
}

const movementAnchor = `    const elapsed = previous ? Date.now() - previous.at : Number.POSITIVE_INFINITY;
    if (!targetChanged && moved < 50 && elapsed < 30_000) return;`;
if (!source.includes('const shouldFitCamera =')) {
  if (!source.includes(movementAnchor)) throw new Error('Entregador Parceiro: cálculo de atualização da rota não encontrado.');
  source = source.replace(
    movementAnchor,
    `${movementAnchor}\n    const shouldFitCamera =\n      cameraTargetRef.current === null || distanceMeters(cameraTargetRef.current, target) > 5;`,
  );
}

const successCamera = `        const bounds = new google.maps.LatLngBounds();
        bounds.extend(origin);
        bounds.extend(target);
        route.path?.forEach((point: google.maps.LatLngLiteral) => bounds.extend(point));
        map.fitBounds(bounds, { top: 64, right: 38, bottom: 72, left: 38 });`;
const successCameraNew = `        if (shouldFitCamera) {
          const bounds = new google.maps.LatLngBounds();
          bounds.extend(origin);
          bounds.extend(target);
          route.path?.forEach((point: google.maps.LatLngLiteral) => bounds.extend(point));
          map.fitBounds(bounds, { top: 64, right: 38, bottom: 72, left: 38 });
          cameraTargetRef.current = target;
        }`;
if (source.includes(successCamera)) source = source.replace(successCamera, successCameraNew);

const zoomBlock = `        if (metrics.distanceMeters > 5000) {
          map.panTo(origin);
          map.setZoom(13);
        } else if (metrics.distanceMeters > 1800) {
          map.panTo(origin);
          map.setZoom(14);
        }`;
const zoomBlockNew = `        if (shouldFitCamera && metrics.distanceMeters > 5000) {
          map.panTo(origin);
          map.setZoom(13);
        } else if (shouldFitCamera && metrics.distanceMeters > 1800) {
          map.panTo(origin);
          map.setZoom(14);
        }`;
if (source.includes(zoomBlock)) source = source.replace(zoomBlock, zoomBlockNew);

const fallbackCamera = `        const bounds = new google.maps.LatLngBounds();
        bounds.extend(origin);
        bounds.extend(target);
        map.fitBounds(bounds, { top: 64, right: 38, bottom: 72, left: 38 });
        lastRouteRef.current = { origin, target, at: Date.now() };`;
const fallbackCameraNew = `        if (shouldFitCamera) {
          const bounds = new google.maps.LatLngBounds();
          bounds.extend(origin);
          bounds.extend(target);
          map.fitBounds(bounds, { top: 64, right: 38, bottom: 72, left: 38 });
          cameraTargetRef.current = target;
        }
        lastRouteRef.current = { origin, target, at: Date.now() };`;
if (source.includes(fallbackCamera)) source = source.replace(fallbackCamera, fallbackCameraNew);

for (const marker of [
  'const cameraTargetRef = useRef<LatLng | null>(null);',
  'const shouldFitCamera =',
  'if (shouldFitCamera) {',
  'cameraTargetRef.current = target;',
  'else if (shouldFitCamera && metrics.distanceMeters > 1800)',
]) {
  if (!source.includes(marker)) throw new Error(`Entregador Parceiro: câmera do mapa ativo incompleta (${marker}).`);
}

writeFileSync(path, source, 'utf8');
console.log('[OK] Entregador Parceiro: rota continua recalculando sem puxar a câmera após o entregador mover o mapa; troca de destino reenquadra a rota.');
