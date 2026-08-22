import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const workspace = process.env.APOIS_MOTORISTA_WORKSPACE || '.work/partner-motorista';
const appPath = resolve(root, workspace, 'src/routes/motorista.app.tsx');
const hookPath = resolve(root, workspace, 'src/hooks/useDriverBroadcast.ts');
const menuPath = resolve(root, workspace, 'src/components/DriverSideMenu.tsx');
const ROLE_KEY = 'apois-parceiro:operational-role';

// A intenção local ONLINE pode gravar a trava imediatamente. A intenção OFFLINE
// NÃO pode apagá-la aqui: primeiro o backend precisa confirmar driver_set_presence(false).
let app = readFileSync(appPath, 'utf8');
const setterAnchor = `      localStorage.setItem("apois:driver:online", value ? "1" : "0");\n      window.dispatchEvent(new CustomEvent("apois:driver-presence-change", { detail: { online: value } }));`;
const setterReplacement = `      localStorage.setItem("apois:driver:online", value ? "1" : "0");\n      if (value) localStorage.setItem("${ROLE_KEY}", "motorista");\n      window.dispatchEvent(new CustomEvent("apois:driver-presence-change", { detail: { online: value } }));`;
const prematureSetter = `      localStorage.setItem("apois:driver:online", value ? "1" : "0");\n      if (value) localStorage.setItem("${ROLE_KEY}", "motorista");\n      else if (localStorage.getItem("${ROLE_KEY}") === "motorista") localStorage.removeItem("${ROLE_KEY}");\n      window.dispatchEvent(new CustomEvent("apois:driver-presence-change", { detail: { online: value } }));`;
if (app.includes(prematureSetter)) app = app.replace(prematureSetter, setterReplacement);
else if (app.includes(setterAnchor)) app = app.replace(setterAnchor, setterReplacement);
if (!app.includes(`if (value) localStorage.setItem("${ROLE_KEY}", "motorista")`)) {
  throw new Error('[FAIL] Motorista Parceiro: intenção ONLINE não grava trava operacional');
}
if (app.includes(`else if (localStorage.getItem("${ROLE_KEY}") === "motorista") localStorage.removeItem("${ROLE_KEY}")`)) {
  throw new Error('[FAIL] Motorista Parceiro: intenção OFFLINE ainda limpa trava antes da confirmação do backend');
}
writeFileSync(appPath, app, 'utf8');

// A autoridade para remover a trava é a própria RPC de presença. Só um HTTP/RPC
// concluído sem erro pode transformar a intenção OFFLINE em liberação do shell.
let hook = readFileSync(hookPath, 'utf8');
const presenceErrorAnchor = `  if (error) {\n    console.warn("[APOIS MOTORISTA] presença não atualizada:", error.message);\n  }\n}`;
const presenceConfirmed = `  if (error) {\n    console.warn("[APOIS MOTORISTA] presença não atualizada:", error.message);\n    return false;\n  }\n  try {\n    if (publishOnline) window.localStorage.setItem("${ROLE_KEY}", "motorista");\n    else if (window.localStorage.getItem("${ROLE_KEY}") === "motorista") window.localStorage.removeItem("${ROLE_KEY}");\n  } catch {\n    // backend é a autoridade; storage é somente trava de navegação do host.\n  }\n  return true;\n}`;
if (!hook.includes('return false;\n  }\n  try {\n    if (publishOnline) window.localStorage.setItem("apois-parceiro:operational-role", "motorista")')) {
  if (!hook.includes(presenceErrorAnchor)) {
    throw new Error('[FAIL] Motorista Parceiro: setPresence não encontrado para reconciliar trava operacional');
  }
  hook = hook.replace(presenceErrorAnchor, presenceConfirmed);
}

// SIGNED_OUT é uma saída de sessão já protegida pelos fluxos normais de logout.
// Mantemos a limpeza como última defesa para não deixar lock órfão após sessão destruída.
const signoutAnchor = `        window.localStorage.setItem(DRIVER_ONLINE_STORAGE_KEY, "0");`;
if (hook.includes(signoutAnchor) && !hook.includes(`window.localStorage.removeItem("${ROLE_KEY}")`)) {
  hook = hook.replace(
    signoutAnchor,
    `${signoutAnchor}\n        if (window.localStorage.getItem("${ROLE_KEY}") === "motorista") window.localStorage.removeItem("${ROLE_KEY}");`,
  );
}
for (const marker of [
  `if (publishOnline) window.localStorage.setItem("${ROLE_KEY}", "motorista")`,
  `window.localStorage.getItem("${ROLE_KEY}") === "motorista"`,
  'return false;',
  'return true;',
  'SIGNED_OUT',
]) {
  if (!hook.includes(marker)) throw new Error(`[FAIL] Motorista Parceiro: reconciliação backend da trava ausente (${marker})`);
}
writeFileSync(hookPath, hook, 'utf8');

// Troca de perfil possui RPC OFFLINE própria e só chega neste ponto após sucesso.
let menu = readFileSync(menuPath, 'utf8');
const switchAnchor = `        localStorage.setItem("apois:driver:online", "0");`;
if (menu.includes(switchAnchor) && !menu.includes(`localStorage.removeItem("${ROLE_KEY}")`)) {
  menu = menu.replace(
    switchAnchor,
    `${switchAnchor}\n        if (localStorage.getItem("${ROLE_KEY}") === "motorista") localStorage.removeItem("${ROLE_KEY}");`,
  );
}
if (!menu.includes(`localStorage.removeItem("${ROLE_KEY}")`)) {
  throw new Error('[FAIL] Motorista Parceiro: troca de perfil não limpa trava operacional após OFFLINE confirmado');
}
writeFileSync(menuPath, menu, 'utf8');

console.log('[OK] Motorista Parceiro: ONLINE trava o shell imediatamente; OFFLINE libera a função somente após driver_set_presence confirmar sucesso.');
