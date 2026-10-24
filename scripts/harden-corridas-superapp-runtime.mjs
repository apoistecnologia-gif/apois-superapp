import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();

function patch(path, transform, label) {
  const full = resolve(root, path);
  const before = readFileSync(full, 'utf8');
  const after = transform(before);
  if (after === before) {
    console.log(`[OK] ${label} (já aplicado ou nativo)`);
    return;
  }
  writeFileSync(full, after, 'utf8');
  console.log(`[OK] ${label}`);
}

function requireMarkers(path, markers, label) {
  const source = readFileSync(resolve(root, path), 'utf8');
  const missing = markers.filter((marker) => !source.includes(marker));
  if (missing.length) throw new Error(`[FAIL] ${label}: ${missing.join(' | ')}`);
  console.log(`[OK] ${label}`);
}

// O snapshot fixado usa PassengerMap diretamente na rota da corrida; não existe
// ActiveRideMap/RidePixPaymentCard neste pin. O hardening abaixo atua somente
// nos componentes reais do snapshot e preserva a proteção de ciclo de vida.
patch('.work/corridas/src/hooks/rides/use-active-ride.tsx', (source) => {
  let next = source;

  if (!next.includes('const RIDE_STATUS_ORDER: Record<RideStatus, number>')) {
    next = next.replace(
      'const POLLING_INTERVAL_MS = 12_000;',
      `const POLLING_INTERVAL_MS = 12_000;\n\nconst RIDE_STATUS_ORDER: Record<RideStatus, number> = {\n  agendada: 0,\n  procurar_motorista: 1,\n  motorista_a_caminho: 2,\n  motorista_chegou: 3,\n  em_viagem: 4,\n  finalizada: 5,\n  cancelada_passageiro: 5,\n  cancelada_motorista: 5,\n  expired: 5,\n};\n\nconst isTerminalRideStatus = (status: RideStatus) =>\n  status === \"finalizada\" || status === \"expired\" || status.startsWith(\"cancelada\");`,
    );
  }

  if (!next.includes('const lastAcceptedStatusRef = useRef<RideStatus | null>(null);')) {
    next = next.replace(
      '  const pollingPromiseRef = useRef<Promise<void> | null>(null);',
      '  const pollingPromiseRef = useRef<Promise<void> | null>(null);\n  const lastAcceptedStatusRef = useRef<RideStatus | null>(null);',
    );
  }

  if (!next.includes('lastAcceptedStatusRef.current = null;\n    void activeRideService.unsubscribe();')) {
    next = next.replace(
      '    pollingPromiseRef.current = null;\n    void activeRideService.unsubscribe();',
      '    pollingPromiseRef.current = null;\n    lastAcceptedStatusRef.current = null;\n    void activeRideService.unsubscribe();',
    );
  }

  if (!next.includes('RIDE_STATUS_ORDER[updatedRide.status] < RIDE_STATUS_ORDER[previousStatus]')) {
    next = next.replace(
      '  const handleUpdate = useCallback((updatedRide: ActiveRide) => {\n    if (currentRideIdRef.current && updatedRide.id !== currentRideIdRef.current) return;\n\n    setRide(updatedRide);',
      `  const handleUpdate = useCallback((updatedRide: ActiveRide) => {\n    if (currentRideIdRef.current && updatedRide.id !== currentRideIdRef.current) return;\n\n    const previousStatus = lastAcceptedStatusRef.current;\n    if (previousStatus) {\n      if (isTerminalRideStatus(previousStatus) && updatedRide.status !== previousStatus) return;\n      if (RIDE_STATUS_ORDER[updatedRide.status] < RIDE_STATUS_ORDER[previousStatus]) return;\n    }\n    lastAcceptedStatusRef.current = updatedRide.status;\n\n    setRide(updatedRide);`,
    );
  }

  if (!next.includes('if (currentRideIdRef.current !== rideId) lastAcceptedStatusRef.current = null;')) {
    next = next.replace(
      '        currentRideIdRef.current = rideId;\n        handleUpdate(data);',
      '        if (currentRideIdRef.current !== rideId) lastAcceptedStatusRef.current = null;\n        currentRideIdRef.current = rideId;\n        handleUpdate(data);',
    );
  }

  // Polling de segurança continua em paralelo ao Realtime. O snapshot já mudou
  // algumas vezes a formatação/condição desse efeito, então removemos somente a
  // guarda isRealtimeConnected quando ela estiver presente e validamos o efeito
  // pelo comportamento estrutural (pollCurrentRide + intervalo), não por whitespace.
  next = next
    .replace(/\n\s*isRealtimeConnected\s*\|\|/g, '')
    .replace(/\[isRealtimeConnected,\s*pollCurrentRide,\s*screenState,\s*userId\]/g, '[pollCurrentRide, screenState, userId]');

  if (!next.includes('await loadRide(currentRideId);')) {
    next = next.replace(
      `        if (!activeRide) {\n          if (!currentRideIdRef.current) {\n            setRide(null);\n            setScreenState(\"idle\");\n            setError(null);\n          }\n          return null;\n        }`,
      `        if (!activeRide) {\n          const currentRideId = currentRideIdRef.current;\n          if (currentRideId) {\n            await loadRide(currentRideId);\n          } else {\n            setRide(null);\n            setScreenState(\"idle\");\n            setError(null);\n          }\n          return null;\n        }`,
    );
  }

  return next;
}, 'Corridas: lifecycle monotônico, polling de segurança e retomada terminal');

