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
  '.work/corridas/src/components/rides/active/RideStatusHeader.tsx',
  '          subtitle: "Confira o veículo e informe o PIN somente no embarque.",',
  '          subtitle: "Informe o código de segurança ao motorista para iniciar.",',
  'corridas: chegada orienta passageiro a informar o PIN',
);

console.log('[OK] corridas: finalização, cancelamento, retomada e monotonicidade endurecidos apenas em .work');
