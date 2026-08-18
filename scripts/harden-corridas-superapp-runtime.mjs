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
  'const POLLING_INTERVAL_MS = 12_000;\n',
  'const POLLING_INTERVAL_MS = 12_000;\n\nconst RIDE_STATUS_ORDER: Record<RideStatus, number> = {\n  agendada: 0,\n  procurar_motorista: 1,\n  motorista_a_caminho: 2,\n  motorista_chegou: 3,\n  em_viagem: 4,\n  finalizada: 5,\n  cancelada_passageiro: 5,\n  cancelada_motorista: 5,\n};\n\nconst isTerminalRideStatus = (status: RideStatus) =>\n  status === "finalizada" || status.startsWith("cancelada");\n',
  'corridas: define ordem monotônica dos estados da corrida',
);

replaceRequired(
  '.work/corridas/src/hooks/rides/use-active-ride.tsx',
  '  const pollingPromiseRef = useRef<Promise<void> | null>(null);\n',
  '  const pollingPromiseRef = useRef<Promise<void> | null>(null);\n  const lastAcceptedStatusRef = useRef<RideStatus | null>(null);\n',
  'corridas: guarda último estado aceito da corrida',
);

replaceRequired(
  '.work/corridas/src/hooks/rides/use-active-ride.tsx',
  '    pollingPromiseRef.current = null;\n    void activeRideService.unsubscribe();',
  '    pollingPromiseRef.current = null;\n    lastAcceptedStatusRef.current = null;\n    void activeRideService.unsubscribe();',
  'corridas: reset também limpa estado monotônico',
);

replaceRequired(
  '.work/corridas/src/hooks/rides/use-active-ride.tsx',
  '  const handleUpdate = useCallback((updatedRide: ActiveRide) => {\n    if (currentRideIdRef.current && updatedRide.id !== currentRideIdRef.current) return;\n\n    setRide(updatedRide);',
  '  const handleUpdate = useCallback((updatedRide: ActiveRide) => {\n    if (currentRideIdRef.current && updatedRide.id !== currentRideIdRef.current) return;\n\n    const previousStatus = lastAcceptedStatusRef.current;\n    if (previousStatus) {\n      if (isTerminalRideStatus(previousStatus) && updatedRide.status !== previousStatus) return;\n      if (RIDE_STATUS_ORDER[updatedRide.status] < RIDE_STATUS_ORDER[previousStatus]) return;\n    }\n    lastAcceptedStatusRef.current = updatedRide.status;\n\n    setRide(updatedRide);',
  'corridas: Realtime/polling não podem regredir estado da corrida',
);

replaceRequired(
  '.work/corridas/src/hooks/use-push-notifications.tsx',
  '  useEffect(() => {\n    if (authState !== "authenticated" || !user?.id) return;',
  '  useEffect(() => {\n    if (import.meta.env["VITE_APOIS_SUPERAPP_RIDES_PUSH_ENABLED"] !== "1") return;\n    if (authState !== "authenticated" || !user?.id) return;',
  'corridas: FCM próprio fica isolado até projeto Firebase unificado estar compatível',
);

replaceRequired(
  '.work/corridas/src/routes/_authenticated.corrida.$rideId.tsx',
  '                {status === "motorista_a_caminho" && (\n                  <SecurityCodeCard code={ride.security_code} />\n                )}',
  '                {["motorista_a_caminho", "motorista_chegou"].includes(status) && (\n                  <SecurityCodeCard code={ride.security_code} />\n                )}',
  'corridas: PIN permanece visível até o motorista iniciar a viagem',
);

replaceRequired(
  '.work/corridas/src/components/rides/active/RideStatusHeader.tsx',
  '          subtitle: "Dirija-se ao local de embarque",',
  '          subtitle: "Informe o código de segurança ao motorista para iniciar",',
  'corridas: chegada orienta passageiro a informar o PIN',
);

console.log('[OK] corridas: runtime do Superapp endurecido sem alterar o app original');
