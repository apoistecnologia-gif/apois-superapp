// APOIS Relatorio 03 - hardening de notificacoes no workspace Motorista/Admin.
// Nao modifica submodulos nem conecta a APIs externas. Idempotente e fail-closed.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
const workspace = resolve(process.cwd(), process.env.APOIS_MOTORISTA_WORKSPACE || ".work/partner-motorista");
function once(s, oldValue, newValue, label) {
  const n = s.split(oldValue).length - 1;
  if (n !== 1) throw new Error("[INV03] " + label + " anchor " + n);
  return s.replace(oldValue, newValue);
}
function patch(relative, marker, transform) {
  const file = resolve(workspace, relative);
  if (!existsSync(file)) throw new Error("[INV03] missing " + relative);
  const original = readFileSync(file, "utf8");
  if (original.includes(marker)) return;
  const next = transform(original);
  if (next === original || !next.includes(marker)) throw new Error("[INV03] incomplete " + relative);
  writeFileSync(file, next);
  console.log("[OK] INV03 " + relative);
}
patch("src/lib/notifications/notificationPreferences.ts", "getNotificationPreferenceIdentity", (original) => {
  let s=original;
  const start=s.indexOf("function writeLocal(");
  const end=s.indexOf("\nasync function resolveIdentity", start);
  if(start<0||end<0)throw new Error("[INV03] writeLocal missing");
  let body=s.slice(start,end);
  body=once(body, "): void {", "): boolean {", "writeLocal return type");
  body=once(body, "JSON.stringify(prefs));", "JSON.stringify(prefs));\n    return true;", "writeLocal success");
  body=once(body, "    if (import.meta.env.DEV) console.warn(\"[APOIS notifications] local preference storage unavailable\", error);",
    "    if (import.meta.env.DEV) console.warn(\"[APOIS notifications] local preference storage unavailable\", error);\n    return false;", "writeLocal failure");
  s=s.slice(0,start)+body+s.slice(end);
  s=once(s, "export async function fetchPreferences(): Promise<NotificationPreferences> {",
    "// INV-037: Auth identity for cache, Domain identity for FK logging.\nexport async function getNotificationPreferenceIdentity(): Promise<{ authUserId: string; mobilityUserId: string }> {\n  return resolveIdentity();\n}\n\nexport async function fetchPreferences(): Promise<NotificationPreferences> {", "identity export");
  s=once(s, "export async function savePreferences(prefs: Partial<NotificationPreferences>): Promise<void> {",
    "export async function savePreferences(prefs: Partial<NotificationPreferences>): Promise<{ localSaved: boolean }> {", "save return type");
  s=once(s, "  writeLocal(authUserId, { sound: merged.sound, vibration: merged.vibration });",
    "  return { localSaved: writeLocal(authUserId, { sound: merged.sound, vibration: merged.vibration }) };",
    "local persistence result");
  return s;
});
patch("src/lib/notifications/notificationService.ts", "cacheGeneration += 1;", (original) => {
  let s=once(original,
    'import { fetchPreferences, type NotificationPreferences } from "./notificationPreferences";',
    'import { fetchPreferences, getNotificationPreferenceIdentity, type NotificationPreferences } from "./notificationPreferences";',
    "identity import");
  s=once(s,
    "let prefsInFlight: Promise<NotificationPreferences> | null = null;",
    "let prefsInFlight: { identity: string; generation: number; promise: Promise<NotificationPreferences> } | null = null;\nlet cachedIdentity: string | null = null;\nlet cacheGeneration = 0;",
    "in-flight identity");
  const start=s.indexOf("async function getPrefs(): Promise<NotificationPreferences> {");
  const end=s.indexOf("\nfunction vibrate(",start);
  if(start<0||end<0)throw new Error("[INV03] getPrefs missing");
  const replacement=[
    "async function getPrefs(): Promise<NotificationPreferences> {",
    "  const identity = (await getNotificationPreferenceIdentity()).authUserId;",
    "  const generation = cacheGeneration;",
    "  const now = Date.now();",
    "  if (cachedIdentity === identity && cachedPrefs && cachedAt > 0 && now >= cachedAt && now - cachedAt < 60_000) return cachedPrefs;",
    "  if (prefsInFlight?.identity === identity && prefsInFlight.generation === generation) return prefsInFlight.promise;",
    "  const request = fetchPreferences().then(async (preferences) => {",
    "    if (generation !== cacheGeneration || (await getNotificationPreferenceIdentity()).authUserId !== identity) throw new Error(\"notification_preferences_stale\");",
    "    cachedIdentity = identity;",
    "    cachedPrefs = preferences;",
    "    cachedAt = Date.now();",
    "    return preferences;",
    "  }).finally(() => {",
    "    if (prefsInFlight?.promise === request) prefsInFlight = null;",
    "  });",
    "  prefsInFlight = { identity, generation, promise: request };",
    "  return request;",
    "}",
    "",
    "export function invalidatePreferencesCache() {",
    "  cacheGeneration += 1;",
    "  cachedIdentity = null;",
    "  cachedPrefs = null;",
    "  cachedAt = 0;",
    "  prefsInFlight = null;",
    "}",
    ""
  ].join("\n");
  s=s.slice(0,start)+replacement+s.slice(end);
  s=once(s,
    "    const userId = cleanText(auth?.user?.id, 128);",
    "    // notification_logs.user_id referencia public.users(id), nao auth.users(id).\n    const userId = cleanText((await getNotificationPreferenceIdentity()).mobilityUserId, 128);",
    "correct log FK");
  s=once(s,"    showPush({","    const display = showPush({","push display");
  s=once(s,
    "      force: payload.force === true,\n    });\n    vibrate(prefs);",
    "      force: payload.force === true,\n    });\n    if (display !== \"shown\") {\n      void log({ ...payload, title }, display === \"error\" ? \"error\" : \"suppressed\", \"web_\" + display);\n      return;\n    }\n    vibrate(prefs);",
    "no fictitious success");
  return s;
});
patch("src/lib/pushNotifications.ts", "export type PushShowResult =", (original) => {
  let s=once(original,
    "export function showPush({ title, body, tag, url, force = false }: PushOptions): void {",
    "export type PushShowResult = \"shown\" | \"unsupported\" | \"permission_denied\" | \"foreground\" | \"invalid_title\" | \"error\";\nexport function showPush({ title, body, tag, url, force = false }: PushOptions): PushShowResult {",
    "showPush return type");
  s=once(s,
    "  if (!isPushSupported()) return;\n  if (getPushPermission() !== \"granted\") return;\n  if (!force && typeof document !== \"undefined\" && document.visibilityState === \"visible\") return;",
    "  if (!isPushSupported()) return \"unsupported\";\n  if (getPushPermission() !== \"granted\") return \"permission_denied\";\n  if (!force && typeof document !== \"undefined\" && document.visibilityState === \"visible\") return \"foreground\";",
    "showPush suppressions");
  s=once(s,"  if (!safeTitle) return;","  if (!safeTitle) return \"invalid_title\";","empty title");
  s=once(s,
    "    };\n  } catch (error) {\n    if (import.meta.env.DEV) console.warn(\"[APOIS Push] falha ao exibir notificação\", error);\n  }\n}",
    "    };\n    return \"shown\";\n  } catch (error) {\n    if (import.meta.env.DEV) console.warn(\"[APOIS Push] falha ao exibir notificação\", error);\n    return \"error\";\n  }\n}",
    "web constructor failure");
  return s;
});
patch("src/components/notifications/NotificationPreferencesPage.tsx","channelError, setChannelError",(original)=>{
  let s=once(original,
    "  const [saved, setSaved] = useState(false);",
    "  const [saved, setSaved] = useState(false);\n  const [channelError, setChannelError] = useState<string | null>(null);",
    "partial UI state");
  s=once(s,
    "    setSaved(false);\n    setError(null);\n  }\n\n  async function onSave()",
    "    setSaved(false);\n    setError(null);\n    setChannelError(null);\n  }\n\n  async function onSave()",
    "partial UI reset");
  s=once(s,
    "      await savePreferences(prefs);\n      invalidatePreferencesCache();\n      setSavedPrefs(prefs);\n      setSaved(true);",
    [
      "      const persisted = await savePreferences(prefs);",
      "      invalidatePreferencesCache();",
      "      if (!persisted.localSaved) {",
      "        setSavedPrefs({ ...prefs, sound: savedPrefs.sound, vibration: savedPrefs.vibration });",
      "        setChannelError(\"Categorias salvas. Som e vibração não puderam ser gravados neste aparelho. Tente salvar novamente.\");",
      "        setSaved(false);",
      "      } else {",
      "        setSavedPrefs(prefs);",
      "        setChannelError(null);",
      "        setSaved(true);",
      "      }"
    ].join("\n"),
    "partial save");
  s=once(s,
    '          <div className="mt-6 flex min-w-0 flex-wrap items-center justify-end gap-3">',
    '          {channelError ? <p className="mt-3 text-sm text-red-300" role="alert">{channelError}</p> : null}\n          <div className="mt-6 flex min-w-0 flex-wrap items-center justify-end gap-3">',
    "UI partial warning");
  return s;
});
patch("src/lib/adminNotifications.functions.ts","const MAX_RECIPIENTS = 100;",original=>{
  let s=once(original,"const MAX_RECIPIENTS = 50_000;","const MAX_RECIPIENTS = 100;","Admin limit");
  s=once(s,"      failed_users?: number;","      failed_users?: number;\n      failed?: number;\n      processed?: number;","Admin response");
  s=once(s,
    "    return {\n      ok: payload.ok !== false,",
    "    return {\n      ok: payload.ok !== false,\n      processed: payload.processed == null ? null : Number(payload.processed),",
    "process ack");
  s=once(s,
    "      failed: Number(payload.failed_users ?? 0),",
    "      failed: Number(payload.failed_users ?? payload.failed ?? 0),",
    "failed contract");
  return s;
});
console.log("[OK] Relatorio 03: notificacoes do Motorista/Admin tratadas em " + workspace);
