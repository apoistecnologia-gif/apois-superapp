import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const workspace = process.env.APOIS_ENTREGAS_WORKSPACE || '.work/partner-entregador';
const path = resolve(root, workspace, 'src/lib/courierNativeLocation.ts');

const source = `import { Capacitor, registerPlugin } from "@capacitor/core";
import { supabase } from "@/integrations/supabase/client";

type StartResult = { started?: boolean };
type StopResult = { stopped?: boolean };
type NativeSessionResult = { accessToken?: string; refreshToken?: string };
interface CourierLocationPlugin {
  start(options: { supabaseUrl: string; publishableKey: string; accessToken: string; refreshToken: string }): Promise<StartResult>;
  stop(): Promise<StopResult>;
  session(): Promise<NativeSessionResult>;
}
const CourierLocation = registerPlugin<CourierLocationPlugin>("CourierLocation");

export function isNativeCourierLocation(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
}

function decodeJwtClaims(token: string): { sub: string | null; exp: number } | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const json = JSON.parse(atob(padded)) as { sub?: unknown; exp?: unknown };
    const sub = typeof json.sub === "string" ? json.sub : null;
    const exp = Number(json.exp ?? 0);
    return { sub, exp: Number.isFinite(exp) ? exp : 0 };
  } catch {
    return null;
  }
}

function localSupabaseSessionSnapshot(): { userId: string | null; accessToken: string } {
  try {
    const url = String(import.meta.env["VITE_SUPABASE_URL"] ?? "").trim();
    if (!url) return { userId: null, accessToken: "" };
    const ref = new URL(url).hostname.split(".")[0]?.trim();
    if (!ref) return { userId: null, accessToken: "" };
    const raw = localStorage.getItem(\`sb-\${ref}-auth-token\`);
    if (!raw) return { userId: null, accessToken: "" };
    const parsed = JSON.parse(raw) as { user?: { id?: unknown }; access_token?: unknown };
    return {
      userId: typeof parsed?.user?.id === "string" ? parsed.user.id : null,
      accessToken: typeof parsed?.access_token === "string" ? parsed.access_token : "",
    };
  } catch {
    return { userId: null, accessToken: "" };
  }
}

async function adoptNewerNativeSession(): Promise<void> {
  if (!isNativeCourierLocation()) return;
  const local = localSupabaseSessionSnapshot();
  if (!local.userId) return;

  const native = await CourierLocation.session().catch(() => null);
  const accessToken = native?.accessToken?.trim() || "";
  const refreshToken = native?.refreshToken?.trim() || "";
  if (!accessToken || !refreshToken) return;

  const nativeClaims = decodeJwtClaims(accessToken);
  if (!nativeClaims?.sub || nativeClaims.sub !== local.userId) return;
  const localExp = decodeJwtClaims(local.accessToken)?.exp ?? 0;
  if (nativeClaims.exp <= localExp) return;

  const synced = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
  if (synced.error) throw synced.error;
}

export async function startCourierNativeLocation(): Promise<boolean> {
  if (!isNativeCourierLocation()) return false;
  await adoptNewerNativeSession();

  let sessionResult = await supabase.auth.getSession();
  if (sessionResult.error || !sessionResult.data.session) return false;
  let session = sessionResult.data.session;
  const expiresSoon = typeof session.expires_at === "number" && session.expires_at * 1000 < Date.now() + 120_000;
  if (expiresSoon) {
    const refreshed = await supabase.auth.refreshSession();
    if (refreshed.error || !refreshed.data.session) return false;
    session = refreshed.data.session;
  }

  const supabaseUrl = String(import.meta.env["VITE_SUPABASE_URL"] ?? "").trim();
  const publishableKey = String(import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"] ?? "").trim();
  if (!supabaseUrl || !publishableKey) return false;
  const result = await CourierLocation.start({
    supabaseUrl,
    publishableKey,
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
  });
  return result.started === true;
}

export async function stopCourierNativeLocation(): Promise<void> {
  if (!isNativeCourierLocation()) return;
  await CourierLocation.stop();
}
`;

writeFileSync(path, source, 'utf8');
const final = readFileSync(path, 'utf8');
for (const marker of [
  'session(): Promise<NativeSessionResult>',
  'function localSupabaseSessionSnapshot()',
  'async function adoptNewerNativeSession()',
  'nativeClaims.sub !== local.userId',
  'nativeClaims.exp <= localExp',
  'supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })',
  'await adoptNewerNativeSession();',
]) {
  if (!final.includes(marker)) throw new Error(`[FAIL] Entregador Parceiro: sincronização de sessão nativa incompleta (${marker})`);
}
console.log('[OK] Entregador Parceiro: WebView adota refresh token mais novo do CourierLocationService da mesma conta antes de getSession/auto-refresh.');
