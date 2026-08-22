import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const workspace = process.env.APOIS_MOTORISTA_WORKSPACE || '.work/partner-motorista';
const path = resolve(root, workspace, 'src/lib/driverNativeLocation.ts');
let source = readFileSync(path, 'utf8');

if (!source.includes('updateSession(options: { accessToken: string; refreshToken: string })')) {
  const anchor = '  session(): Promise<NativeSessionResult>;';
  if (!source.includes(anchor)) throw new Error('[FAIL] Motorista Parceiro: interface nativa sem session() antes do token-forward');
  source = source.replace(anchor, `${anchor}\n  updateSession(options: { accessToken: string; refreshToken: string }): Promise<{ updated?: boolean }>;`);
}

if (!source.includes('APOIS_PARTNER_DRIVER_NATIVE_TOKEN_FORWARD')) {
  source += `\n\n// APOIS_PARTNER_DRIVER_NATIVE_TOKEN_FORWARD\n// A WebView e o FGS podem renovar a mesma sessão em momentos diferentes. Quando\n// a WebView recebe TOKEN_REFRESHED, atualize somente as credenciais persistidas\n// que o Service lê antes da próxima RPC; não reinicie startForegroundService.\nfunction driverOperationalForNativeTokenForward(): boolean {\n  try {\n    return localStorage.getItem("apois-parceiro:operational-role") === "motorista";\n  } catch {\n    return false;\n  }\n}\n\nfunction forwardDriverSessionToNative(session: { access_token: string; refresh_token: string }): void {\n  if (!isNativeAndroidDriverLocation() || !driverOperationalForNativeTokenForward()) return;\n  if (!session.access_token || !session.refresh_token) return;\n  void DriverLocation.updateSession({\n    accessToken: session.access_token,\n    refreshToken: session.refresh_token,\n  }).catch((error: unknown) => {\n    if (import.meta.env.DEV) console.warn("[APOIS MOTORISTA] sessão renovada não foi repassada ao GPS nativo:", error);\n  });\n}\n\nsupabase.auth.onAuthStateChange((event, session) => {\n  if (event !== "TOKEN_REFRESHED" || !session) return;\n  globalThis.setTimeout(() => forwardDriverSessionToNative(session), 0);\n});\n`;
}

for (const marker of [
  'updateSession(options: { accessToken: string; refreshToken: string })',
  'APOIS_PARTNER_DRIVER_NATIVE_TOKEN_FORWARD',
  'event !== "TOKEN_REFRESHED"',
  'apois-parceiro:operational-role',
  'DriverLocation.updateSession({',
  'globalThis.setTimeout(() => forwardDriverSessionToNative(session), 0)',
]) {
  if (!source.includes(marker)) throw new Error(`[FAIL] Motorista Parceiro: forward do refresh token para GPS nativo incompleto (${marker})`);
}
if (source.includes('APOIS_PARTNER_DRIVER_NATIVE_TOKEN_FORWARD') && source.includes('DriverLocation.start({\n    supabaseUrl')) {
  throw new Error('[FAIL] Motorista Parceiro: TOKEN_REFRESHED ainda tenta reiniciar Foreground Service em vez de apenas atualizar sessão');
}

writeFileSync(path, source, 'utf8');
console.log('[OK] Motorista Parceiro: TOKEN_REFRESHED atualiza a sessão do DriverLocationService sem reiniciar o FGS.');
