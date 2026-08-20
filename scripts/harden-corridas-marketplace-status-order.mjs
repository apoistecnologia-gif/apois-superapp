import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const path = resolve(root, '.work/corridas/src/hooks/rides/use-active-ride.tsx');
const before = readFileSync(path, 'utf8');

const wrong = `const RIDE_STATUS_ORDER: Record<RideStatus, number> = {
  agendada: 0,
  aguardando_pagamento: 1,
  procurar_motorista: 2,
  motorista_a_caminho: 3,
  motorista_chegou: 4,
  em_viagem: 5,
  finalizada: 6,
  cancelada_passageiro: 6,
  cancelada_motorista: 6,
  expired: 6,
};`;

const correct = `const RIDE_STATUS_ORDER: Record<RideStatus, number> = {
  agendada: 0,
  procurar_motorista: 1,
  aguardando_pagamento: 2,
  motorista_a_caminho: 3,
  motorista_chegou: 4,
  em_viagem: 5,
  finalizada: 6,
  cancelada_passageiro: 6,
  cancelada_motorista: 6,
  expired: 6,
};`;

if (before.includes(correct)) {
  console.log('[OK] corridas: ordem marketplace pós-aceite já está correta');
  process.exit(0);
}

if (!before.includes(wrong)) {
  console.error('[FAIL] corridas: bloco RIDE_STATUS_ORDER esperado não encontrado');
  process.exit(1);
}

writeFileSync(path, before.replace(wrong, correct));
console.log('[OK] corridas: procurar_motorista -> aguardando_pagamento agora é transição progressiva');
