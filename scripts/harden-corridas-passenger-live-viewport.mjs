import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const path = resolve('.work/corridas/src/components/map/ActiveRideMap.tsx');
let source = readFileSync(path, 'utf8');

function fail(message) {
  throw new Error(`[FAIL] passageiro viewport: ${message}`);
}

function replaceRegex(pattern, replacement, label) {
  if (!pattern.test(source)) fail(`${label}: padrão não encontrado em ActiveRideMap.tsx`);
  source = source.replace(pattern, replacement);
  console.log(`[OK] ${label}`);
}

if (!source.includes('const isTrip = ride.status === "em_viagem";')) {
  fail('fase em_viagem não foi criada pelo hardener de rota anterior');
}
if (!source.includes('const isApproach = ride.status === "motorista_a_caminho" || ride.status === "motorista_chegou";')) {
  fail('fase de aproximação não foi criada pelo hardener anterior');
}

// A linha já vem calculada pela Directions API; geodesic=true cria arco visual
// desnecessário em trechos longos.
if (source.includes('geodesic: true,')) {
  source = source.replace('geodesic: true,', 'geodesic: false,');
  console.log('[OK] passageiro: polyline segue geometria viária');
} else if (!source.includes('geodesic: false,')) {
  fail('configuração geodesic da polyline não encontrada');
}

// O snapshot antigo usava 132/36/265/36 de padding. Em um card de mapa baixo,
// isso forçava o Google Maps a reduzir o zoom até escala continental/mundial.
// O regex abaixo é propositalmente tolerante a espaçamento para não quebrar o
// build quando outro hardener acrescenta dependências ou comentários.
const staticBoundsPattern = /    if \(!bounds\.isEmpty\(\)\) \{\s*mapRef\.current\.fitBounds\(bounds, \{\s*top:\s*\d+,\s*right:\s*\d+,\s*bottom:\s*\d+,\s*left:\s*\d+,\s*\}\);\s*\}/m;
const staticBoundsReplacement = `    if (!bounds.isEmpty()) {
      if ((isApproach || isTrip) && driverLocation) {
        if (isTrip) {
          // Durante a viagem, a rota inteira permanece desenhada, mas a câmera
          // acompanha o carro em escala de navegação útil.
          mapRef.current.setCenter(driverLocation);
          const currentZoom = mapRef.current.getZoom?.();
          if (typeof currentZoom !== "number" || currentZoom < 13 || currentZoom > 17) {
            mapRef.current.setZoom(14);
          }
        } else {
          const liveBounds = new maps.LatLngBounds();
          liveBounds.extend(driverLocation);
          liveBounds.extend(origin);
          mapRef.current.fitBounds(liveBounds, {
            top: 76,
            right: 24,
            bottom: 92,
            left: 24,
          });
          maps.event.addListenerOnce(mapRef.current, "idle", () => {
            const zoom = mapRef.current?.getZoom?.();
            if (typeof zoom !== "number") return;
            if (zoom < 8) mapRef.current.setZoom(8);
            if (zoom > 17) mapRef.current.setZoom(17);
          });
        }
      } else {
        mapRef.current.fitBounds(bounds, {
          top: 64,
          right: 24,
          bottom: 84,
          left: 24,
        });
        maps.event.addListenerOnce(mapRef.current, "idle", () => {
          const zoom = mapRef.current?.getZoom?.();
          if (typeof zoom === "number" && zoom < 6) mapRef.current.setZoom(6);
        });
      }
    }`;

if (!source.includes('mapRef.current.setCenter(driverLocation)')) {
  replaceRegex(staticBoundsPattern, staticBoundsReplacement, 'passageiro: remove zoom mundial do fitBounds');
} else {
  console.log('[OK] passageiro: remove zoom mundial do fitBounds (já aplicado)');
}

// O efeito da geometria estática precisa reagir à posição viva quando estamos
// em aproximação/viagem. Aceita a forma antiga ou uma forma parcialmente
// endurecida para evitar dependência frágil de texto exato.
if (!source.includes('}, [destination, driverLocation, isApproach, isTrip, orderedStops, origin, routePoints, status]);')) {
  const depsPattern = /\}, \[destination,\s*(?:driverLocation,\s*)?isApproach,\s*(?:isTrip,\s*)?orderedStops, origin, routePoints, status\]\);/;
  replaceRegex(
    depsPattern,
    '}, [destination, driverLocation, isApproach, isTrip, orderedStops, origin, routePoints, status]);',
    'passageiro: geometria reage à fase e GPS real',
  );
}

// Em vez de substituir um bloco inteiro por correspondência textual, injeta a
// câmera por fase no ponto de decisão já existente. Assim comentários ou
// pequenas mudanças de formatação não derrubam o Codemagic.
if (!source.includes('mapRef.current.panTo(driverLocation)')) {
  const viewportNeedle = '    if (!firstDriverViewportRef.current) {';
  if (!source.includes(viewportNeedle)) fail('bloco de primeiro viewport do motorista não encontrado');

  const phaseViewport = `    if (isTrip) {
      firstDriverViewportRef.current = true;
      mapRef.current.panTo(driverLocation);
      const liveZoom = mapRef.current.getZoom?.();
      if (typeof liveZoom !== "number" || liveZoom < 13 || liveZoom > 17) {
        mapRef.current.setZoom(14);
      }
    } else if (isApproach && !firstDriverViewportRef.current) {
      firstDriverViewportRef.current = true;
      const approachBounds = new maps.LatLngBounds();
      approachBounds.extend(origin);
      approachBounds.extend(driverLocation);
      mapRef.current.fitBounds(approachBounds, {
        top: 76,
        right: 24,
        bottom: 92,
        left: 24,
      });
      maps.event.addListenerOnce(mapRef.current, "idle", () => {
        const nextZoom = mapRef.current?.getZoom?.();
        if (typeof nextZoom !== "number") return;
        if (nextZoom < 8) mapRef.current.setZoom(8);
        if (nextZoom > 17) mapRef.current.setZoom(17);
      });
    } else if (!firstDriverViewportRef.current) {`;

  source = source.replace(viewportNeedle, phaseViewport);
  console.log('[OK] passageiro: câmera acompanha motorista em viagem e coleta');
} else {
  console.log('[OK] passageiro: câmera acompanha motorista em viagem e coleta (já aplicado)');
}

if (!source.includes('}, [driverLocation, isApproach, isTrip, origin, ride.driver_heading, status]);')) {
  const trackingDeps = /\}, \[driverLocation,\s*(?:isApproach,\s*)?(?:isTrip,\s*)?origin, ride\.driver_heading, status\]\);/;
  replaceRegex(
    trackingDeps,
    '}, [driverLocation, isApproach, isTrip, origin, ride.driver_heading, status]);',
    'passageiro: tracking depende da fase viva',
  );
}

for (const required of [
  'mapRef.current.panTo(driverLocation)',
  'mapRef.current.setCenter(driverLocation)',
  'mapRef.current.setZoom(14)',
  'top: 76',
  'bottom: 92',
  'geodesic: false',
  'const isTrip = ride.status === "em_viagem"',
]) {
  if (!source.includes(required)) fail(`viewport final incompleto: ${required}`);
}

writeFileSync(path, source, 'utf8');
console.log('[OK] Passageiro: mapa vivo sem zoom mundial, seguindo o motorista e mantendo a rota APOIS até o destino.');
