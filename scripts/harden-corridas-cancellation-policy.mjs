import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

function fail(message) {
  throw new Error(`[FAIL] cancellation policy: ${message}`);
}

// Frontend: o backend terminal permite cancelamento apenas enquanto procura motorista
// ou enquanto o motorista está a caminho. Depois que o motorista chega, a ação não é
// oferecida. Não inventamos regra diferente no cliente.
const servicePath = resolve('.work/corridas/src/services/rides/active-ride-service.ts');
let service = readFileSync(servicePath, 'utf8');
const hardenedAvailability = 'canCancel: ["procurar_motorista", "motorista_a_caminho"].includes(status),';
service = service.replace(
  /canCancel:\s*\[[^\]]*\]\.includes\(status\),/,
  hardenedAvailability,
);
if (!service.includes(hardenedAvailability)) fail('regra de disponibilidade não encontrada');
if (/canCancel:\s*\[[^\]]*"motorista_chegou"[^\]]*\]\.includes\(status\),/.test(service)) {
  fail('motorista_chegou não pode oferecer cancelamento se o backend o recusa');
}
if (/canCancel:\s*\[[^\]]*"em_viagem"[^\]]*\]\.includes\(status\),/.test(service)) {
  fail('em_viagem não pode permitir cancelamento');
}
writeFileSync(servicePath, service, 'utf8');

// Dialog: não codificar fórmula que o backend não implementa. A Edge Function usa
// app_settings (janela gratuita + valor configurado), portanto a UI comunica apenas
// a possibilidade de taxa sem prometer um cálculo diferente.
const dialogPath = resolve('.work/corridas/src/components/rides/active/CancellationDialog.tsx');
let dialog = readFileSync(dialogPath, 'utf8');
const staleRuleText = 'Regra APOIS: R$ 5,00 + R$ 1,00 por km percorrido pelo motorista, limitada a R$ 15,00. Se o motorista já chegou ao embarque, a taxa é R$ 15,00.';
dialog = dialog.replace(
  new RegExp(`\\s*<p className="rounded-xl border border-apois-yellow/20 bg-apois-yellow/5 px-3 py-2 text-\\[11px\\] leading-5 text-zinc-400">\\s*${staleRuleText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*</p>`, 'g'),
  '',
);
if (dialog.includes(staleRuleText)) fail('fórmula de cancelamento divergente permaneceu no diálogo');
if (!dialog.includes('poderá ser aplicada uma taxa de cancelamento')) {
  fail('diálogo deixou de informar possibilidade de taxa');
}
writeFileSync(dialogPath, dialog, 'utf8');

const routePath = resolve('.work/corridas/src/routes/_authenticated.corrida.$rideId.tsx');
let route = readFileSync(routePath, 'utf8');
route = route.replace(
  'isOpen={isCancelDialogOpen}',
  'isOpen={Boolean(actionAvailability?.canCancel && isCancelDialogOpen)}',
);
if (!route.includes('isOpen={Boolean(actionAvailability?.canCancel && isCancelDialogOpen)}')) {
  fail('diálogo não está protegido pelo status atual');
}
writeFileSync(routePath, route, 'utf8');

// Corrige uma API de contexto legada que ainda apontava o cancelamento para request-ride.
// O fluxo visível usa rideRequestService/cancel-ride, mas manter o Context correto evita
// regressão futura se outro componente consumir cancelRide diretamente.
const requestHookPath = resolve('.work/corridas/src/hooks/rides/use-ride-request.tsx');
let requestHook = readFileSync(requestHookPath, 'utf8');
requestHook = requestHook.replace(
  '    const { data, error } = await supabase.functions.invoke("request-ride", {\n      body: { action: "cancel", ride_id: rideId },\n    });',
  '    const { data, error } = await supabase.functions.invoke("cancel-ride", {\n      body: { ride_id: rideId },\n    });',
);
if (requestHook.includes('body: { action: "cancel", ride_id: rideId }')) {
  fail('hook legado ainda envia action=cancel para request-ride');
}
if (!requestHook.includes('supabase.functions.invoke("cancel-ride"')) {
  fail('hook de cancelamento não usa cancel-ride');
}
writeFileSync(requestHookPath, requestHook, 'utf8');

