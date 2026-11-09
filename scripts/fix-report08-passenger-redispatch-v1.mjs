// Relatorio 08 / INV-057: preserve the original pinned passenger snapshot.
// Apply AFTER harden-corridas-superapp-runtime.mjs and BEFORE the build.
// This script changes only .work/corridas, never sources/ or production.
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const file = resolve(process.env.APOIS_CORRIDAS_WORKSPACE || ".work/corridas", "src/hooks/rides/use-active-ride.tsx");
const original = readFileSync(file, "utf8");
const marker = "APOIS_REPORT08_PASSENGER_REDISPATCH_V1";
const helpers = "// APOIS_REPORT08_PASSENGER_REDISPATCH_V1\n// Authoritative rides.updated_at carries sub-millisecond DB precision; keep\n// microseconds when comparing a Realtime event with a later polling snapshot.\nfunction report08RideVersion(value: string): number | null {\n  const match = /^(\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2})(?:\\.(\\d{1,6}))?(Z|[+-]\\d{2}:\\d{2})$/.exec(value);\n  if (!match) return null;\n  const milliseconds = Date.parse(value);\n  if (!Number.isFinite(milliseconds)) return null;\n  const micro = Number((match[2] ?? \"\").padEnd(6, \"0\"));\n  return milliseconds * 1000 + micro % 1000;\n}\n\nfunction report08RideDecision(\n  previous: ActiveRide | null,\n  incoming: ActiveRide,\n  authoritative: boolean,\n): \"accept\" | \"ignore\" | \"reconcile\" {\n  const nextVersion = report08RideVersion(incoming.updated_at);\n  if (nextVersion === null) return \"ignore\";\n  if (previous === null) return \"accept\";\n  if (previous.id !== incoming.id) return \"ignore\";\n\n  // Never bypass terminal/started-trip guards, even if an old local\n  // snapshot carries a malformed version.\n  if (isTerminalRideStatus(previous.status) && incoming.status !== previous.status) return \"ignore\";\n  if (previous.status === \"em_viagem\" &&\n      [\"agendada\", \"procurar_motorista\", \"motorista_a_caminho\", \"motorista_chegou\"].includes(incoming.status)) {\n    return \"ignore\";\n  }\n  const previousVersion = report08RideVersion(previous.updated_at);\n  if (previousVersion === null) return authoritative ? \"accept\" : \"reconcile\";\n  if (nextVersion < previousVersion) return \"ignore\";\n\n  const oldDriver = previous.driver_id ?? null;\n  const newDriver = incoming.driver_id ?? null;\n  if (nextVersion === previousVersion) {\n    if (previous.status === incoming.status && oldDriver === newDriver) {\n      return authoritative ? \"accept\" : \"ignore\";\n    }\n    // Two distinct states cannot be ordered at the same server version:\n    // fetch a new owner-scoped snapshot rather than guessing.\n    return authoritative ? \"ignore\" : \"reconcile\";\n  }\n\n  const lowerRank = RIDE_STATUS_ORDER[incoming.status] < RIDE_STATUS_ORDER[previous.status];\n  const releasedToSearch =\n    (previous.status === \"motorista_a_caminho\" || previous.status === \"motorista_chegou\") &&\n    incoming.status === \"procurar_motorista\" &&\n    oldDriver !== null && newDriver === null &&\n    !incoming.accepted_at && !incoming.driver_name;\n  // When Realtime misses the intermediate search state, a new assignment can\n  // arrive directly. Its accepted_at must be newer than the previous driver.\n  const previousAcceptedAt = previous.accepted_at ? report08RideVersion(previous.accepted_at) : null;\n  const incomingAcceptedAt = incoming.accepted_at ? report08RideVersion(incoming.accepted_at) : null;\n  const newerAssignment = oldDriver !== null && newDriver !== null &&\n    oldDriver !== newDriver &&\n    (previous.status === \"motorista_a_caminho\" || previous.status === \"motorista_chegou\") &&\n    (incoming.status === \"motorista_a_caminho\" || incoming.status === \"motorista_chegou\") &&\n    previousAcceptedAt !== null && incomingAcceptedAt !== null &&\n    incomingAcceptedAt > previousAcceptedAt;\n\n  if (incoming.status === \"procurar_motorista\" && newDriver !== null) {\n    return authoritative ? \"ignore\" : \"reconcile\";\n  }\n  if ([\"motorista_a_caminho\", \"motorista_chegou\", \"em_viagem\"].includes(incoming.status) &&\n      newDriver === null) {\n    return authoritative ? \"ignore\" : \"reconcile\";\n  }\n  if (lowerRank && !releasedToSearch && !newerAssignment) {\n    return authoritative ? \"ignore\" : \"reconcile\";\n  }\n  if (oldDriver !== null && newDriver !== null && oldDriver !== newDriver && !newerAssignment) {\n    return authoritative ? \"ignore\" : \"reconcile\";\n  }\n  return \"accept\";\n}";
const update = "  const applyAcceptedRide = useCallback((updatedRide: ActiveRide) => {\n    lastAcceptedStatusRef.current = updatedRide.status;\n    lastAcceptedRideRef.current = updatedRide;\n    setRide(updatedRide);\n    setLastUpdateAt(new Date());\n    setError(null);\n\n    if (updatedRide.status === \"finalizada\") {\n      setScreenState(\"completed\");\n      setIsRealtimeConnected(false);\n      void activeRideService.unsubscribe();\n    } else if (updatedRide.status.startsWith(\"cancelada\")) {\n      setScreenState(\"cancelled\");\n      setIsRealtimeConnected(false);\n      void activeRideService.unsubscribe();\n    } else {\n      setScreenState(\"active\");\n    }\n  }, []);\n\n  const handleUpdate = useCallback((updatedRide: ActiveRide, authoritative = false) => {\n    const activeId = currentRideIdRef.current;\n    if (!activeId || updatedRide.id !== activeId) return;\n    const decision = report08RideDecision(lastAcceptedRideRef.current, updatedRide, authoritative);\n    if (decision === \"ignore\") return;\n    if (decision === \"reconcile\") {\n      // Ambiguous Realtime transition: fetch the current owner-scoped row and\n      // validate it as authoritative, not through the same event filter.\n      if (!userId || reconcilePromiseRef.current) return;\n      const requestSequence = requestSequenceRef.current;\n      const pending = activeRideService.getRideById(activeId, userId)\n        .then((snapshot) => {\n          if (currentRideIdRef.current !== activeId || requestSequence !== requestSequenceRef.current) return;\n          if (report08RideDecision(lastAcceptedRideRef.current, snapshot, true) !== \"accept\") return;\n          applyAcceptedRide(snapshot);\n        })\n        .catch((cause) => {\n          console.warn(\"[APOIS Corridas] Redistribuição: reconciliação indisponível\", readErrorMessage(cause));\n        })\n        .finally(() => {\n          if (reconcilePromiseRef.current === pending) reconcilePromiseRef.current = null;\n        });\n      reconcilePromiseRef.current = pending;\n      return;\n    }\n    applyAcceptedRide(updatedRide);\n  }, [applyAcceptedRide, userId]);";
if (original.includes(marker)) {
  for (const token of ["report08RideDecision(", "lastAcceptedRideRef", "reconcilePromiseRef", "applyAcceptedRide(snapshot)", "handleUpdate(latestRide, true)"]) {
    if (!original.includes(token)) throw new Error("[FAIL] INV-057 partial transformation: " + token);
  }
  console.log("[OK] INV-057: patch already applied");
  process.exit(0);
}
if (!original.includes("const RIDE_STATUS_ORDER: Record<RideStatus, number>") ||
    !original.includes("lastAcceptedStatusRef") ||
    !original.includes("RIDE_STATUS_ORDER[updatedRide.status] < RIDE_STATUS_ORDER[previousStatus]")) {
  throw new Error("[FAIL] INV-057 requires the previous runtime hardener");
}
let next = original;
function replaceOnce(from, to, label) {
  const count = next.split(from).length - 1;
  if (count !== 1) throw new Error("[FAIL] INV-057 " + label + " anchors=" + count);
  next = next.replace(from, to);
}
replaceOnce(
  'const isTerminalRideStatus = (status: RideStatus) =>\n  status === "finalizada" || status === "expired" || status.startsWith("cancelada");',
  'const isTerminalRideStatus = (status: RideStatus) =>\n  status === "finalizada" || status === "expired" || status.startsWith("cancelada");\n\n' + helpers,
  "decision policy"
);
replaceOnce(
  '  const lastAcceptedStatusRef = useRef<RideStatus | null>(null);',
  '  const lastAcceptedStatusRef = useRef<RideStatus | null>(null);\n  const lastAcceptedRideRef = useRef<ActiveRide | null>(null);\n  const reconcilePromiseRef = useRef<Promise<void> | null>(null);',
  "ride/version reference"
);
replaceOnce(
  '    lastAcceptedStatusRef.current = null;\n    void activeRideService.unsubscribe();',
  '    lastAcceptedStatusRef.current = null;\n    lastAcceptedRideRef.current = null;\n    reconcilePromiseRef.current = null;\n    void activeRideService.unsubscribe();',
  "clearRide ownership"
);
replaceOnce(
  'if (currentRideIdRef.current !== rideId) lastAcceptedStatusRef.current = null;',
  'if (currentRideIdRef.current !== rideId) {\n          lastAcceptedStatusRef.current = null;\n          lastAcceptedRideRef.current = null;\n          reconcilePromiseRef.current = null;\n        }',
  "switch ride ID"
);
const hookStart = next.indexOf('  const handleUpdate = useCallback((updatedRide: ActiveRide) => {');
const hookEnd = next.indexOf('\n\n  const loadRide = useCallback(',hookStart);
if (hookStart < 0 || hookEnd < 0 ||
    !next.slice(hookStart,hookEnd).includes('const previousStatus = lastAcceptedStatusRef.current;') ||
    !next.slice(hookStart,hookEnd).includes('setScreenState("completed")')) {
  throw new Error("[FAIL] INV-057 previous guard shape changed");
}
next = next.slice(0,hookStart) + update + next.slice(hookEnd);
replaceOnce('        handleUpdate(data);','        handleUpdate(data, true);',"loaded DB snapshot");
replaceOnce('        handleUpdate(latestRide);','        handleUpdate(latestRide, true);',"polled DB snapshot");
replaceOnce('          handleUpdate(activeRide);','          handleUpdate(activeRide, true);',"recovered DB snapshot");
if (!next.includes(marker) || !next.includes('const previousAcceptedAt') ||
    next.includes('RIDE_STATUS_ORDER[updatedRide.status] < RIDE_STATUS_ORDER[previousStatus]')) {
  throw new Error("[FAIL] INV-057 incomplete active-ride replacement");
}
writeFileSync(file, next, "utf8");
console.log("[OK] INV-057: newer, authenticated search/driver cycles allowed; stale/terminal/foreign events rejected");
