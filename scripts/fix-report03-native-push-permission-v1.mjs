// INV-041: estado e solicitacao de permissao nativa via Capacitor, sem usar Web Notifications no APK.
// Aplica somente em workspace descartavel; listeners de registro devem estar anexados ANTES de register().
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
const workspace=resolve(process.cwd(),process.env.APOIS_MOTORISTA_WORKSPACE||".work/partner-motorista");
function once(s,a,b,label){const n=s.split(a).length-1;if(n!==1)throw Error("[INV041] "+label+" "+n);return s.replace(a,b);}
function patch(path,marker,fn){const file=resolve(workspace,path);if(!existsSync(file))throw Error("[INV041] missing "+path);const before=readFileSync(file,"utf8");if(before.includes(marker))return;const after=fn(before);if(!after.includes(marker))throw Error("[INV041] incomplete "+path);writeFileSync(file,after);console.log("[OK] INV041 "+path);}
patch("src/lib/nativeBridge.ts","export async function inspectNativePushPermission",original=>{
 let s=original;
 s=once(s,
   "let initStarted = false;",
   "let initStarted = false;\nlet pushListenersReady: Promise<void> | null = null;\nfunction ensurePushListeners(): Promise<void> {\n  if (!pushListenersReady) {\n    pushListenersReady = attachPushListenersOnly().catch((error) => { pushListenersReady = null; throw error; });\n  }\n  return pushListenersReady;\n}",
   "listeners state");
 s=once(s,
   "    void attachPushListenersOnly().catch((error) => {",
   "    void ensurePushListeners().catch((error) => {",
   "listener initialization");
 s=once(s,
   "async function setupPush(): Promise<NativePermissionState> {\n  const { PushNotifications } = await import(\"@capacitor/push-notifications\");",
   "async function setupPush(): Promise<NativePermissionState> {\n  await ensurePushListeners();\n  const { PushNotifications } = await import(\"@capacitor/push-notifications\");",
   "listener registration order");
 s=once(s,
   "async function setupPushSafely(): Promise<NativePermissionState> {",
   [
     "// Permissao OS e registro de token sao estados distintos.",
     "export async function inspectNativePushPermission(): Promise<NotificationPermission | \"unsupported\"> {",
     "  if (!isNative() || !ENABLE_NATIVE_PUSH) return \"unsupported\";",
     "  try {",
     "    const { PushNotifications } = await import(\"@capacitor/push-notifications\");",
     "    const permission = await PushNotifications.checkPermissions();",
     "    return permission.receive === \"granted\" ? \"granted\" : permission.receive === \"denied\" ? \"denied\" : \"default\";",
     "  } catch { return \"unsupported\"; }",
     "}",
     "export async function requestNativePushPermission(): Promise<NotificationPermission | \"unsupported\"> {",
     "  if (!isNative() || !ENABLE_NATIVE_PUSH) return \"unsupported\";",
     "  initNativeBridge();",
     "  const result = await setupPushSafely();",
     "  return result === \"granted\" ? \"granted\" : result === \"denied\" ? \"denied\" : \"unsupported\";",
     "}",
     "",
     "async function setupPushSafely(): Promise<NativePermissionState> {"
   ].join("\n"),
   "native permission exports");
 return s;
});
patch("src/hooks/useNotificationPermission.ts","inspectNativePushPermission",original=>{
 let s=once(original,
   'import { registerDeviceToken } from "@/lib/notifications/deviceTokenService";',
   'import { registerDeviceToken } from "@/lib/notifications/deviceTokenService";\nimport { isNative, inspectNativePushPermission, requestNativePushPermission } from "@/lib/nativeBridge";',
   "platform adapters");
 s=once(s,
   "    supported: isPushSupported(),\n    permission: getPushPermission(),",
   "    supported: isNative() || isPushSupported(),\n    permission: isNative() ? \"default\" : getPushPermission(),",
   "initial state");
 s=once(s,
   "    const refresh = () => {\n      if (document.visibilityState !== \"visible\") return;\n      const supported = isPushSupported();\n      const permission = getPushPermission();\n      setState((current) => ({\n        supported,\n        permission,\n        shouldPrompt: supported && permission === \"default\" ? current.shouldPrompt : false,\n      }));\n      if (permission === \"granted\") clearDismissedAt();\n    };",
   [
     "    let active = true;",
     "    const refresh = async () => {",
     "      if (document.visibilityState !== \"visible\") return;",
     "      const native = isNative();",
     "      const permission = native ? await inspectNativePushPermission() : getPushPermission();",
     "      const supported = permission !== \"unsupported\" && (native || isPushSupported());",
     "      if (!active) return;",
     "      setState((current) => ({ supported, permission,",
     "        shouldPrompt: supported && permission === \"default\" ? current.shouldPrompt : false }));",
     "      if (permission === \"granted\") clearDismissedAt();",
     "    };",
     "    void refresh();"
   ].join("\n"),
   "native permission refresh");
 s=once(s,
   "      document.removeEventListener(\"visibilitychange\", refresh);\n      window.removeEventListener(\"focus\", refresh);",
   "      active = false;\n      document.removeEventListener(\"visibilitychange\", refresh);\n      window.removeEventListener(\"focus\", refresh);",
   "cleanup request");
 s=once(s,
   "    const supported = isPushSupported();",
   "    const native = isNative();\n    const supported = native || isPushSupported();",
   "native support request");
 s=once(s,
   "      const perm = await requestPushPermission();",
   "      const perm = native ? await requestNativePushPermission() : await requestPushPermission();",
   "native request");
 s=once(s,
   "      if (perm === \"granted\") {\n        clearDismissedAt();\n        try {\n          await registerDeviceToken();",
   "      if (perm === \"granted\") {\n        clearDismissedAt();\n        try {\n          // No APK o listener registration do nativeBridge registra o token FCM real.\n          if (!native) await registerDeviceToken();",
   "token owner");
 s=once(s,
   "        supported: isPushSupported(),\n        permission: getPushPermission(),",
   "        supported: isNative() || isPushSupported(),\n        permission: isNative() ? \"default\" : getPushPermission(),",
   "error fallback");
 return s;
});
console.log("[OK] INV-041 adaptador de permissao por plataforma; comportamento Android fisico permanece para homologacao.");
