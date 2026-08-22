import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const workspace = process.env.APOIS_ENTREGAS_WORKSPACE || '.work/partner-entregador';
const libPath = resolve(root, workspace, 'src/lib/courierNativeLocation.ts');
const trackerPath = resolve(root, workspace, 'src/components/CourierLocationTracker.tsx');
const routePath = resolve(root, workspace, 'src/routes/courier.tsx');

const libSource = `import { Capacitor, registerPlugin } from "@capacitor/core";\nimport { supabase } from "@/integrations/supabase/client";\n\ntype StartResult = { started?: boolean };\ntype StopResult = { stopped?: boolean };\ninterface CourierLocationPlugin {\n  start(options: { supabaseUrl: string; publishableKey: string; accessToken: string; refreshToken: string }): Promise<StartResult>;\n  stop(): Promise<StopResult>;\n}\nconst CourierLocation = registerPlugin<CourierLocationPlugin>("CourierLocation");\n\nexport function isNativeCourierLocation(): boolean {\n  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";\n}\n\nexport async function startCourierNativeLocation(): Promise<boolean> {\n  if (!isNativeCourierLocation()) return false;\n  let sessionResult = await supabase.auth.getSession();\n  if (sessionResult.error || !sessionResult.data.session) return false;\n  let session = sessionResult.data.session;\n  const expiresSoon = typeof session.expires_at === "number" && session.expires_at * 1000 < Date.now() + 120_000;\n  if (expiresSoon) {\n    const refreshed = await supabase.auth.refreshSession();\n    if (refreshed.error || !refreshed.data.session) return false;\n    session = refreshed.data.session;\n  }\n  const supabaseUrl = String(import.meta.env.VITE_SUPABASE_URL ?? "").trim();\n  const publishableKey = String(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "").trim();\n  if (!supabaseUrl || !publishableKey) return false;\n  const result = await CourierLocation.start({\n    supabaseUrl,\n    publishableKey,\n    accessToken: session.access_token,\n    refreshToken: session.refresh_token,\n  });\n  return result.started === true;\n}\n\nexport async function stopCourierNativeLocation(): Promise<void> {\n  if (!isNativeCourierLocation()) return;\n  await CourierLocation.stop();\n}\n`;
writeFileSync(libPath, libSource, 'utf8');

let tracker = readFileSync(trackerPath, 'utf8');
if (!tracker.includes('startCourierNativeLocation')) {
  tracker = tracker.replace(
    'import { supabase } from "@/integrations/supabase/client";',
    'import { supabase } from "@/integrations/supabase/client";\nimport { startCourierNativeLocation, stopCourierNativeLocation } from "@/lib/courierNativeLocation";',
  );
}
tracker = tracker.replace(
  `    if (!enabled) {\n      setStatus("idle");`,
  `    if (!enabled) {\n      void stopCourierNativeLocation().catch((error) => {\n        if (import.meta.env.DEV) console.warn("courier foreground location stop failed", error);\n      });\n      setStatus("idle");`,
);
tracker = tracker.replace(
  `      if (error) console.warn("Não foi possível corrigir o estado online sem localização:", error);\n    };`,
  `      if (error) console.warn("Não foi possível corrigir o estado online sem localização:", error);\n      await stopCourierNativeLocation().catch(() => undefined);\n    };`,
);
if (!tracker.includes('await startCourierNativeLocation();')) {
  const anchor = `      if (disposed) return;\n      nativeWatchId = await Geolocation.watchPosition(`;
  if (!tracker.includes(anchor)) throw new Error('[FAIL] Entregador Parceiro: início do watch nativo não encontrado para ligar Foreground Service.');
  tracker = tracker.replace(
    anchor,
    `      if (disposed) return;\n      try {\n        const backgroundStarted = await startCourierNativeLocation();\n        if (!backgroundStarted && import.meta.env.DEV) console.warn("courier foreground location service unavailable");\n      } catch (error) {\n        if (import.meta.env.DEV) console.warn("courier foreground location service start failed", error);\n      }\n      if (disposed) return;\n      nativeWatchId = await Geolocation.watchPosition(`,
  );
}
for (const marker of [
  'startCourierNativeLocation, stopCourierNativeLocation',
  'await startCourierNativeLocation();',
  'void stopCourierNativeLocation().catch',
  'await stopCourierNativeLocation().catch(() => undefined);',
]) {
  if (!tracker.includes(marker)) throw new Error(`[FAIL] Entregador Parceiro: Foreground Service não integrado ao tracker (${marker})`);
}
writeFileSync(trackerPath, tracker, 'utf8');

