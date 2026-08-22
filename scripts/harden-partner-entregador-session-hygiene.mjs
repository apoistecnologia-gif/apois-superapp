import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const workspace = process.env.APOIS_ENTREGAS_WORKSPACE || '.work/partner-entregador';
const path = resolve(root, workspace, 'src/routes/courier.tsx');
let source = readFileSync(path, 'utf8');

source = source.replace(
  '    await removeCourierPushRegistration();\n    await supabase.auth.signOut();\n    navigate({ to: "/login", replace: true });',
  '    await removeCourierPushRegistration();\n    await supabase.auth.signOut();\n    window.location.replace("../../index.html");',
);

for (const marker of [
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
if (logoutBlock.includes('navigate({ to: "/login"')) {
  throw new Error('[FAIL] Entregador Parceiro: logout explícito ainda cai no login interno em vez do seletor');
}
if (source.includes('PushNotifications.unregister()')) {
  throw new Error('[FAIL] Entregador Parceiro: logout ainda invalida token FCM nativo compartilhado');
}

writeFileSync(path, source, 'utf8');
console.log('[OK] Entregador Parceiro: logout encerra apenas a sessão de Entregas, remove seu registro Push e retorna ao seletor sem invalidar o FCM compartilhado.');
