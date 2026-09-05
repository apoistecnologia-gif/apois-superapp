import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const workspace = resolve(root, '.work/corridas');

function patch(relativePath, transform, verify, label) {
  const path = resolve(workspace, relativePath);
  if (!existsSync(path)) throw new Error(`[FAIL] ${label}: arquivo ausente ${relativePath}`);
  const before = readFileSync(path, 'utf8');
  const after = transform(before);
  if (!verify(after)) throw new Error(`[FAIL] ${label}: contrato final não confirmado em ${relativePath}`);
  if (after !== before) writeFileSync(path, after, 'utf8');
  console.log(`[OK] ${label}${after === before ? ' (já aplicado)' : ''}`);
}

patch(
  'supabase/functions/request-ride/index.ts',
  (source) => {
    let next = source;

    if (!next.includes('const DISPATCH_FAILURE_REASON =')) {
      const marker = 'async function handleRequest(req: Request): Promise<Response> {';
      if (!next.includes(marker)) throw new Error('[FAIL] request-ride: handleRequest não encontrado');
      const helper = `const DISPATCH_FAILURE_REASON = "Falha interna ao iniciar busca por motorista.";\n\nasync function rollbackFailedDispatch(\n  admin: any,\n  rideId: string,\n  passengerId: string,\n): Promise<boolean> {\n  const now = new Date().toISOString();\n  const { data, error } = await admin\n    .from("rides")\n    .update({\n      status: "cancelada_passageiro",\n      cancelled_at: now,\n      cancelled_by: null,\n      cancellation_reason: DISPATCH_FAILURE_REASON,\n      candidate_driver_ids: [],\n      offered_driver_ids: [],\n      current_offer_driver_id: null,\n      request_expires_at: null,\n      // A operação falhou antes de ser entregue ao cliente. Liberar a chave permite\n      // retry idempotente do MESMO request_key sem apagar o registro de auditoria.\n      request_key: null,\n    })\n    .eq("id", rideId)\n    .eq("passenger_id", passengerId)\n    .eq("status", "procurar_motorista")\n    .is("driver_id", null)\n    .is("accepted_driver_id", null)\n    .select("id")\n    .maybeSingle();\n\n  if (error) throw new Error(\`dispatch_rollback_failed:\${error.message}\`);\n  return Boolean(data?.id);\n}\n\n`;
      next = next.replace(marker, helper + marker);
    }

    const oldDispatch = `    let candidateIds: string[] = [];\n    if (!scheduledFor) {\n      try {\n        candidateIds = await dispatch(admin, ride);\n        EdgeRuntime.waitUntil(\n          notifyCandidates(ride, candidateIds).catch((pushError) =>\n            console.error("[request-ride] push failed", pushError),\n          ),\n        );\n      } catch (dispatchError) {\n        console.error("[request-ride] dispatch failed", dispatchError);\n      }\n    }`;

    const newDispatch = `    let candidateIds: string[] = [];\n    if (!scheduledFor) {\n      try {\n        candidateIds = await dispatch(admin, ride);\n        EdgeRuntime.waitUntil(\n          notifyCandidates(ride, candidateIds).catch((pushError) =>\n            console.error("[request-ride] push failed", pushError),\n          ),\n        );\n      } catch (dispatchError) {\n        console.error("[request-ride] dispatch failed", {\n          rideId: ride.id,\n          error: dispatchError instanceof Error ? dispatchError.message : String(dispatchError),\n        });\n\n        try {\n          const rolledBack = await rollbackFailedDispatch(admin, String(ride.id), userId);\n          if (rolledBack) {\n            return json(\n              {\n                ok: false,\n                error_code: "dispatch_failed",\n                message: "Não foi possível iniciar a busca por motorista. Tente novamente.",\n              },\n              503,\n            );\n          }\n        } catch (rollbackError) {\n          console.error("[request-ride] dispatch rollback failed", {\n            rideId: ride.id,\n            error: rollbackError instanceof Error ? rollbackError.message : String(rollbackError),\n          });\n          return json(\n            {\n              ok: false,\n              error_code: "dispatch_cleanup_failed",\n              message: "Não foi possível confirmar a busca por motorista. Atualize a corrida antes de tentar novamente.",\n            },\n            500,\n          );\n        }\n\n        // O cleanup condicional não pode sobrescrever uma corrida que avançou\n        // concorrentemente. Se um motorista venceu a corrida antes do rollback,\n        // devolvemos o estado real já persistido em vez de cancelar ou fingir falha.\n        const { data: advancedRide, error: advancedRideError } = await admin\n          .from("rides")\n          .select("id,status,estimated_price,scheduled_for,driver_id,accepted_driver_id")\n          .eq("id", ride.id)\n          .eq("passenger_id", userId)\n          .maybeSingle();\n        if (advancedRideError) {\n          return json({ ok: false, error_code: "dispatch_state_lookup_failed" }, 500);\n        }\n        if (\n          advancedRide &&\n          (advancedRide.status !== "procurar_motorista" ||\n            advancedRide.driver_id ||\n            advancedRide.accepted_driver_id)\n        ) {\n          return json({\n            ok: true,\n            reused: true,\n            rideId: advancedRide.id,\n            status: advancedRide.status,\n            scheduled_for: advancedRide.scheduled_for ?? null,\n            estimated_price: advancedRide.estimated_price ?? null,\n          });\n        }\n\n        return json(\n          {\n            ok: false,\n            error_code: "dispatch_state_uncertain",\n            message: "Não foi possível confirmar a busca por motorista. Atualize a corrida antes de tentar novamente.",\n          },\n          503,\n        );\n      }\n    }`;

    if (next.includes(oldDispatch)) next = next.replace(oldDispatch, newDispatch);

    return next;
  },
  (source) =>
    source.includes('const DISPATCH_FAILURE_REASON = "Falha interna ao iniciar busca por motorista.";') &&
    source.includes('async function rollbackFailedDispatch(') &&
    source.includes('request_key: null') &&
    source.includes('.eq("status", "procurar_motorista")') &&
    source.includes('.is("driver_id", null)') &&
    source.includes('.is("accepted_driver_id", null)') &&
    source.includes('error_code: "dispatch_failed"') &&
    source.includes('error_code: "dispatch_cleanup_failed"') &&
    source.includes('error_code: "dispatch_state_uncertain"') &&
    source.includes('const rolledBack = await rollbackFailedDispatch(admin, String(ride.id), userId);') &&
    !source.includes('console.error("[request-ride] dispatch failed", dispatchError);'),
  'Corridas request-ride: falha de dispatch faz rollback lógico condicional e libera retry idempotente',
);

