import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const workspace = resolve('.work/corridas');
const migration = resolve(workspace, 'supabase/migrations/20260806000000_clean_baseline.sql');

if (!existsSync(migration)) {
  console.error('[FAIL] Corridas clean-room: execute prepare-workspace.mjs corridas antes deste script.');
  process.exit(1);
}

let source = readFileSync(migration, 'utf8');
const broken = '    scheduled_for TIMESTAMPTZ,\n    rejected_driver_ids UUID[]\n    accepted_at TIMESTAMPTZ,';
const repaired = '    scheduled_for TIMESTAMPTZ,\n    rejected_driver_ids UUID[],\n    accepted_at TIMESTAMPTZ,';

if (source.includes(broken)) {
  source = source.replace(broken, repaired);
  writeFileSync(migration, source, 'utf8');
  console.log('[OK] Corridas clean-room: vírgula ausente no baseline histórico reparada somente em .work.');
} else if (source.includes(repaired)) {
  console.log('[OK] Corridas clean-room: compatibilidade do baseline histórico já aplicada em .work.');
} else {
  console.error('[FAIL] Corridas clean-room: região rejected_driver_ids não corresponde ao pin esperado.');
  process.exit(1);
}

if (readFileSync(migration, 'utf8').includes(broken)) {
  console.error('[FAIL] Corridas clean-room: baseline histórico continua sintaticamente quebrado.');
  process.exit(1);
}

console.log('[INFO] Este reparo NÃO altera a migration protegida nem prova clean-room PASS.');
console.log('[INFO] O próximo passo continua sendo executar a cadeia completa em PostgreSQL/Supabase descartável.');
