import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const path = resolve('.work/corridas/src/components/map/ActiveRideMap.tsx');
let source = readFileSync(path, 'utf8');

function replaceRequired(search, replacement, label) {
  if (source.includes(replacement)) {
    console.log(`[OK] ${label} (já aplicado)`);
    return;
  }
  if (!source.includes(search)) {
    throw new Error(`[FAIL] ${label}: padrão não encontrado em ActiveRideMap.tsx`);
  }
  source = source.replace(search, replacement);
  console.log(`[OK] ${label}`);
}

replaceRequired(
  '  const [approachRoutePoints, setApproachRoutePoints] = useState<Coordinate[]>([]);\n  const isApproach = ride.status === "motorista_a_caminho" || ride.status === "motorista_chegou";',
  '  const [approachRoutePoints, setApproachRoutePoints] = useState<Coordinate[]>([]);\n  const [tripRoutePoints, setTripRoutePoints] = useState<Coordinate[]>([]);\n  const isApproach = ride.status === "motorista_a_caminho" || ride.status === "motorista_chegou";\n  const isTrip = ride.status === "em_viagem";',
  'passageiro: mapa distingue aproximação e viagem',
);

replaceRequired(
  '  }, [approachRouteKey, isApproach, origin.lat, origin.lng, status]);\n\n  const routePoints = useMemo<Coordinate[]>(() => {',
  `  }, [approachRouteKey, isApproach, origin.lat, origin.lng, status]);\n\n  const tripRouteKey = driverLocation\n    ? driverLocation.lat.toFixed(4) + ":" + driverLocation.lng.toFixed(4)\n    : "";\n\n  useEffect(() => {\n    if (!isTrip || status !== "ready") {\n      if (!isTrip) setTripRoutePoints([]);\n      return;\n    }\n\n    const start = driverLocation ?? origin;\n    const fallback = [start, ...orderedStops.map(({ lat, lng }) => ({ lat, lng })), destination].filter(validCoordinate);\n    const maps = (window as any).google?.maps;\n    if (!maps?.DirectionsService || !maps?.TravelMode) {\n      setTripRoutePoints(fallback);\n      return;\n    }\n\n    let cancelled = false;\n    const service = new maps.DirectionsService();\n    const request: any = {\n      origin: start,\n      destination,\n      travelMode: maps.TravelMode.DRIVING,\n    };\n    if (orderedStops.length) {\n      request.waypoints = orderedStops.map((stop) => ({\n        location: { lat: stop.lat, lng: stop.lng },\n        stopover: true,\n      }));\n      request.optimizeWaypoints = false;\n    }\n\n    service.route(request, (result: any, resultStatus: any) => {\n      if (cancelled) return;\n      const okStatus = maps.DirectionsStatus?.OK ?? "OK";\n      if (resultStatus !== okStatus && resultStatus !== "OK") {\n        setTripRoutePoints(fallback);\n        return;\n      }\n      const overview = result?.routes?.[0]?.overview_path ?? [];\n      const points = overview\n        .map((point: any) => ({ lat: point.lat(), lng: point.lng() }))\n        .filter(validCoordinate);\n      setTripRoutePoints(points.length > 1 ? points : fallback);\n    });\n\n    return () => { cancelled = true; };\n  }, [destination.lat, destination.lng, isTrip, orderedStops, origin, status, tripRouteKey]);\n\n  const routePoints = useMemo<Coordinate[]>(() => {`,
  'passageiro: viagem usa DirectionsService da posição real até o destino',
);

replaceRequired(
  `  const routePoints = useMemo<Coordinate[]>(() => {\n    if (isApproach && driverLocation) {\n      return approachRoutePoints.length > 1 ? approachRoutePoints : [driverLocation, origin];\n    }\n\n    if (ride.encoded_polyline) {`,
  `  const routePoints = useMemo<Coordinate[]>(() => {\n    if (isApproach) {\n      if (!driverLocation) return [origin];\n      return approachRoutePoints.length > 1 ? approachRoutePoints : [driverLocation, origin];\n    }\n\n    if (isTrip) {\n      const start = driverLocation ?? origin;\n      return tripRoutePoints.length > 1\n        ? tripRoutePoints\n        : [start, ...orderedStops.map(({ lat, lng }) => ({ lat, lng })), destination].filter(validCoordinate);\n    }\n\n    if (ride.encoded_polyline) {`,
  'passageiro: polyline persistida nunca controla o enquadramento durante viagem viva',
);

replaceRequired(
  '  }, [approachRoutePoints, destination, driverLocation, isApproach, origin, orderedStops, ride.encoded_polyline, ride.id]);',
  '  }, [approachRoutePoints, destination, driverLocation, isApproach, isTrip, origin, orderedStops, ride.encoded_polyline, ride.id, tripRoutePoints]);',
  'passageiro: rota viva participa das dependências do mapa',
);

for (const required of [
  'const [tripRoutePoints',
  'const isTrip = ride.status === "em_viagem"',
  'request.waypoints = orderedStops.map',
  'polyline persistida',
  'tripRoutePoints.length > 1',
]) {
  if (!source.includes(required)) throw new Error(`[FAIL] mapa de passageiro incompleto: ${required}`);
}

writeFileSync(path, source, 'utf8');
console.log('[OK] Passageiro: mapa traça motorista→embarque e motorista→destino com rota viária viva, sem zoom mundial.');
