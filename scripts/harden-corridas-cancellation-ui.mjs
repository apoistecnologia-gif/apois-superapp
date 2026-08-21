import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const path = resolve('.work/corridas/src/services/rides/active-ride-service.ts');
const before = readFileSync(path, 'utf8');
const search = '      canCancel: ["aguardando_pagamento", "procurar_motorista", "motorista_a_caminho"].includes(status),';
const replacement = '      canCancel: ["aguardando_pagamento", "procurar_motorista", "motorista_a_caminho", "motorista_chegou"].includes(status),';
if (before.includes(replacement)) {
  console.log('[OK] Corridas: cancelamento visual já acompanha a regra até motorista_chegou');
} else if (!before.includes(search)) {
  console.error('[FAIL] Corridas: regra visual de cancelamento mudou no snapshot protegido');
  process.exit(1);
} else {
  writeFileSync(path, before.replace(search, replacement), 'utf8');
  console.log('[OK] Corridas: botão Cancelar permanece até motorista_chegou e some em em_viagem');
}
