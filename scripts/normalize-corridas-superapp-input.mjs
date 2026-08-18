import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const path = 'scripts/adapt-module-for-superapp.mjs';
const full = resolve(root, path);
let source = readFileSync(full, 'utf8');

const legacySearch = '      !userId ||\\n      screenState !== "active" ||\\n      isRealtimeConnected ||\\n      !currentRideIdRef.current';
const currentSearch = '      !passengerId ||\\n      screenState !== "active" ||\\n      isRealtimeConnected ||\\n      !currentRideIdRef.current';
const legacyReplacement = '      !userId ||\\n      screenState !== "active" ||\\n      !currentRideIdRef.current';
const currentReplacement = '      !passengerId ||\\n      screenState !== "active" ||\\n      !currentRideIdRef.current';

if (source.includes(currentSearch) && source.includes(currentReplacement)) {
  console.log('[OK] corridas: adaptador já acompanha passengerId do snapshot atual');
  process.exit(0);
}

if (!source.includes(legacySearch) || !source.includes(legacyReplacement)) {
  console.error(`[FAIL] corridas: formato inesperado em ${path}; drift não pode ser normalizado com segurança`);
  process.exit(1);
}

source = source
  .replace(legacySearch, currentSearch)
  .replace(legacyReplacement, currentReplacement);

writeFileSync(full, source);
console.log('[OK] corridas: adaptador normalizado para passengerId antes de preparar .work');
