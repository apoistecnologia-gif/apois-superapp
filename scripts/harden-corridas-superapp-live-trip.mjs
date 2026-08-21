import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();

function patch(relativePath, transform, verify, label) {
  const path = resolve(root, relativePath);
  const before = readFileSync(path, 'utf8');
  const after = transform(before);
  if (!verify(after)) {
    throw new Error(`[FAIL] ${label}: resultado esperado não encontrado em ${relativePath}`);
  }
  if (after !== before) writeFileSync(path, after, 'utf8');
  console.log(`[OK] ${label}`);
}

patch(
  '.work/corridas/src/services/rides/active-ride-service.ts',
  (source) => {
    let next = source;

    // Snapshot atual consulta o PIN por PIN_VISIBLE_STATUSES. A regra do
    // Superapp é mais restrita: o passageiro só recebe o PIN depois que o
    // motorista confirmou a chegada ao embarque.
    next = next.replace(
      'if (!["motorista_a_caminho", "motorista_chegou"].includes(ride.status)) return ride;',
      'if (ride.status !== "motorista_chegou") return { ...ride, security_code: null };',
    );
    next = next.replace(
      '    if (!PIN_VISIBLE_STATUSES.includes(ride.status)) {',
      '    if (ride.status !== "motorista_chegou") {',
    );

    return next;
  },
  (source) => source.includes('if (ride.status !== "motorista_chegou")'),
  'passageiro: PIN só é consultado depois que o motorista confirma a chegada',
);

patch(
  '.work/corridas/src/components/rides/active/ActiveJourneyScreen.tsx',
  (source) => {
    let next = source.replace(
      'const showPin = ["motorista_a_caminho", "motorista_chegou"].includes(status) && Boolean(ride.security_code);',
      'const showPin = status === "motorista_chegou" && Boolean(ride.security_code);',
    );

    next = next.replace(
      '  const totalPrice = ride.final_price ?? ride.estimated_price;',
      `  const totalPrice = ride.final_price ?? ride.estimated_price;\n  const pickupPhase = status === "motorista_a_caminho" || status === "motorista_chegou";\n  const mapFocusLabel = pickupPhase ? "Embarque" : "Destino";\n  const mapFocusName = pickupPhase ? ride.origin_name : ride.destination_name;\n  const mapFocusDistanceKm = (() => {\n    if (!pickupPhase) return ride.distance_km;\n    const lat = Number(ride.driver_latitude);\n    const lng = Number(ride.driver_longitude);\n    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;\n    const toRad = (value: number) => (value * Math.PI) / 180;\n    const dLat = toRad(ride.origin.lat - lat);\n    const dLng = toRad(ride.origin.lng - lng);\n    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat)) * Math.cos(toRad(ride.origin.lat)) * Math.sin(dLng / 2) ** 2;\n    return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(a)));\n  })();`,
    );

    next = next.replace(
      '<p className="text-[9px] font-black uppercase tracking-[0.13em] text-apois-yellow">Destino</p>',
      '<p className="text-[9px] font-black uppercase tracking-[0.13em] text-apois-yellow">{mapFocusLabel}</p>',
    );
    next = next.replace(
      '<p className="mt-1 line-clamp-2 text-[12px] font-black leading-4 text-white">{ride.destination_name}</p>',
      '<p className="mt-1 line-clamp-2 text-[12px] font-black leading-4 text-white">{mapFocusName}</p>',
    );
    next = next.replace(
      '<p className="text-[9px] font-bold text-zinc-500">Distância</p>',
      '<p className="text-[9px] font-bold text-zinc-500">{pickupPhase ? "Até embarque" : "Distância"}</p>',
    );
    next = next.replace(
      '{typeof ride.distance_km === "number" ? `${ride.distance_km.toFixed(1).replace(".", ",")} km` : "—"}',
      '{typeof mapFocusDistanceKm === "number" ? `${mapFocusDistanceKm.toFixed(mapFocusDistanceKm < 10 ? 1 : 0).replace(".", ",")} km` : "—"}',
    );

    next = next.replace(
      '<DetailItem icon={ShieldCheck} label="Código de segurança" value={ride.security_code || "—"} highlight />',
      '<div className="col-span-2 rounded-2xl border border-apois-yellow/35 bg-apois-yellow/[0.08] px-4 py-4 text-center shadow-[0_14px_38px_-24px_rgba(246,190,28,0.8)]"><div className="flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-apois-yellow"><ShieldCheck size={16} /> PIN DE EMBARQUE</div><div className="mt-2 font-mono text-[34px] font-black tracking-[0.28em] text-white">{ride.security_code || "—"}</div><p className="mt-1 text-[10px] font-medium text-zinc-400">Informe este PIN ao motorista somente depois de conferir o veículo.</p></div>',
    );

    return next;
  },
  (source) => source.includes('const showPin = status === "motorista_chegou"') && source.includes('PIN DE EMBARQUE') && source.includes('mapFocusLabel'),
  'passageiro: tela ativa mostra embarque na aproximação e PIN destacado após chegada',
);

