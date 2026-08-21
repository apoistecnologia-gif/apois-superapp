import './harden-motorista-route-integrity.mjs';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const workspace = process.env.APOIS_MOTORISTA_WORKSPACE || '.work/motorista-test';

function patch(relativePath, transform, verify, label) {
  const path = resolve(root, workspace, relativePath);
  const before = readFileSync(path, 'utf8');
  const after = transform(before);
  if (!verify(after)) throw new Error(`[FAIL] ${label}: contrato esperado não encontrado em ${relativePath}`);
  if (after !== before) writeFileSync(path, after, 'utf8');
  console.log(`[OK] ${label}${after === before ? ' (já aplicado)' : ''}`);
}

patch(
  'src/lib/driverRideLifecycle.mobile.ts',
  (source) => {
    if (source.includes('readableFunctionInvokeError')) return source;

    let next = source.replace(
      'async function callRpc<T = unknown>(name: string, args: Record<string, unknown>) {',
      `async function readableFunctionInvokeError(error: unknown): Promise<string> {\n  const record = error && typeof error === "object" ? error as Record<string, unknown> : null;\n  const context = record?.context;\n  if (typeof Response !== "undefined" && context instanceof Response) {\n    try {\n      const payload = await context.clone().json() as Record<string, unknown>;\n      const serverCode = String(payload.error ?? payload.error_code ?? payload.message ?? "").trim();\n      if (serverCode) return readableDriverRpcError(serverCode);\n    } catch { /* usa fallback abaixo */ }\n  }\n  const message = error instanceof Error ? error.message : String(error ?? "driver_operation_failed");\n  return readableDriverRpcError(message);\n}\n\nasync function callRpc<T = unknown>(name: string, args: Record<string, unknown>) {`,
    );

    next = next.replace(
      '  if (error) throw new Error(readableDriverRpcError(error.message));\n  const result = (response ?? {}) as DriverRedispatchResponse;',
      '  if (error) throw new Error(await readableFunctionInvokeError(error));\n  const result = (response ?? {}) as DriverRedispatchResponse;',
    );

    return next;
  },
  (source) => source.includes('async function readableFunctionInvokeError') && source.includes('await readableFunctionInvokeError(error)'),
  'motorista: Edge Function devolve motivo legível para o app',
);

patch(
  'src/routes/motorista.app.tsx',
  (source) => {
    const oldBlock = `  const handleComplete = async () => {\n    if (busy) return;\n    setBusy(true);\n    try {\n      await onComplete();\n    } finally {\n      setBusy(false);\n    }\n  };`;
    const newBlock = `  const handleComplete = async () => {\n    if (busy) return;\n    setBusy(true);\n    try {\n      await onComplete();\n    } catch (error) {\n      const message = error instanceof Error ? error.message : "Não foi possível finalizar a corrida.";\n      toast.error(message);\n    } finally {\n      setBusy(false);\n    }\n  };`;

    if (source.includes(newBlock)) return source;
    if (!source.includes(oldBlock)) throw new Error('handleComplete do overlay não encontrado');
    return source.replace(oldBlock, newBlock);
  },
  (source) => source.includes('toast.error(message);') && source.includes('Não foi possível finalizar a corrida.'),
  'motorista: botão Finalizar corrida mostra erro em vez de parecer travado',
);

console.log(`[OK] feedback de finalização reforçado em ${workspace}`);