patch(
  'supabase/functions/driver-ride-action/index.ts',
  (source) => {
    let next = source;

    next = next.replace(
      `function finitePositive(value: unknown): number | null {\n  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;\n}\n\n`,
      '',
    );

    next = next.replace(
      `    const requestedFinalPrice = finitePositive(body.final_price);\n    const finalPrice = requestedFinalPrice ?? Number(ride.estimated_price ?? 0);`,
      `    // O motorista não é autoridade para definir preço. A API usa somente valor\n    // previamente persistido pelo backend; o trigger de banco reforça a mesma regra.\n    const finalPrice = Number(ride.final_price ?? ride.estimated_price ?? 0);`,
    );

    return next;
  },
  (source) =>
    source.includes('const finalPrice = Number(ride.final_price ?? ride.estimated_price ?? 0);') &&
    source.includes('.eq("status", "em_viagem")') &&
    source.includes('.eq("driver_id", driverRecordId)') &&
    source.includes('if (ride.status === "finalizada")') &&
    !source.includes('finitePositive(body.final_price)') &&
    !source.includes('requestedFinalPrice'),
  'Corridas driver-ride-action: finish ignora preço arbitrário do cliente e usa source of truth persistida',
);

console.log('[OK] Corridas: request/matching e conclusão da corrida endurecidos sem alterar source protegido.');
