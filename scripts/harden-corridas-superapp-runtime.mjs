import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function replaceRequired(path, search, replacement, label) {
  const full = resolve(root, path);
  const before = readFileSync(full, 'utf8');
  if (!before.includes(search)) {
    console.error(`[FAIL] ${label}: padrão esperado não encontrado em ${path}`);
    process.exit(1);
  }
  writeFileSync(full, before.replace(search, replacement));
  console.log(`[OK] ${label}`);
}

replaceRequired(
  '.work/corridas/src/hooks/rides/use-active-ride.tsx',
  'const POLLING_INTERVAL_MS = 12_000;\nconst PIN_VISIBLE_STATUSES: RideStatus[] = ["motorista_a_caminho", "motorista_chegou"];',
  'const POLLING_INTERVAL_MS = 12_000;\nconst PIN_VISIBLE_STATUSES: RideStatus[] = ["motorista_a_caminho", "motorista_chegou"];\n\nconst RIDE_STATUS_ORDER: Record<RideStatus, number> = {\n  agendada: 0,\n  aguardando_pagamento: 1,\n  procurar_motorista: 2,\n  motorista_a_caminho: 3,\n  motorista_chegou: 4,\n  em_viagem: 5,\n  finalizada: 6,\n  cancelada_passageiro: 6,\n  cancelada_motorista: 6,\n  expired: 6,\n};\n\nconst isTerminalRideStatus = (status: RideStatus) =>\n  status === "finalizada" || status === "expired" || status.startsWith("cancelada");',
  'corridas: define ordem monotônica completa dos estados da corrida',
);

replaceRequired(
  '.work/corridas/src/hooks/rides/use-active-ride.tsx',
  '  const passengerId = profile?.id ?? null;\n',
  '  const passengerId = profile?.id ?? null;\n  const userId = passengerId;\n',
  'corridas: mantém alias estável usado pela validação do polling',
);

replaceRequired(
  '.work/corridas/src/hooks/rides/use-active-ride.tsx',
  '      !passengerId ||\n      screenState !== "active" ||\n      !currentRideIdRef.current',
  '      !userId ||\n      screenState !== "active" ||\n      !currentRideIdRef.current',
  'corridas: polling de segurança permanece ativo com identidade autenticada',
);

replaceRequired(
  '.work/corridas/src/hooks/rides/use-active-ride.tsx',
  '  const realtimeConnectedRef = useRef(false);\n',
  '  const realtimeConnectedRef = useRef(false);\n  const lastAcceptedStatusRef = useRef<RideStatus | null>(null);\n',
  'corridas: guarda último estado aceito da corrida',
);

replaceRequired(
  '.work/corridas/src/hooks/rides/use-active-ride.tsx',
  '    pollingPromiseRef.current = null;\n    realtimeConnectedRef.current = false;',
  '    pollingPromiseRef.current = null;\n    realtimeConnectedRef.current = false;\n    lastAcceptedStatusRef.current = null;',
  'corridas: reset também limpa estado monotônico',
);

replaceRequired(
  '.work/corridas/src/hooks/rides/use-active-ride.tsx',
  '  const handleUpdate = useCallback((updatedRide: ActiveRide) => {\n    if (currentRideIdRef.current && updatedRide.id !== currentRideIdRef.current) return;\n\n    // The PIN is deliberately no longer stored in the realtime-readable rides row.',
  '  const handleUpdate = useCallback((updatedRide: ActiveRide) => {\n    if (currentRideIdRef.current && updatedRide.id !== currentRideIdRef.current) return;\n\n    const previousStatus = lastAcceptedStatusRef.current;\n    if (previousStatus) {\n      if (isTerminalRideStatus(previousStatus) && updatedRide.status !== previousStatus) return;\n      if (RIDE_STATUS_ORDER[updatedRide.status] < RIDE_STATUS_ORDER[previousStatus]) return;\n    }\n    lastAcceptedStatusRef.current = updatedRide.status;\n\n    // The PIN is deliberately no longer stored in the realtime-readable rides row.',
  'corridas: Realtime/polling não podem regredir estado da corrida',
);

replaceRequired(
  '.work/corridas/src/hooks/rides/use-active-ride.tsx',
  '        currentRideIdRef.current = rideId;\n        handleUpdate(data);',
  '        if (currentRideIdRef.current !== rideId) lastAcceptedStatusRef.current = null;\n        currentRideIdRef.current = rideId;\n        handleUpdate(data);',
  'corridas: nova corrida reinicia proteção monotônica',
);

replaceRequired(
  '.work/corridas/src/hooks/rides/use-active-ride.tsx',
  '        if (!activeRide) {\n          if (!currentRideIdRef.current) {\n            setRide(null);\n            setScreenState("idle");\n            setError(null);\n          }\n          return null;\n        }',
  '        if (!activeRide) {\n          const currentRideId = currentRideIdRef.current;\n          if (currentRideId) {\n            // O app pode voltar do background depois que a corrida terminou ou foi cancelada.\n            // Nesse caso ela já não aparece em getActiveRide(), então recarregamos o ID conhecido\n            // para que o passageiro veja corretamente a tela terminal em vez de ficar preso no estado anterior.\n            await loadRide(currentRideId);\n          } else {\n            setRide(null);\n            setScreenState("idle");\n            setError(null);\n          }\n          return null;\n        }',
  'corridas: retomada do background recupera finalização/cancelamento terminal',
);