patch(
  '.work/corridas/src/components/map/ActiveRideMap.tsx',
  (source) => {
    let next = source;

    if (!next.includes('const [approachRoutePoints')) {
      next = next.replace(
        '  const [reloadKey, setReloadKey] = useState(0);',
        '  const [reloadKey, setReloadKey] = useState(0);\n  const [approachRoutePoints, setApproachRoutePoints] = useState<Coordinate[]>([]);\n  const isApproach = ride.status === "motorista_a_caminho" || ride.status === "motorista_chegou";',
      );
    }

    if (!next.includes('const approachRouteKey')) {
      next = next.replace(
        '  const routePoints = useMemo<Coordinate[]>(() => {',
        `  const approachRouteKey = driverLocation\n    ? driverLocation.lat.toFixed(3) + ":" + driverLocation.lng.toFixed(3)\n    : "";\n\n  useEffect(() => {\n    if (!isApproach || !driverLocation || status !== "ready") {\n      if (!isApproach) setApproachRoutePoints([]);\n      return;\n    }\n\n    let cancelled = false;\n    const maps = (window as any).google?.maps;\n    const fallback = [driverLocation, origin];\n    if (!maps?.DirectionsService || !maps?.TravelMode) {\n      setApproachRoutePoints(fallback);\n      return;\n    }\n\n    const service = new maps.DirectionsService();\n    service.route(\n      { origin: driverLocation, destination: origin, travelMode: maps.TravelMode.DRIVING },\n      (result: any) => {\n        if (cancelled) return;\n        const overview = result?.routes?.[0]?.overview_path ?? [];\n        const points = overview\n          .map((point: any) => ({ lat: point.lat(), lng: point.lng() }))\n          .filter(validCoordinate);\n        setApproachRoutePoints(points.length > 1 ? points : fallback);\n      },\n    ).catch?.(() => { if (!cancelled) setApproachRoutePoints(fallback); });\n\n    return () => { cancelled = true; };\n  }, [approachRouteKey, isApproach, origin.lat, origin.lng, status]);\n\n  const routePoints = useMemo<Coordinate[]>(() => {`,
      );
    }

    next = next.replace(
      '  const routePoints = useMemo<Coordinate[]>(() => {\n    if (ride.encoded_polyline) {',
      '  const routePoints = useMemo<Coordinate[]>(() => {\n    if (isApproach && driverLocation) {\n      return approachRoutePoints.length > 1 ? approachRoutePoints : [driverLocation, origin];\n    }\n\n    if (ride.encoded_polyline) {',
    );
    next = next.replace(
      '  }, [destination, origin, orderedStops, ride.encoded_polyline, ride.id]);',
      '  }, [approachRoutePoints, destination, driverLocation, isApproach, origin, orderedStops, ride.encoded_polyline, ride.id]);',
    );

    next = next.replace('    orderedStops.forEach((stop, index) => {', '    if (!isApproach) orderedStops.forEach((stop, index) => {');
    next = next.replace('    addMarker(destination, "Destino", "#F6BE1C", "square");', '    if (!isApproach) addMarker(destination, "Destino", "#F6BE1C", "square");');
    next = next.replace('  }, [destination, orderedStops, origin, routePoints, status]);', '  }, [destination, isApproach, orderedStops, origin, routePoints, status]);');

    return next;
  },
  (source) => source.includes('approachRoutePoints') && source.includes('maps.DirectionsService') && source.includes('if (isApproach && driverLocation)') && source.includes('if (!isApproach) addMarker(destination'),
  'passageiro: mapa acompanha motorista até o embarque e usa rota da viagem depois do PIN',
);

console.log('[OK] fluxo vivo Corridas: aproximação, mapa por fase e PIN pós-chegada corrigidos em .work');
