import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const path = '.work/corridas/src/hooks/rides/use-active-ride.tsx';
const full = resolve(root, path);
let source = readFileSync(full, 'utf8');

const passengerDeclaration = '  const passengerId = profile?.id ?? null;\n';
const compatibilityDeclaration = '  const passengerId = profile?.id ?? null;\n  const userId = passengerId;\n';
const passengerGuard = '      !passengerId ||\n      screenState !== "active" ||\n      isRealtimeConnected ||\n      !currentRideIdRef.current';
const legacyGuard = '      !userId ||\n      screenState !== "active" ||\n      isRealtimeConnected ||\n      !currentRideIdRef.current';

if (source.includes(legacyGuard)) {
  console.log('[OK] corridas: fonte já está compatível com o adaptador legado');
  process.exit(0);
}

if (!source.includes(passengerDeclaration) || !source.includes(passengerGuard)) {
  console.error(`[FAIL] corridas: formato inesperado em ${path}; não foi possível normalizar sem tocar no app original`);
  process.exit(1);
}

source = source
  .replace(passengerDeclaration, compatibilityDeclaration)
  .replace(passengerGuard, legacyGuard);

writeFileSync(full, source);
console.log('[OK] corridas: drift do snapshot normalizado apenas dentro de .work para adaptação do Superapp');
