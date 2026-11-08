// APOIS_PARTNER_COURIER_BLOCK_DEDUP_V1
//
// Defeito real: vários hardeners do Entregador ancoram em trechos que eles
// mesmos inserem (`stopCourierNativeLocation`, blocos de permissão de GPS,
// guardas de histórico). Reaplicar o pipeline prependia uma cópia a cada
// execução, e o `courier.tsx` crescia de forma não determinística.
//
// Este hardener roda por último e remove blocos idênticos consecutivos,
// preservando a ordem e o comportamento. É idempotente por construção: rodar
// duas vezes produz o mesmo arquivo.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.env.APOIS_ENTREGAS_WORKSPACE || '.work/partner-entregador';
const targets = [
  'src/routes/courier.tsx',
  'src/components/CourierLocationTracker.tsx',
];

let totalRemoved = 0;
for (const relative of targets) {
  const file = resolve(root, relative);
  const source = readFileSync(file, 'utf8');
  const lines = source.split('\n');
  const kept = [];
  let removed = 0;
  for (const line of lines) {
    // Duplicata exata e consecutiva da linha anterior: remove.
    if (kept.length && kept[kept.length - 1] === line && line.trim().length > 0) {
      removed += 1;
      continue;
    }
    kept.push(line);
  }
  if (removed > 0) {
    writeFileSync(file, kept.join('\n'), 'utf8');
    totalRemoved += removed;
    console.log(`[OK] Entregador Parceiro: ${removed} linha(s) duplicada(s) removida(s) em ${relative}`);
  }
}

// Contrato: nenhuma chamada de parada repetida em sequência.
const failures = [];
for (const relative of targets) {
  const source = readFileSync(resolve(root, relative), 'utf8');
  if (/stopCourierNativeLocation\(\)\.catch\(\(\) => undefined\);\n\s*await stopCourierNativeLocation\(\)\.catch\(\(\) => undefined\);/.test(source)) {
    failures.push(`${relative}: stopCourierNativeLocation duplicado em sequência`);
  }
}
if (failures.length) {
  console.error('[FAIL] Entregador Parceiro: blocos duplicados permanecem:');
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log(`[OK] Entregador Parceiro: blocos duplicados removidos (${totalRemoved} linha(s)); pipeline determinístico.`);
