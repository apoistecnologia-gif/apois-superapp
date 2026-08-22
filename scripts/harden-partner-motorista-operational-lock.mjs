import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const workspace = process.env.APOIS_MOTORISTA_WORKSPACE || '.work/partner-motorista';
const appPath = resolve(root, workspace, 'src/routes/motorista.app.tsx');
const hookPath = resolve(root, workspace, 'src/hooks/useDriverBroadcast.ts');
const menuPath = resolve(root, workspace, 'src/components/DriverSideMenu.tsx');
const ROLE_KEY = 'apois-parceiro:operational-role';

let app = readFileSync(appPath, 'utf8');
const setterAnchor = `      localStorage.setItem("apois:driver:online", value ? "1" : "0");\n      window.dispatchEvent(new CustomEvent("apois:driver-presence-change", { detail: { online: value } }));`;
const setterReplacement = `      localStorage.setItem("apois:driver:online", value ? "1" : "0");\n      if (value) localStorage.setItem("${ROLE_KEY}", "motorista");\n      else if (localStorage.getItem("${ROLE_KEY}") === "motorista") localStorage.removeItem("${ROLE_KEY}");\n      window.dispatchEvent(new CustomEvent("apois:driver-presence-change", { detail: { online: value } }));`;
if (app.includes(setterAnchor)) app = app.replace(setterAnchor, setterReplacement);
for (const marker of [
  `localStorage.setItem("${ROLE_KEY}", "motorista")`,
  `localStorage.getItem("${ROLE_KEY}") === "motorista"`,
]) {
  if (!app.includes(marker)) throw new Error(`[FAIL] Motorista Parceiro: trava operacional ausente no estado ONLINE (${marker})`);
}
writeFileSync(appPath, app, 'utf8');

let hook = readFileSync(hookPath, 'utf8');
const signoutAnchor = `        window.localStorage.setItem(DRIVER_ONLINE_STORAGE_KEY, "0");`;
if (hook.includes(signoutAnchor) && !hook.includes(`window.localStorage.removeItem("${ROLE_KEY}")`)) {
  hook = hook.replace(
    signoutAnchor,
    `${signoutAnchor}\n        if (window.localStorage.getItem("${ROLE_KEY}") === "motorista") window.localStorage.removeItem("${ROLE_KEY}");`,
  );
}
if (!hook.includes(`window.localStorage.removeItem("${ROLE_KEY}")`)) {
  throw new Error('[FAIL] Motorista Parceiro: logout não limpa trava operacional');
}
writeFileSync(hookPath, hook, 'utf8');

let menu = readFileSync(menuPath, 'utf8');
const switchAnchor = `        localStorage.setItem("apois:driver:online", "0");`;
if (menu.includes(switchAnchor) && !menu.includes(`localStorage.removeItem("${ROLE_KEY}")`)) {
  menu = menu.replace(
    switchAnchor,
    `${switchAnchor}\n        if (localStorage.getItem("${ROLE_KEY}") === "motorista") localStorage.removeItem("${ROLE_KEY}");`,
  );
}
if (!menu.includes(`localStorage.removeItem("${ROLE_KEY}")`)) {
  throw new Error('[FAIL] Motorista Parceiro: troca de perfil não limpa trava operacional');
}
writeFileSync(menuPath, menu, 'utf8');

console.log('[OK] Motorista Parceiro: presença ONLINE grava trava operacional do shell; OFFLINE, logout e troca de perfil removem a trava somente após a reconciliação.');
