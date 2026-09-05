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
backend = backend.replace(
  '    const userId = authData.user?.id;\n    if (authError || !userId) {\n      return json({ ok: false, error_code: "unauthorized" }, 401, req);\n    }',
  '    const authUserId = authData.user?.id;\n    if (authError || !authUserId) {\n      return json({ ok: false, error_code: "unauthorized" }, 401, req);\n    }\n\n    const { data: domainUser, error: domainUserError } = await admin\n      .from("users")\n      .select("id")\n      .eq("auth_user_id", authUserId)\n      .maybeSingle();\n    if (domainUserError) {\n      return json({ ok: false, error_code: "passenger_identity_lookup_failed" }, 500, req);\n    }\n    if (!domainUser?.id) {\n      return json({ ok: false, error_code: "passenger_profile_not_found" }, 404, req);\n    }\n    const passengerDomainUserId = String(domainUser.id);',
);
backend = backend
  .replaceAll('ride.passenger_id !== userId', 'ride.passenger_id !== passengerDomainUserId')
  .replaceAll('cancelled_by: userId', 'cancelled_by: passengerDomainUserId')
  .replaceAll('.eq("passenger_id", userId)', '.eq("passenger_id", passengerDomainUserId)')
  .replaceAll('passenger_id: userId,', 'passenger_id: passengerDomainUserId,');

for (const marker of [
  'const authUserId = authData.user?.id;',
  '.eq("auth_user_id", authUserId)',
  'const passengerDomainUserId = String(domainUser.id);',
  'ride.passenger_id !== passengerDomainUserId',
  'cancelled_by: passengerDomainUserId',
  '.eq("passenger_id", passengerDomainUserId)',
  'passenger_id: passengerDomainUserId,',
]) {
  if (!backend.includes(marker)) fail(`cancel-ride sem boundary de identidade (${marker})`);
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

console.log('[OK] Passageiro: cancelamento usa DOMAIN USER ID, estados compatíveis com backend e UI sem fórmula financeira divergente.');
