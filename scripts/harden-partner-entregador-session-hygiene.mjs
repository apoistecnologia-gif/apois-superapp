import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const workspace = process.env.APOIS_ENTREGAS_WORKSPACE || '.work/partner-entregador';
const path = resolve(root, workspace, 'src/routes/courier.tsx');
let source = readFileSync(path, 'utf8');

// Não confie apenas em availability?.is_online para decidir se é preciso ficar
// offline: um refresh parcial pode deixar a UI stale. Para entregador aprovado e
// ativo, logout sempre confirma OFFLINE no backend antes de destruir sessão/Push.
const staleConditional = `    if (availability?.is_online) {\n      const { error } = await rpc("set_courier_online", { _is_online: false });\n      if (error) {\n        toast.error(error.message || "Não foi possível ficar offline antes de sair.");\n        return;\n      }\n    }`;
const confirmedOffline = `    if (courier?.status === "approved" && courier?.is_active) {\n      const { error: offlineError } = await rpc("set_courier_online", { _is_online: false });\n      if (offlineError) {\n        toast.error(courierReadableError(offlineError, "Não foi possível confirmar que você ficou offline antes de sair."));\n        return;\n      }\n    }`;
if (source.includes(staleConditional)) source = source.replace(staleConditional, confirmedOffline);

source = source.replace(
  '    await removeCourierPushRegistration();\n    await supabase.auth.signOut();\n    navigate({ to: "/login", replace: true });',
  '    await removeCourierPushRegistration();\n    await supabase.auth.signOut();\n    window.location.replace("../../index.html");',
);

for (const marker of [
  'courier?.status === "approved" && courier?.is_active',
  'const { error: offlineError } = await rpc("set_courier_online", { _is_online: false });',
  'Não foi possível confirmar que você ficou offline antes de sair.',
  'await removeCourierPushRegistration();',
  'await supabase.auth.signOut();',
  'window.location.replace("../../index.html");',
]) {
  if (!source.includes(marker)) throw new Error(`[FAIL] Entregador Parceiro: logout incompleto (${marker})`);
}

const logoutStart = source.indexOf('  const logout = async () => {');
const logoutEnd = source.indexOf('  const submitApplication', logoutStart);
if (logoutStart < 0 || logoutEnd < 0) throw new Error('[FAIL] Entregador Parceiro: bloco de logout não encontrado');
const logoutBlock = source.slice(logoutStart, logoutEnd);
if (logoutBlock.includes('if (availability?.is_online)')) {
  throw new Error('[FAIL] Entregador Parceiro: logout ainda depende de availability possivelmente stale para confirmar OFFLINE');
}
if (logoutBlock.includes('navigate({ to: "/login"')) {
  throw new Error('[FAIL] Entregador Parceiro: logout explícito ainda cai no login interno em vez do seletor');
}
if (source.includes('PushNotifications.unregister()')) {
  throw new Error('[FAIL] Entregador Parceiro: logout ainda invalida token FCM nativo compartilhado');
}

writeFileSync(path, source, 'utf8');
console.log('[OK] Entregador Parceiro: logout de conta aprovada confirma OFFLINE mesmo com UI stale, remove apenas seu registro Push e retorna ao seletor sem invalidar o FCM compartilhado.');
