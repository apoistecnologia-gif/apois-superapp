import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const target = resolve(root, '.work/corridas/src/hooks/rides/use-ride-request.tsx');

function replaceRequired(search, replacement, label) {
  const before = readFileSync(target, 'utf8');
  if (!before.includes(search)) {
    console.error(`[FAIL] ${label}: padrão esperado não encontrado em ${target}`);
    process.exit(1);
  }
  writeFileSync(target, before.replace(search, replacement));
  console.log(`[OK] ${label}`);
}

replaceRequired(
  `function friendlyCancellationError(error: unknown): string {
  const raw = readErrorMessage(error, "Não foi possível cancelar a corrida.");`,
  `async function cancellationFunctionError(error: unknown): Promise<Error> {
  const context = isRecord(error) ? error["context"] : null;

  if (context instanceof Response) {
    try {
      const payload = await context.clone().json();
      if (isRecord(payload)) {
        const serverMessage =
          typeof payload["message"] === "string" && payload["message"].trim()
            ? payload["message"].trim()
            : typeof payload["error_code"] === "string" && payload["error_code"].trim()
              ? payload["error_code"].trim()
              : null;
        if (serverMessage) return new Error(friendlyCancellationError(new Error(serverMessage)));
      }
    } catch {
      // Se o corpo não puder ser lido, mantemos o fallback abaixo.
    }
  }

  return new Error(friendlyCancellationError(error));
}

function friendlyCancellationError(error: unknown): string {
  const raw = readErrorMessage(error, "Não foi possível cancelar a corrida.");`,
  'corridas: interpreta mensagem JSON da Edge Function no cancelamento',
);

replaceRequired(
  `      if (error) throw new Error(friendlyCancellationError(error));`,
  `      if (error) throw await cancellationFunctionError(error);`,
  'corridas: modal não exibe mais Edge Function returned a non-2xx status code',
);

console.log('[OK] corridas: tratamento de erro de cancelamento endurecido apenas em .work');
