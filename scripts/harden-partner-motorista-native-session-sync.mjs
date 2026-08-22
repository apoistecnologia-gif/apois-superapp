import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const workspace = process.env.APOIS_MOTORISTA_WORKSPACE || '.work/partner-motorista';
const path = resolve(root, workspace, 'src/lib/driverNativeLocation.ts');

// A sessão Supabase também é usada pelo Foreground Service. Quando o serviço
// renova refresh_token em background, a WebView precisa adotar o par mais novo
// antes de tentar renovar o token antigo. Caso contrário, uma jornada longa pode
// derrubar a sessão quando o app volta ao foreground.
const source = `import { Capacitor, registerPlugin } from "@capacitor/core";
import { supabase } from "@/integrations/supabase/client";

type StartResult = { started?: boolean };
type StopResult = { stopped?: boolean };
type NativeSessionResult = { accessToken?: string; refreshToken?: string };

interface DriverLocationPlugin {
  start(options: {
    supabaseUrl: string;
    publishableKey: string;
    accessToken: string;
    refreshToken: string;
  }): Promise<StartResult>;
  stop(): Promise<StopResult>;
  session(): Promise<NativeSessionResult>;
}

const DriverLocation = registerPlugin<DriverLocationPlugin>("DriverLocation");

export function isNativeAndroidDriverLocation(): boolean {
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

function localSupabaseUserId(): string | null {
  try {
    const url = String(import.meta.env.VITE_SUPABASE_URL || "").trim();
    if (!url) return null;
    const ref = new URL(url).hostname.split(".")[0]?.trim();
    if (!ref) return null;
    const raw = localStorage.getItem(\`sb-\${ref}-auth-token\`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { user?: { id?: unknown } };
    return typeof parsed?.user?.id === "string" ? parsed.user.id : null;
  } catch {
    return null;
  }
}

async function adoptNewerNativeSession(): Promise<void> {
  if (!isNativeAndroidDriverLocation()) return;
  const expectedUserId = localSupabaseUserId();
  if (!expectedUserId) return;

  const native = await DriverLocation.session().catch(() => null);
  const accessToken = native?.accessToken?.trim() || "";
  const refreshToken = native?.refreshToken?.trim() || "";
  if (!accessToken || !refreshToken) return;

  const nativeClaims = decodeJwtClaims(accessToken);
  if (!nativeClaims?.sub || nativeClaims.sub !== expectedUserId) return;

  // Lê o access_token local diretamente sem acionar refresh automático. Assim
  // conseguimos substituir o refresh_token rotacionado pelo Service ANTES de
  // supabase.auth.getSession() tentar renovar o token antigo.
  let localExp = 0;
  try {
    const url = String(import.meta.env.VITE_SUPABASE_URL || "").trim();
    const ref = new URL(url).hostname.split(".")[0]?.trim();
    const raw = ref ? localStorage.getItem(\`sb-\${ref}-auth-token\`) : null;
    const parsed = raw ? JSON.parse(raw) as { access_token?: unknown } : null;
    const localAccess = typeof parsed?.access_token === "string" ? parsed.access_token : "";
    localExp = decodeJwtClaims(localAccess)?.exp ?? 0;
  } catch { /* mantém exp 0 */ }

  if (nativeClaims.exp <= localExp) return;
  const synced = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
  if (synced.error) throw synced.error;
}

async function ensureForegroundLocationPermission(): Promise<boolean> {
  const { Geolocation } = await import("@capacitor/geolocation");
  let permission = await Geolocation.checkPermissions();
  const alreadyGranted = permission.location === "granted" || permission.coarseLocation === "granted";
  if (alreadyGranted) return true;

  if (
    permission.location === "prompt" ||
    permission.location === "prompt-with-rationale" ||
    permission.coarseLocation === "prompt" ||
    permission.coarseLocation === "prompt-with-rationale"
  ) {
    permission = await Geolocation.requestPermissions({ permissions: ["location"] });
  }

  return permission.location === "granted" || permission.coarseLocation === "granted";
}

export async function startNativeDriverLocation(): Promise<boolean> {
  if (!isNativeAndroidDriverLocation()) return false;
  const permissionGranted = await ensureForegroundLocationPermission();
  if (!permissionGranted) return false;

  await adoptNewerNativeSession();
  const sessionResult = await supabase.auth.getSession();
  let session = sessionResult.data.session;
  if (sessionResult.error || !session) return false;

  const expiresSoon = typeof session.expires_at === "number" && session.expires_at * 1000 < Date.now() + 120_000;
  if (expiresSoon) {
    const refreshed = await supabase.auth.refreshSession();
    if (refreshed.error || !refreshed.data.session) return false;
    session = refreshed.data.session;
  }

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
  const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "";
  if (!supabaseUrl || !publishableKey) return false;

  const result = await DriverLocation.start({
    supabaseUrl,
    publishableKey,
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
  });
  return result.started === true;
}

export async function stopNativeDriverLocation(): Promise<void> {
  if (!isNativeAndroidDriverLocation()) return;
  await DriverLocation.stop();
}
`;

writeFileSync(path, source, 'utf8');
const final = readFileSync(path, 'utf8');
for (const marker of [
  'session(): Promise<NativeSessionResult>',
  'function localSupabaseUserId()',
  'async function adoptNewerNativeSession()',
  'nativeClaims.sub !== expectedUserId',
  'nativeClaims.exp <= localExp',
  'supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })',
  'await adoptNewerNativeSession();',
]) {
  if (!final.includes(marker)) throw new Error(`[FAIL] Motorista Parceiro: sincronização de sessão nativa incompleta (${marker})`);
}
console.log('[OK] Motorista Parceiro: WebView adota refresh token mais novo do DriverLocationService da mesma conta antes de getSession/auto-refresh.');