replaceRequired(
  '.work/corridas/src/hooks/use-push-notifications.tsx',
  '  useEffect(() => {\n    let cancelled = false;\n\n    const syncPushSession = async () => {',
  '  useEffect(() => {\n    if (import.meta.env["VITE_APOIS_SUPERAPP_RIDES_PUSH_ENABLED"] !== "1") return;\n\n    let cancelled = false;\n\n    const syncPushSession = async () => {',
  'corridas: FCM próprio fica isolado até projeto Firebase unificado estar compatível',
);

replaceRequired(
  '.work/corridas/src/routes/_authenticated.corrida.$rideId.tsx',
  '  const isQueuedRide =\n    status === "procurar_motorista" && Boolean(ride.driver_id && ride.queued_after_ride_id);',
  '  const isQueuedRide =\n    status === "procurar_motorista" && Boolean(ride.driver_id && ride.queued_after_ride_id);\n  const isPreTripStatus = ["motorista_a_caminho", "motorista_chegou"].includes(status);',
  'corridas: explicita estados pré-viagem que mantêm PIN disponível',
);

replaceRequired(
  '.work/corridas/src/routes/_authenticated.corrida.$rideId.tsx',
  '  if (\n    screenState === "active" &&\n    ["motorista_a_caminho", "motorista_chegou", "em_viagem"].includes(status)\n  ) {',
  '  if (screenState === "active" && (isPreTripStatus || status === "em_viagem")) {',
  'corridas: fluxo ativo distingue pré-viagem de viagem iniciada',
);

replaceRequired(
  '.work/corridas/src/components/rides/active/RideStatusHeader.tsx',
  '          subtitle: "Confira o veículo e informe o PIN somente no embarque.",',
  '          subtitle: "Informe o código de segurança ao motorista para iniciar.",',
  'corridas: chegada orienta passageiro a informar o PIN',
);

replaceRequired(
  '.work/corridas/src/components/map/ActiveRideMap.tsx',
  'interface ActiveRideMapProps {\n  ride: ActiveRide;\n}',
  'interface ActiveRideMapProps {\n  ride: ActiveRide;\n  compact?: boolean;\n}',
  'corridas: mapa ativo aceita modo compacto',
);

replaceRequired(
  '.work/corridas/src/components/map/ActiveRideMap.tsx',
  'export function ActiveRideMap({ ride }: ActiveRideMapProps) {',
  'export function ActiveRideMap({ ride, compact = false }: ActiveRideMapProps) {',
  'corridas: mapa ativo recebe modo compacto',
);

replaceRequired(
  '.work/corridas/src/components/map/ActiveRideMap.tsx',
  '      mapRef.current.fitBounds(bounds, {\n        top: 132,\n        right: 36,\n        bottom: 265,\n        left: 36,\n      });',
  '      mapRef.current.fitBounds(\n        bounds,\n        compact\n          ? { top: 24, right: 24, bottom: 24, left: 24 }\n          : { top: 132, right: 36, bottom: 265, left: 36 },\n      );',
  'corridas: enquadramento compacto não força mapa-múndi',
);

replaceRequired(
  '.work/corridas/src/components/map/ActiveRideMap.tsx',
  '        mapRef.current.fitBounds(approachBounds, {\n          top: 132,\n          right: 36,\n          bottom: 265,\n          left: 36,\n        });',
  '        mapRef.current.fitBounds(\n          approachBounds,\n          compact\n            ? { top: 24, right: 24, bottom: 24, left: 24 }\n            : { top: 132, right: 36, bottom: 265, left: 36 },\n        );',
  'corridas: aproximação do motorista respeita mapa compacto',
);

replaceRequired(
  '.work/corridas/src/components/map/ActiveRideMap.tsx',
  '  }, [destination, orderedStops, origin, routePoints, status]);',
  '  }, [compact, destination, orderedStops, origin, routePoints, status]);',
  'corridas: efeito estático acompanha modo compacto',
);

replaceRequired(
  '.work/corridas/src/components/map/ActiveRideMap.tsx',
  '  }, [driverLocation, origin, ride.driver_heading, status]);',
  '  }, [compact, driverLocation, origin, ride.driver_heading, status]);',
  'corridas: tracking acompanha modo compacto',
);

replaceRequired(
  '.work/corridas/src/components/map/ActiveRideMap.tsx',
  '    <div className="relative h-full min-h-[320px] w-full overflow-hidden bg-[#171a21]">',
  '    <div className={`relative h-full ${compact ? "min-h-0" : "min-h-[320px]"} w-full overflow-hidden bg-[#171a21]`}>',
  'corridas: mapa compacto usa altura real do card',
);

replaceRequired(
  '.work/corridas/src/routes/_authenticated.corrida.$rideId.tsx',
  '            <section className="h-[190px] overflow-hidden rounded-[26px] border border-white/8 bg-zinc-900">\n              <ActiveRideMap ride={ride} />\n            </section>',
  '            <section className="h-[230px] overflow-hidden rounded-[26px] border border-white/8 bg-zinc-900">\n              <ActiveRideMap ride={ride} compact />\n            </section>',
  'corridas: pagamento mostra mapa real escuro com rota enquadrada',
);

console.log('[OK] corridas: lifecycle, PIN, retomada e mapa compacto do pagamento endurecidos apenas em .work');