let route = readFileSync(routePath, 'utf8');
if (!route.includes('startCourierNativeLocation')) {
  const importAnchor = 'import { CourierLocationTracker, type CourierPosition } from "@/components/CourierLocationTracker";';
  if (!route.includes(importAnchor)) throw new Error('[FAIL] Entregador Parceiro: import do CourierLocationTracker não encontrado');
  route = route.replace(
    importAnchor,
    `${importAnchor}\nimport { isNativeCourierLocation, startCourierNativeLocation, stopCourierNativeLocation } from "@/lib/courierNativeLocation";`,
  );
}

// Logo após o backend aceitar ONLINE, exige que o serviço Android de segundo plano
// também inicie. Se o plugin/configuração estiver quebrado, desfaz ONLINE para não
// vender ao entregador uma disponibilidade que morrerá ao bloquear a tela.
const onlineAnchor = `        const { error: onlineError } = await rpc("set_courier_online", {\n          _is_online: true,\n        });\n        if (onlineError) throw onlineError;\n        setCurrentPosition(initialPosition);`;
const onlineReplacement = `        const { error: onlineError } = await rpc("set_courier_online", {\n          _is_online: true,\n        });\n        if (onlineError) throw onlineError;\n        if (isNativeCourierLocation()) {\n          let backgroundStarted = false;\n          try {\n            backgroundStarted = await startCourierNativeLocation();\n          } catch (backgroundError) {\n            if (import.meta.env.DEV) console.warn("courier foreground location bootstrap failed", backgroundError);\n          }\n          if (!backgroundStarted) {\n            await rpc("set_courier_online", { _is_online: false });\n            throw new Error("Não foi possível ativar a localização em segundo plano. Tente novamente antes de ficar online.");\n          }\n        }\n        setCurrentPosition(initialPosition);`;
if (route.includes(onlineAnchor)) route = route.replace(onlineAnchor, onlineReplacement);

route = route.replace(
  `    await removeCourierPushRegistration();\n    await supabase.auth.signOut();`,
  `    await stopCourierNativeLocation().catch(() => undefined);\n    await removeCourierPushRegistration();\n    await supabase.auth.signOut();`,
);
route = route.replace(
  `        const { error } = await rpc("set_courier_online", { _is_online: false });\n        if (error) throw error;\n        setCurrentPosition(null);`,
  `        const { error } = await rpc("set_courier_online", { _is_online: false });\n        if (error) throw error;\n        await stopCourierNativeLocation().catch(() => undefined);\n        setCurrentPosition(null);`,
);
route = route.replace(
  `      await removeCourierPushRegistration().catch((pushError) => {`,
  `      await stopCourierNativeLocation().catch(() => undefined);\n      await removeCourierPushRegistration().catch((pushError) => {`,
);

for (const marker of [
  'isNativeCourierLocation, startCourierNativeLocation, stopCourierNativeLocation',
  'backgroundStarted = await startCourierNativeLocation();',
  'await rpc("set_courier_online", { _is_online: false });',
  'Não foi possível ativar a localização em segundo plano.',
  'await stopCourierNativeLocation().catch(() => undefined);',
]) {
  if (!route.includes(marker)) throw new Error(`[FAIL] Entregador Parceiro: ciclo do FGS ausente na rota (${marker})`);
}
writeFileSync(routePath, route, 'utf8');

if (!existsSync(libPath)) throw new Error('[FAIL] Entregador Parceiro: courierNativeLocation.ts não foi criado');
console.log('[OK] Entregador Parceiro: ONLINE no Android só permanece ativo se o Foreground Service iniciar; GPS/heartbeat seguem no background e param após OFFLINE, perda de permissão, logout ou troca de perfil.');
