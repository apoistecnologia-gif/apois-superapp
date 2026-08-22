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
// Não interrompe o Foreground Service no cleanup do componente: abrir perfil/histórico
// desmonta temporariamente o tracker mesmo com o entregador ONLINE. O serviço só deve
// parar ao ficar OFFLINE, perder permissão, sair ou trocar de perfil.
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
if (!route.includes('stopCourierNativeLocation')) {
  const importAnchor = 'import { CourierLocationTracker, type CourierPosition } from "@/components/CourierLocationTracker";';
  if (!route.includes(importAnchor)) throw new Error('[FAIL] Entregador Parceiro: import do CourierLocationTracker não encontrado');
  route = route.replace(importAnchor, `${importAnchor}\nimport { stopCourierNativeLocation } from "@/lib/courierNativeLocation";`);
}

// Logout: depois de confirmar OFFLINE, encerra o FGS antes de remover o registro Push e a sessão.
route = route.replace(
  `    await removeCourierPushRegistration();\n    await supabase.auth.signOut();`,
  `    await stopCourierNativeLocation().catch(() => undefined);\n    await removeCourierPushRegistration();\n    await supabase.auth.signOut();`,
);

// Toggle OFFLINE: backend primeiro, serviço nativo em seguida. Assim uma falha de RPC não
// mata o rastreamento enquanto o servidor ainda considera o entregador online.
route = route.replace(
  `        const { error } = await rpc("set_courier_online", { _is_online: false });\n        if (error) throw error;\n        setCurrentPosition(null);`,
  `        const { error } = await rpc("set_courier_online", { _is_online: false });\n        if (error) throw error;\n        await stopCourierNativeLocation().catch(() => undefined);\n        setCurrentPosition(null);`,
);

// Troca de perfil endurecida anteriormente: também encerra o FGS antes de ir ao shell.
route = route.replace(
  `      await removeCourierPushRegistration().catch((pushError) => {`,
  `      await stopCourierNativeLocation().catch(() => undefined);\n      await removeCourierPushRegistration().catch((pushError) => {`,
);

for (const marker of [
  'import { stopCourierNativeLocation } from "@/lib/courierNativeLocation";',
  'await stopCourierNativeLocation().catch(() => undefined);',
]) {
  if (!route.includes(marker)) throw new Error(`[FAIL] Entregador Parceiro: encerramento do FGS ausente na rota (${marker})`);
}
writeFileSync(routePath, route, 'utf8');

if (!existsSync(libPath)) throw new Error('[FAIL] Entregador Parceiro: courierNativeLocation.ts não foi criado');
console.log('[OK] Entregador Parceiro: Foreground Service mantém GPS/heartbeat em background e é encerrado somente após OFFLINE, perda de permissão, logout ou troca de perfil.');
