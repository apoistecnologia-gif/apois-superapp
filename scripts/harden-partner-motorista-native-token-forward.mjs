import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const workspace = process.env.APOIS_MOTORISTA_WORKSPACE || '.work/partner-motorista';
const path = resolve(root, workspace, 'src/lib/driverNativeLocation.ts');
let source = readFileSync(path, 'utf8');

if (!source.includes('APOIS_PARTNER_DRIVER_NATIVE_TOKEN_FORWARD')) {
  source += `\n\n// APOIS_PARTNER_DRIVER_NATIVE_TOKEN_FORWARD\n// Enquanto o motorista permanece operacional, o auto-refresh da WebView pode\n// rotacionar o refresh_token antes do Foreground Service. Reenvie o par novo ao\n// Service para os dois lados não divergirem quando o app for para background.\nfunction driverOperationalForNativeTokenForward(): boolean {\n  try {\n    return localStorage.getItem("apois-parceiro:operational-role") === "motorista";\n  } catch {\n    return false;\n  }\n}\n\nfunction forwardDriverSessionToNative(session: { access_token: string; refresh_token: string }): void {\n  if (!isNativeAndroidDriverLocation() || !driverOperationalForNativeTokenForward()) return;\n  const supabaseUrl = String(import.meta.env.VITE_SUPABASE_URL || "").trim();\n  const publishableKey = String(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "").trim();\n  if (!supabaseUrl || !publishableKey || !session.access_token || !session.refresh_token) return;\n  void DriverLocation.start({\n    supabaseUrl,\n    publishableKey,\n    accessToken: session.access_token,\n    refreshToken: session.refresh_token,\n  }).catch((error: unknown) => {\n    if (import.meta.env.DEV) console.warn("[APOIS MOTORISTA] sessão renovada não foi repassada ao GPS nativo:", error);\n  });\n}\n\nsupabase.auth.onAuthStateChange((event, session) => {\n  if (event !== "TOKEN_REFRESHED" || !session) return;\n  // Não execute trabalho nativo dentro do callback síncrono do Auth.\n  globalThis.setTimeout(() => forwardDriverSessionToNative(session), 0);\n});\n`;
}

for (const marker of [
  'APOIS_PARTNER_DRIVER_NATIVE_TOKEN_FORWARD',
  'event !== "TOKEN_REFRESHED"',
  'apois-parceiro:operational-role',
  'DriverLocation.start({',
  'globalThis.setTimeout(() => forwardDriverSessionToNative(session), 0)',
]) {
  if (!source.includes(marker)) throw new Error(`[FAIL] Motorista Parceiro: forward do refresh token para GPS nativo incompleto (${marker})`);
}

writeFileSync(path, source, 'utf8');
console.log('[OK] Motorista Parceiro: TOKEN_REFRESHED da WebView é repassado ao DriverLocationService enquanto a função permanece operacional.');
