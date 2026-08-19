import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const target = resolve('.work/entregas/src/lib/lovable-error-reporting.ts');
if (!existsSync(target)) {
  console.error('[FAIL] Entregas: módulo de diagnóstico legado não encontrado no snapshot esperado');
  process.exit(1);
}

const before = readFileSync(target, 'utf8');
const expectedMarkers = ['__lovableEvents', '__lovableReportRuntimeError', 'reportLovableError'];
const missing = expectedMarkers.filter((marker) => !before.includes(marker));
if (missing.length) {
  console.error(`[FAIL] Entregas: diagnóstico legado mudou no snapshot protegido: ${missing.join(', ')}`);
  process.exit(1);
}

const replacement = `export function reportLovableError(\n  error: unknown,\n  context: Record<string, unknown> = {},\n) {\n  // O Superapp não usa hooks/telemetria do editor Lovable. O ErrorBoundary continua\n  // exibindo recuperação ao usuário e registramos somente diagnóstico local, sem\n  // enviar rota, stack ou dados do usuário a integrações de editor antigas.\n  if (typeof console === \"undefined\") return;\n  console.error(\"[APOIS Superapp] erro capturado pelo boundary\", {\n    message: error instanceof Error ? error.message : String(error),\n    ...context,\n  });\n}\n`;

writeFileSync(target, replacement, 'utf8');
console.log('[OK] Entregas: telemetria do editor legado neutralizada apenas na cópia .work do Superapp');
