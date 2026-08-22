import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const workspace = process.env.APOIS_MOTORISTA_WORKSPACE || '.work/partner-motorista';
const hookPath = resolve(root, workspace, 'src/hooks/useDriverBroadcast.ts');
const appPath = resolve(root, workspace, 'src/routes/motorista.app.tsx');

let hook = readFileSync(hookPath, 'utf8');
const successLog = `          if (started && import.meta.env.DEV) {\n            console.log("[APOIS MOTORISTA] localização nativa em background ativa");\n          }`;
const guardedSuccess = `          if (!started) {\n            await setPresence(false, null);\n            try {\n              window.localStorage.setItem(DRIVER_ONLINE_STORAGE_KEY, "0");\n              window.dispatchEvent(new CustomEvent("apois:driver-presence-change", {\n                detail: { online: false, reason: "background_location_unavailable" },\n              }));\n            } catch {\n              // backend já foi reconciliado como OFFLINE.\n            }\n            return;\n          }\n          if (import.meta.env.DEV) {\n            console.log("[APOIS MOTORISTA] localização nativa em background ativa");\n          }`;
if (hook.includes(successLog)) hook = hook.replace(successLog, guardedSuccess);

const catchBlock = `        .catch((error: unknown) => {\n          if (nativeLifecycleVersionRef.current === lifecycleVersion) {\n            console.warn("[APOIS MOTORISTA] localização nativa em background indisponível:", error);\n          }\n        })`;
const guardedCatch = `        .catch(async (error: unknown) => {\n          if (nativeLifecycleVersionRef.current === lifecycleVersion) {\n            console.warn("[APOIS MOTORISTA] localização nativa em background indisponível:", error);\n            await setPresence(false, null);\n            try {\n              window.localStorage.setItem(DRIVER_ONLINE_STORAGE_KEY, "0");\n              window.dispatchEvent(new CustomEvent("apois:driver-presence-change", {\n                detail: { online: false, reason: "background_location_unavailable" },\n              }));\n            } catch {\n              // backend já foi reconciliado como OFFLINE.\n            }\n          }\n        })`;
if (hook.includes(catchBlock)) hook = hook.replace(catchBlock, guardedCatch);

for (const marker of [
  'reason: "background_location_unavailable"',
  'await setPresence(false, null);',
  '.catch(async (error: unknown) =>',
]) {
  if (!hook.includes(marker)) throw new Error(`[FAIL] Motorista Parceiro: fail-safe do Foreground Service incompleto no broadcast (${marker})`);
}
writeFileSync(hookPath, hook, 'utf8');

let app = readFileSync(appPath, 'utf8');
if (!app.includes('background_location_unavailable')) {
  const anchor = `  const requestLocation = useCallback(() => {`;
  if (!app.includes(anchor)) throw new Error('[FAIL] Motorista Parceiro: requestLocation não encontrado após hardening do watcher');
  const effect = `  useEffect(() => {\n    const onPresenceChange = (event: Event) => {\n      const detail = (event as CustomEvent<{ online?: boolean; reason?: string }>).detail;\n      if (detail?.online !== false || detail?.reason !== "background_location_unavailable") return;\n      stopDriverWatch();\n      setDesiredOnline(false);\n      setGpsStatus("error");\n      setGpsMessage("Não foi possível manter a localização em segundo plano. Tente ficar online novamente.");\n      toast.error("Modo online desativado porque a localização em segundo plano não iniciou.");\n    };\n    window.addEventListener("apois:driver-presence-change", onPresenceChange as EventListener);\n    return () => window.removeEventListener("apois:driver-presence-change", onPresenceChange as EventListener);\n  }, [setDesiredOnline, stopDriverWatch]);\n\n`;
  app = app.replace(anchor, `${effect}${anchor}`);
}
for (const marker of [
  'detail?.reason !== "background_location_unavailable"',
  'stopDriverWatch();',
  'setDesiredOnline(false);',
  'Modo online desativado porque a localização em segundo plano não iniciou.',
]) {
  if (!app.includes(marker)) throw new Error(`[FAIL] Motorista Parceiro: UI não reage ao fail-safe de background (${marker})`);
}
writeFileSync(appPath, app, 'utf8');

console.log('[OK] Motorista Parceiro: se o Foreground Service de GPS não iniciar, backend e UI voltam para OFFLINE em vez de manter disponibilidade falsa.');
