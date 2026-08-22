import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const workspace = process.env.APOIS_ENTREGAS_WORKSPACE || '.work/partner-entregador';
const path = resolve(root, workspace, 'src/lib/courierNativeLocation.ts');
let source = readFileSync(path, 'utf8');

if (!source.includes('updateSession(options: { accessToken: string; refreshToken: string })')) {
  const anchor = '  session(): Promise<NativeSessionResult>;';
  if (!source.includes(anchor)) throw new Error('[FAIL] Entregador Parceiro: interface nativa sem session() antes do token-forward');
  source = source.replace(anchor, `${anchor}\n  updateSession(options: { accessToken: string; refreshToken: string }): Promise<{ updated?: boolean }>;`);
}

if (!source.includes('APOIS_PARTNER_COURIER_NATIVE_TOKEN_FORWARD')) {
  source += `\n\n// APOIS_PARTNER_COURIER_NATIVE_TOKEN_FORWARD\nfunction courierOperationalForNativeTokenForward(): boolean {\n  try {\n    return localStorage.getItem("apois-parceiro:operational-role") === "entregador";\n  } catch {\n    return false;\n  }\n}\n\nfunction forwardCourierSessionToNative(session: { access_token: string; refresh_token: string }): void {\n  if (!isNativeCourierLocation() || !courierOperationalForNativeTokenForward()) return;\n  if (!session.access_token || !session.refresh_token) return;\n  void CourierLocation.updateSession({\n    accessToken: session.access_token,\n    refreshToken: session.refresh_token,\n  }).catch((error: unknown) => {\n    if (import.meta.env.DEV) console.warn("[APOIS ENTREGADOR] sessão renovada não foi repassada ao GPS nativo:", error);\n  });\n}\n\nsupabase.auth.onAuthStateChange((event, session) => {\n  if (event !== "TOKEN_REFRESHED" || !session) return;\n  globalThis.setTimeout(() => forwardCourierSessionToNative(session), 0);\n});\n`;
}

for (const marker of [
  'updateSession(options: { accessToken: string; refreshToken: string })',
  'APOIS_PARTNER_COURIER_NATIVE_TOKEN_FORWARD',
  'event !== "TOKEN_REFRESHED"',
  'apois-parceiro:operational-role',
  'CourierLocation.updateSession({',
  'globalThis.setTimeout(() => forwardCourierSessionToNative(session), 0)',
]) {
  if (!source.includes(marker)) throw new Error(`[FAIL] Entregador Parceiro: forward do refresh token para GPS nativo incompleto (${marker})`);
}
if (source.includes('APOIS_PARTNER_COURIER_NATIVE_TOKEN_FORWARD') && source.includes('CourierLocation.start({\n    supabaseUrl')) {
  throw new Error('[FAIL] Entregador Parceiro: TOKEN_REFRESHED ainda tenta reiniciar Foreground Service em vez de apenas atualizar sessão');
}

writeFileSync(path, source, 'utf8');
console.log('[OK] Entregador Parceiro: TOKEN_REFRESHED atualiza a sessão do CourierLocationService sem reiniciar o FGS.');
