import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

function requireSnapshotFile(path, markers, label) {
  const target = resolve(path);
  if (!existsSync(target)) {
    console.error(`[FAIL] Entregas: ${label} não encontrado no snapshot esperado`);
    process.exit(1);
  }
  const before = readFileSync(target, 'utf8');
  const missing = markers.filter((marker) => !before.includes(marker));
  if (missing.length) {
    console.error(`[FAIL] Entregas: ${label} mudou na cópia adaptada: ${missing.join(', ')}`);
    process.exit(1);
  }
  return { target, before };
}

const telemetry = requireSnapshotFile(
  '.work/entregas/src/lib/lovable-error-reporting.ts',
  ['__lovableEvents', '__lovableReportRuntimeError', 'reportLovableError'],
  'diagnóstico legado',
);

const telemetryReplacement = `export function reportLovableError(\n  error: unknown,\n  context: Record<string, unknown> = {},\n) {\n  // O Superapp não usa hooks/telemetria do editor Lovable. O ErrorBoundary continua\n  // exibindo recuperação ao usuário e registramos somente diagnóstico local, sem\n  // enviar rota, stack ou dados do usuário a integrações de editor antigas.\n  if (typeof console === \"undefined\") return;\n  console.error(\"[APOIS Superapp] erro capturado pelo boundary\", {\n    message: error instanceof Error ? error.message : String(error),\n    ...context,\n  });\n}\n`;
writeFileSync(telemetry.target, telemetryReplacement, 'utf8');
console.log('[OK] Entregas: telemetria do editor legado neutralizada apenas na cópia .work do Superapp');

const splash = requireSnapshotFile(
  '.work/entregas/src/components/ApoisLaunchSplash.tsx',
  ['const SPLASH_MS = 1900;', 'src="./apois-app-icon.png"', 'export function ApoisLaunchSplash()'],
  'splash React legado já adaptado para caminho relativo',
);

// O APK já exibe a splash nativa e em seguida o shell único da APOIS. Ao entrar
// em Entregas não deve aparecer uma segunda splash de quase dois segundos. A
// exportação é preservada para que o Root continue estável sem animação duplicada.
const splashReplacement = `export function ApoisLaunchSplash() {\n  return null;\n}\n`;
writeFileSync(splash.target, splashReplacement, 'utf8');
console.log('[OK] Entregas: splash duplicada removida dentro do módulo do Superapp');

const landing = requireSnapshotFile(
  '.work/entregas/src/routes/index.tsx',
  ['src="./apois-logo.svg"', 'alt="APOIS Entregas"'],
  'logo relativo da landing do cliente',
);
writeFileSync(landing.target, landing.before, 'utf8');
console.log('[OK] Entregas: logo pública permanece relativa ao módulo aninhado');

await import('./normalize-entregas-merchant-mp-handoff.mjs');
await import('./harden-entregas-merchant-mercadopago-v2.mjs');
await import('./harden-entregas-delivery-readiness.mjs');
await import('./harden-entregas-merchant-direct-finance.mjs');
await import('./harden-entregas-superapp-refunds.mjs');
await import('./harden-entregas-merchant-map-runtime.mjs');
await import('./harden-entregas-merchant-order-controls.mjs');