// Backend: auth.getUser devolve AUTH USER ID. rides.passenger_id,
// cancellation_fees.passenger_id e passenger_wallets.passenger_id são DOMAIN USER ID.
// Resolver explicitamente public.users.auth_user_id antes de qualquer autorização/escrita.
const backendPath = resolve('.work/corridas/supabase/functions/cancel-ride/index.ts');
let backend = readFileSync(backendPath, 'utf8');
// O snapshot protegido contém uma aspa ausente na mensagem de taxa. Corrigir na
// cópia isolada mantém o pin intacto e garante que a Edge Function publicada seja válida.
backend = backend.replace(
  'fee.toFixed(2).replace(".", ")}.' ,
  'fee.toFixed(2).replace(".", ",")}.' ,
);
backend = backend.replace(
  '    const userId = authData.user?.id;\n    if (authError || !userId) {\n      return json({ ok: false, error_code: "unauthorized" }, 401, req);\n    }',
  '    const authUserId = authData.user?.id;\n    if (authError || !authUserId) {\n      return json({ ok: false, error_code: "unauthorized" }, 401, req);\n    }\n\n    const { data: domainUser, error: domainUserError } = await admin\n      .from("users")\n      .select("id")\n      .eq("auth_user_id", authUserId)\n      .maybeSingle();\n    if (domainUserError) {\n      return json({ ok: false, error_code: "passenger_identity_lookup_failed" }, 500, req);\n    }\n    if (!domainUser?.id) {\n      return json({ ok: false, error_code: "passenger_profile_not_found" }, 404, req);\n    }\n    const passengerDomainUserId = String(domainUser.id);',
);
backend = backend
  .replaceAll('ride.passenger_id !== userId', 'ride.passenger_id !== passengerDomainUserId')
  .replaceAll('cancelled_by: userId', 'cancelled_by: passengerDomainUserId')
  .replaceAll('.eq("passenger_id", userId)', '.eq("passenger_id", passengerDomainUserId)')
  .replaceAll('passenger_id: userId,', 'passenger_id: passengerDomainUserId,');

// Uma corrida pode ter sido marcada como cancelada antes de uma falha transitória ao
// persistir a taxa ou bloquear a carteira. O retry precisa reconciliar o efeito financeiro
// sem duplicá-lo. A migration forward-only cria UNIQUE(cancellation_fees.ride_id), que é
// a barreira mecânica de idempotência entre retries/processos concorrentes.
const helperMarker = 'Deno.serve(async (req) => {';
if (!backend.includes('async function ensureCancellationFinancialState(')) {
  const helper = `async function ensureCancellationFinancialState(\n  admin: any,\n  rideId: string,\n  passengerDomainUserId: string,\n  fee: number,\n  reason: string,\n  now: string,\n): Promise<void> {\n  if (!(fee > 0)) return;\n\n  let { data: existingFee, error: existingFeeError } = await admin\n    .from("cancellation_fees")\n    .select("id,status")\n    .eq("ride_id", rideId)\n    .limit(1)\n    .maybeSingle();\n  if (existingFeeError) throw new Error(\`cancellation_fee_lookup_failed:\${existingFeeError.message}\`);\n\n  if (!existingFee) {\n    const { data: insertedFee, error: feeError } = await admin\n      .from("cancellation_fees")\n      .insert({\n        ride_id: rideId,\n        passenger_id: passengerDomainUserId,\n        amount: fee,\n        reason,\n        status: "pending",\n      })\n      .select("id,status")\n      .maybeSingle();\n\n    if (feeError && feeError.code !== "23505") {\n      throw new Error(\`cancellation_fee_create_failed:\${feeError.message}\`);\n    }\n    existingFee = insertedFee ?? null;\n\n    if (!existingFee && feeError?.code === "23505") {\n      const retryLookup = await admin\n        .from("cancellation_fees")\n        .select("id,status")\n        .eq("ride_id", rideId)\n        .limit(1)\n        .maybeSingle();\n      if (retryLookup.error || !retryLookup.data) {\n        throw new Error(\`cancellation_fee_conflict_lookup_failed:\${retryLookup.error?.message ?? "missing_row"}\`);\n      }\n      existingFee = retryLookup.data;\n    }\n  }\n\n  // Nunca re-bloquear uma carteira depois que a taxa já foi liquidada.\n  const feeStatus = String(existingFee?.status ?? "pending").toLowerCase();\n  if (["paid", "completed", "settled"].includes(feeStatus)) return;\n\n  const { error: walletError } = await admin.from("passenger_wallets").upsert({\n    passenger_id: passengerDomainUserId,\n    is_blocked: true,\n    blocked_reason: \`Taxa de cancelamento pendente de R$ \${fee.toFixed(2).replace(".", ",")}\`,\n    updated_at: now,\n  }, { onConflict: "passenger_id" });\n\n  if (walletError) throw new Error(\`wallet_block_failed:\${walletError.message}\`);\n}\n\n`;
  if (!backend.includes(helperMarker)) fail('marcador Deno.serve não encontrado no cancel-ride');
  backend = backend.replace(helperMarker, helper + helperMarker);
}
backend = backend.replace(
  `  let { data: existingFee, error: existingFeeError } = await admin
    .from("cancellation_fees")
    .select("id,status")
    .eq("ride_id", rideId)
    .limit(1)
    .maybeSingle();`,
  `  const existingFeeLookup = await admin
    .from("cancellation_fees")
    .select("id,status")
    .eq("ride_id", rideId)
    .limit(1)
    .maybeSingle();
  let existingFee = existingFeeLookup.data;
  const existingFeeError = existingFeeLookup.error;`,
);