patch('.work/corridas/src/hooks/use-push-notifications.tsx', (source) => {
  if (source.includes('VITE_APOIS_SUPERAPP_RIDES_PUSH_ENABLED')) return source;
  return source.replace(
    '  useEffect(() => {\n    let cancelled = false;\n\n    const syncPushSession = async () => {',
    '  useEffect(() => {\n    if (import.meta.env["VITE_APOIS_SUPERAPP_RIDES_PUSH_ENABLED"] !== "1") return;\n\n    let cancelled = false;\n\n    const syncPushSession = async () => {',
  );
}, 'Corridas: Push nativo próprio fica isolado até Firebase unificado ser habilitado');

patch('.work/corridas/src/routes/_authenticated.corrida.$rideId.tsx', (source) => {
  let next = source;

  // Evita que oscilações muito curtas do canal Realtime façam o aviso
  // "Reconectando a corrida" piscar durante a busca por motorista.
  if (!next.includes('APOIS_REALTIME_RECONNECT_GRACE_V1')) {
    next = next
      .replace(
        '  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);',
        '  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);\n  // APOIS_REALTIME_RECONNECT_GRACE_V1\n  const [showReconnectNotice, setShowReconnectNotice] = useState(false);',
      )
      .replace(
        '  useEffect(() => {\n    if (rideId) void loadRide(rideId);\n  }, [rideId, loadRide]);',
        '  useEffect(() => {\n    if (rideId) void loadRide(rideId);\n  }, [rideId, loadRide]);\n\n  useEffect(() => {\n    if (screenState !== "active" || isRealtimeConnected) {\n      setShowReconnectNotice(false);\n      return;\n    }\n\n    const reconnectTimer = window.setTimeout(() => {\n      setShowReconnectNotice(true);\n    }, 4000);\n\n    return () => window.clearTimeout(reconnectTimer);\n  }, [screenState, isRealtimeConnected]);',
      )
      .replace(
        '{screenState === "active" && !isRealtimeConnected && (',
        '{showReconnectNotice && (',
      );
  }

  next = next.replace(
    '                {status === "motorista_a_caminho" && (\n                  <SecurityCodeCard code={ride.security_code} />\n                )}',
    '                {["motorista_a_caminho", "motorista_chegou"].includes(status) && (\n                  <SecurityCodeCard code={ride.security_code} />\n                )}',
  );
  return next;
}, 'Corridas: PIN permanece disponível até o início efetivo da viagem');

patch('.work/corridas/src/components/rides/active/RideStatusHeader.tsx', (source) =>
  source.replace(
    'Confira o veículo e informe o PIN somente no embarque.',
    'Informe o código de segurança ao motorista para iniciar.',
  ),
'Corridas: orientação de chegada usa linguagem direta');

const activeRideSource = readFileSync(resolve(root, '.work/corridas/src/hooks/rides/use-active-ride.tsx'), 'utf8');
for (const marker of [
  'const RIDE_STATUS_ORDER: Record<RideStatus, number>',
  'lastAcceptedStatusRef',
  'await loadRide(currentRideId)',
  'pollCurrentRide',
  'POLLING_INTERVAL_MS',
]) {
  if (!activeRideSource.includes(marker)) throw new Error(`[FAIL] Corridas runtime: ${marker}`);
}
if (/screenState\s*!==\s*["']active["'][\s\S]{0,180}isRealtimeConnected\s*\|\|/.test(activeRideSource)) {
  throw new Error('[FAIL] Corridas: polling de segurança ainda depende de isRealtimeConnected');
}
console.log('[OK] Corridas runtime reconciliado com o snapshot atual');

requireMarkers(
  '.work/corridas/src/routes/_authenticated.corrida.$rideId.tsx',
  [
    'PassengerMap',
    '["motorista_a_caminho", "motorista_chegou"].includes(status)',
    'APOIS_REALTIME_RECONNECT_GRACE_V1',
    'setShowReconnectNotice(true)',
    '}, 4000);',
    '{showReconnectNotice && (',
  ],
  'Corridas usa mapa ativo, PIN do snapshot real e aviso de reconexão sem piscar',
);

console.log('[OK] Corridas: hardening de runtime alinhado ao pin 7b047f75 sem componentes obsoletos');
