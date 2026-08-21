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

// A rota já é devolvida pela Directions API. Nunca usar arco geodésico numa
// rota rodoviária longa.
source = source.replaceAll('geodesic: true,', 'geodesic: false,');
if (!source.includes('geodesic: false,')) {
  fail('configuração da polyline não encontrada');
}

// Elimina o padding antigo que fazia um card baixo abrir em escala continental.
// Estas substituições são deliberadamente simples e idempotentes para não
// depender da formatação produzida pelos hardeners anteriores.
source = source
  .replaceAll('top: 132,', 'top: 76,')
  .replaceAll('right: 36,', 'right: 24,')
  .replaceAll('bottom: 265,', 'bottom: 92,')
  .replaceAll('left: 36,', 'left: 24,');

// Em vez de reescrever efeitos existentes por correspondência textual frágil,
// acrescentamos um efeito final de câmera. Como ele aparece depois dos efeitos
// originais, sempre corrige o enquadramento após qualquer fitBounds anterior.
const liveViewportMarker = 'APOIS_LIVE_VIEWPORT_V3';
if (!source.includes(liveViewportMarker)) {
  const retryNeedle = '  const retry = () => {';
  if (!source.includes(retryNeedle)) fail('ponto de inserção do viewport vivo não encontrado');

  const liveViewportEffect = `  // APOIS_LIVE_VIEWPORT_V3\n  useEffect(() => {\n    if (status !== "ready" || !mapRef.current || !driverLocation) return;\n    const maps = (window as any).google?.maps;\n    if (!maps) return;\n\n    if (isTrip) {\n      firstDriverViewportRef.current = true;\n      mapRef.current.panTo(driverLocation);\n      const zoom = mapRef.current.getZoom?.();\n      if (typeof zoom !== "number" || zoom < 13 || zoom > 17) {\n        mapRef.current.setZoom(14);\n      }\n      return;\n    }\n\n    if (isApproach) {\n      const bounds = new maps.LatLngBounds();\n      bounds.extend(driverLocation);\n      bounds.extend(origin);\n      mapRef.current.fitBounds(bounds, {\n        top: 76,\n        right: 24,\n        bottom: 92,\n        left: 24,\n      });\n      maps.event.addListenerOnce(mapRef.current, "idle", () => {\n        const zoom = mapRef.current?.getZoom?.();\n        if (typeof zoom !== "number") return;\n        if (zoom < 8) mapRef.current.setZoom(8);\n        if (zoom > 17) mapRef.current.setZoom(17);\n      });\n      firstDriverViewportRef.current = true;\n    }\n  }, [driverLocation, isApproach, isTrip, origin, status]);\n\n`;

  source = source.replace(retryNeedle, `${liveViewportEffect}${retryNeedle}`);
}

for (const required of [
  liveViewportMarker,
  'mapRef.current.panTo(driverLocation)',
  'mapRef.current.setZoom(14)',
  'top: 76',
  'bottom: 92',
  'geodesic: false',
  'const isTrip = ride.status === "em_viagem"',
]) {
  if (!source.includes(required)) fail(`viewport final incompleto: ${required}`);
}

writeFileSync(path, source, 'utf8');
console.log('[OK] Passageiro: viewport vivo aplicado sem regex frágil; viagem segue o motorista e aproximação enquadra a coleta.');
