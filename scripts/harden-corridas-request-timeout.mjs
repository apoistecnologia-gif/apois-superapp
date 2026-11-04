import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const path = resolve('.work/corridas/src/hooks/rides/use-ride-request.tsx');
let source = readFileSync(path, 'utf8');

const marker = 'APOIS_REQUEST_RIDE_TIMEOUT_V1';
if (!source.includes(marker)) {
  const importAnchor = 'interface RideRequestContextType {';
  if (!source.includes(importAnchor)) {
    throw new Error('[FAIL] Corridas request timeout: âncora do hook não encontrada');
  }

  const helper = `// APOIS_REQUEST_RIDE_TIMEOUT_V1
const REQUEST_RIDE_TIMEOUT_MS = 20_000;

async function invokeRequestRideWithTimeout(body: object) {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  try {
    const timeout = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error("request_timeout")), REQUEST_RIDE_TIMEOUT_MS);
    });
    return await Promise.race([
      supabase.functions.invoke("request-ride", { body }),
      timeout,
    ]);
  } finally {
    if (timeoutId !== null) clearTimeout(timeoutId);
  }
}

`;
  source = source.replace(importAnchor, helper + importAnchor);

  source = source.replaceAll(
    'supabase.functions.invoke("request-ride", {\n          body: payload,\n        })',
    'invokeRequestRideWithTimeout(payload)',
  );
  source = source.replaceAll(
    'supabase.functions.invoke("request-ride", {\n      body: { action: "cancel", ride_id: rideId },\n    })',
    'invokeRequestRideWithTimeout({ action: "cancel", ride_id: rideId })',
  );

  source = source.replace(
    'const message = readErrorMessage(error, "Erro ao processar sua solicitação.");',
    'const message = error instanceof Error && error.message === "request_timeout"\n          ? "A solicitação demorou mais que o esperado. Verifique sua conexão e tente novamente."\n          : readErrorMessage(error, "Erro ao processar sua solicitação.");',
  );
}

for (const required of [
  marker,
  'REQUEST_RIDE_TIMEOUT_MS = 20_000',
  'Promise.race([',
  'invokeRequestRideWithTimeout(payload)',
  'request_timeout',
  'A solicitação demorou mais que o esperado.',
]) {
  if (!source.includes(required)) {
    throw new Error('[FAIL] Corridas request timeout incompleto: ' + required);
  }
}

writeFileSync(path, source, 'utf8');
console.log('[OK] Corridas: solicitar/cancelar corrida possui timeout explícito e continua idempotente pelo request_key.');
