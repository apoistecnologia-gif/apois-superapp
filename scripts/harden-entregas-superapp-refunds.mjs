import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const workspace = resolve('.work/entregas');
const files = [
  'src/routes/pedido/$orderId/index.tsx',
  'src/components/MerchantOrderControlCenter.tsx',
  'src/routes/merchant.tsx',
  'src/routes/admin.tsx',
];

let replacements = 0;
for (const relativePath of files) {
  const path = resolve(workspace, relativePath);
  const before = readFileSync(path, 'utf8');
  const legacy = 'supabase.functions.invoke("process-refund"';
  const hardened = 'supabase.functions.invoke("process-superapp-refund"';

  if (before.includes(hardened)) {
    console.log(`[OK] Entregas: ${relativePath} já usa estorno compatível com o Superapp`);
    continue;
  }
  if (!before.includes(legacy)) {
    console.log(`[INFO] Entregas: ${relativePath} não possui chamada direta de estorno`);
    continue;
  }

  const after = before.split(legacy).join(hardened);
  replacements += (before.match(/supabase\.functions\.invoke\("process-refund"/g) ?? []).length;
  writeFileSync(path, after, 'utf8');
  console.log(`[OK] Entregas: ${relativePath} usa process-superapp-refund`);
}

if (replacements === 0) {
  const alreadyHardened = files.some((relativePath) =>
    readFileSync(resolve(workspace, relativePath), 'utf8').includes(
      'supabase.functions.invoke("process-superapp-refund"',
    ),
  );
  if (!alreadyHardened) {
    console.error('[FAIL] Entregas: nenhuma chamada de estorno conhecida foi encontrada');
    process.exit(1);
  }
}

console.log(`[OK] Entregas: fluxo de estorno do Superapp protegido (${replacements} chamada(s) ajustada(s))`);