backend = backend.replace(
  '.select("id,passenger_id,status,accepted_at,created_at,cancellation_fee")',
  '.select("id,passenger_id,status,accepted_at,created_at,cancellation_fee,cancellation_reason")',
);

const oldTerminal = `    if (["finalizada", "cancelada_passageiro", "cancelada_motorista"].includes(String(ride.status))) {\n      return json({\n        ok: true,\n        status: ride.status,\n        cancellation_fee: Number(ride.cancellation_fee ?? 0),\n        message: "A corrida já está encerrada.",\n      }, 200, req);\n    }`;
const newTerminal = `    if (["finalizada", "cancelada_passageiro", "cancelada_motorista"].includes(String(ride.status))) {\n      const existingFee = Number(ride.cancellation_fee ?? 0);\n      if (ride.status === "cancelada_passageiro" && existingFee > 0) {\n        try {\n          await ensureCancellationFinancialState(\n            admin,\n            rideId,\n            passengerDomainUserId,\n            existingFee,\n            String(ride.cancellation_reason ?? "Cancelada pelo passageiro"),\n            new Date().toISOString(),\n          );\n        } catch (reconcileError) {\n          console.error("[cancel-ride] terminal reconciliation failed", {\n            rideId,\n            error: reconcileError instanceof Error ? reconcileError.message : String(reconcileError),\n          });\n          return json({ ok: false, error_code: "cancellation_financial_reconciliation_failed" }, 500, req);\n        }\n      }\n      return json({\n        ok: true,\n        status: ride.status,\n        cancellation_fee: existingFee,\n        message: "A corrida já está encerrada.",\n      }, 200, req);\n    }`;
if (backend.includes(oldTerminal)) backend = backend.replace(oldTerminal, newTerminal);

const oldFeeBlock = `    if (fee > 0) {\n      const { error: feeError } = await admin.from("cancellation_fees").insert({\n        ride_id: rideId,\n        passenger_id: passengerDomainUserId,\n        amount: fee,\n        reason,\n        status: "pending",\n      });\n      if (feeError && feeError.code !== "23505") {\n        console.error("[cancel-ride] fee insert failed", feeError);\n        return json({ ok: false, error_code: "cancellation_fee_create_failed" }, 500, req);\n      }\n\n      const { error: walletError } = await admin.from("passenger_wallets").upsert({\n        passenger_id: passengerDomainUserId,\n        is_blocked: true,\n        blocked_reason: \`Taxa de cancelamento pendente de R$ \${fee.toFixed(2).replace(".", ",")}\`,\n        updated_at: now,\n      }, { onConflict: "passenger_id" });\n\n      if (walletError) {\n        console.error("[cancel-ride] wallet block failed", walletError);\n        return json({ ok: false, error_code: "wallet_block_failed" }, 500, req);\n      }\n    }`;
const newFeeBlock = `    if (fee > 0) {\n      try {\n        await ensureCancellationFinancialState(\n          admin,\n          rideId,\n          passengerDomainUserId,\n          fee,\n          reason,\n          now,\n        );\n      } catch (financialError) {\n        console.error("[cancel-ride] cancellation financial state failed", {\n          rideId,\n          error: financialError instanceof Error ? financialError.message : String(financialError),\n        });\n        return json({ ok: false, error_code: "cancellation_financial_reconciliation_failed" }, 500, req);\n      }\n    }`;
if (backend.includes(oldFeeBlock)) backend = backend.replace(oldFeeBlock, newFeeBlock);

for (const marker of [
  'const authUserId = authData.user?.id;',
  '.eq("auth_user_id", authUserId)',
  'const passengerDomainUserId = String(domainUser.id);',
  'ride.passenger_id !== passengerDomainUserId',
  'cancelled_by: passengerDomainUserId',
  '.eq("passenger_id", passengerDomainUserId)',
  'passenger_id: passengerDomainUserId,',
  'async function ensureCancellationFinancialState(',
  '.eq("ride_id", rideId)',
  'feeError.code !== "23505"',
  '["paid", "completed", "settled"].includes(feeStatus)',
  'cancellation_financial_reconciliation_failed',
  'ride.status === "cancelada_passageiro" && existingFee > 0',
]) {
  if (!backend.includes(marker)) fail(`cancel-ride sem boundary/reconciliação (${marker})`);
}
for (const forbidden of [
  'ride.passenger_id !== userId',
  'cancelled_by: userId',
  '.eq("passenger_id", userId)',
  'passenger_id: userId,',
]) {
  if (backend.includes(forbidden)) fail(`cancel-ride ainda mistura AUTH e DOMAIN (${forbidden})`);
}
writeFileSync(backendPath, backend, 'utf8');

console.log('[OK] Passageiro: cancelamento usa DOMAIN USER ID, estados compatíveis, UI sem fórmula divergente e taxa recuperável/idempotente.');
