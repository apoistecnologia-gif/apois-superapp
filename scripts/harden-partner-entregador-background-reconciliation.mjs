import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const workspace = process.env.APOIS_ENTREGAS_WORKSPACE || '.work/partner-entregador';
const routePath = resolve(root, workspace, 'src/routes/courier.tsx');
const trackerPath = resolve(root, workspace, 'src/components/CourierLocationTracker.tsx');
const ROLE_KEY = 'apois-parceiro:operational-role';

let route = readFileSync(routePath, 'utf8');
const rollbackAnchor = `          if (!backgroundStarted) {\n            await rpc("set_courier_online", { _is_online: false });\n            throw new Error("Não foi possível ativar a localização em segundo plano. Tente novamente antes de ficar online.");\n          }`;
const rollbackReplacement = `          if (!backgroundStarted) {\n            const { error: rollbackError } = await rpc("set_courier_online", { _is_online: false });\n            if (rollbackError) {\n              try { localStorage.setItem("${ROLE_KEY}", "entregador"); } catch { /* no-op */ }\n              throw new Error("A localização em segundo plano não iniciou e não foi possível confirmar que você ficou offline. Permaneça no modo Entregador e tente novamente.");\n            }\n            throw new Error("Não foi possível ativar a localização em segundo plano. Tente novamente antes de ficar online.");\n          }`;
if (route.includes(rollbackAnchor)) route = route.replace(rollbackAnchor, rollbackReplacement);

for (const marker of [
  'const { error: rollbackError } = await rpc("set_courier_online", { _is_online: false });',
  'if (rollbackError)',
  `localStorage.setItem("${ROLE_KEY}", "entregador")`,
  'não foi possível confirmar que você ficou offline',
]) {
  if (!route.includes(marker)) throw new Error(`[FAIL] Entregador Parceiro: rollback do FGS não protege estado ONLINE incerto (${marker})`);
}
writeFileSync(routePath, route, 'utf8');

let tracker = readFileSync(trackerPath, 'utf8');
const trackerAnchor = `      if (error) console.warn("Não foi possível corrigir o estado online sem localização:", error);\n      await stopCourierNativeLocation().catch(() => undefined);`;
const trackerReplacement = `      if (error) {\n        console.warn("Não foi possível corrigir o estado online sem localização:", error);\n        try { localStorage.setItem("${ROLE_KEY}", "entregador"); } catch { /* no-op */ }\n        setErrorMessage("A localização foi perdida e não foi possível confirmar que você ficou offline. Permaneça no modo Entregador e tente novamente.");\n        return false;\n      }\n      await stopCourierNativeLocation().catch(() => undefined);\n      try { if (localStorage.getItem("${ROLE_KEY}") === "entregador") localStorage.removeItem("${ROLE_KEY}"); } catch { /* no-op */ }\n      return true;`;
if (tracker.includes(trackerAnchor)) tracker = tracker.replace(trackerAnchor, trackerReplacement);

for (const marker of [
  'return false;',
  'return true;',
  `localStorage.setItem("${ROLE_KEY}", "entregador")`,
  `localStorage.removeItem("${ROLE_KEY}")`,
  'A localização foi perdida e não foi possível confirmar que você ficou offline.',
]) {
  if (!tracker.includes(marker)) throw new Error(`[FAIL] Entregador Parceiro: perda de permissão não preserva trava até OFFLINE confirmado (${marker})`);
}
writeFileSync(trackerPath, tracker, 'utf8');

console.log('[OK] Entregador Parceiro: falha do FGS ou perda de GPS só libera a função após OFFLINE confirmado; erro de rede preserva a trava Entregador.');
