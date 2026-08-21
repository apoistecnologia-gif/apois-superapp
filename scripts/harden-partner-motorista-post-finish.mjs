import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const workspace = process.env.APOIS_MOTORISTA_WORKSPACE || '.work/partner-motorista';
const path = resolve(root, workspace, 'src/routes/motorista.app.tsx');
let source = readFileSync(path, 'utf8');

const replacements = [
  [`await callComplete({ data: {\n              rideId: active.id,\n            } });`, `const completedRide = await callComplete({ data: {\n              rideId: active.id,\n            } }) as RideRow;\n            // Não dependa do eco do Realtime para sair da corrida finalizada.\n            setActive(null);\n            setPolyline([]);\n            if (!ratedRidesRef.current.has(completedRide.id) && !completedRide.driver_rated_at) {\n              setRatingRide(completedRide);\n              setStars(5);\n              setRatingComment(\"\");\n              setRatingSubmitted(false);\n              setRatingError(null);\n            }\n            if (driverId) void loadTodayStats(driverId);\n            window.dispatchEvent(new CustomEvent(\"apois:driver-push\", { detail: { ride_id: completedRide.id, event: \"ride.completed\" } }));`],
  [`await callComplete({ data: {\n                rideId: active.id,\n              } });`, `const completedRide = await callComplete({ data: {\n                rideId: active.id,\n              } }) as RideRow;\n              setActive(null);\n              setPolyline([]);\n              if (!ratedRidesRef.current.has(completedRide.id) && !completedRide.driver_rated_at) {\n                setRatingRide(completedRide);\n                setStars(5);\n                setRatingComment(\"\");\n                setRatingSubmitted(false);\n                setRatingError(null);\n              }\n              if (driverId) void loadTodayStats(driverId);\n              window.dispatchEvent(new CustomEvent(\"apois:driver-push\", { detail: { ride_id: completedRide.id, event: \"ride.completed\" } }));`],
];

let changed = 0;
for (const [before, after] of replacements) {
  if (source.includes(before)) {
    source = source.replaceAll(before, after);
    changed += 1;
  }
}

for (const marker of [
  'const completedRide = await callComplete',
  'setActive(null);',
  'setRatingRide(completedRide);',
  'event: "ride.completed"',
  'window.dispatchEvent(new CustomEvent("apois:driver-push"',
]) {
  if (!source.includes(marker)) throw new Error(`Motorista Parceiro: pós-finalização incompleta (${marker}).`);
}
if (changed === 0 && !source.includes('setRatingRide(completedRide);')) {
  throw new Error('Motorista Parceiro: chamadas de finalização não foram encontradas para hardening.');
}

writeFileSync(path, source, 'utf8');
console.log('[OK] Motorista Parceiro: finalização limpa a corrida imediatamente, abre avaliação e força ressincronização da próxima corrida sem esperar Realtime.');
