import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const root = process.cwd();
const workspace = process.env.APOIS_MOTORISTA_WORKSPACE || '.work/motorista-test';
const isPartner = workspace.includes('partner-motorista');

function file(relative) { return resolve(root, workspace, relative); }

const packagePath = file('package.json');
const pkg = JSON.parse(readFileSync(packagePath, 'utf8'));
pkg.dependencies = { ...(pkg.dependencies || {}), '@capacitor/browser': pkg.dependencies?.['@capacitor/browser'] || '^8.0.0' };
writeFileSync(packagePath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
console.log('[OK] motorista: Browser nativo disponível para OAuth Google');

// O projeto nativo do Motorista já registra apoismotorista://auth/redefinir-senha.
// O Google usa o mesmo scheme, mas outro path; portanto o snapshot Android da
// cópia .work também precisa receber /google antes do cap sync.
const nativeManifestPath = file('android-motorista/app/src/main/AndroidManifest.xml');
if (existsSync(nativeManifestPath)) {
  let manifest = readFileSync(nativeManifestPath, 'utf8');
  if (!manifest.includes('android:pathPrefix="/google"')) {
    const filter = `\n            <intent-filter android:autoVerify="false">\n                <action android:name="android.intent.action.VIEW" />\n                <category android:name="android.intent.category.DEFAULT" />\n                <category android:name="android.intent.category.BROWSABLE" />\n                <data android:scheme="apoismotorista" android:host="auth" android:pathPrefix="/google" />\n            </intent-filter>`;
    manifest = manifest.replace('</activity>', `${filter}\n        </activity>`);
    writeFileSync(nativeManifestPath, manifest, 'utf8');
  }
  if (!manifest.includes('android:pathPrefix="/google"')) throw new Error('[FAIL] motorista: intent-filter Google não aplicado');
  console.log('[OK] motorista: Android recebe apoismotorista://auth/google');
}

if (isPartner) {
  const recoveryPath = file('src/lib/auth/driverPasswordRecovery.ts');
  let recovery = readFileSync(recoveryPath, 'utf8');
  if (!recovery.includes('apois-parceiro:motorista-recovery-url')) {
    recovery = recovery.replace(
      'export const DRIVER_PASSWORD_RECOVERY_REDIRECT = "apoismotorista://auth/redefinir-senha";',
      'export const DRIVER_PASSWORD_RECOVERY_REDIRECT = "apoismotorista://auth/redefinir-senha";\nconst PARTNER_FORWARDED_RECOVERY_KEY = "apois-parceiro:motorista-recovery-url";',
    );
    recovery = recovery.replace(
      '    try {\n      const launchUrl = await App.getLaunchUrl();\n      if (launchUrl?.url) await handle({ url: launchUrl.url });\n    } catch (error) {',
      '    try {\n      const launchUrl = await App.getLaunchUrl();\n      if (launchUrl?.url) await handle({ url: launchUrl.url });\n      try {\n        const forwardedUrl = window.sessionStorage.getItem(PARTNER_FORWARDED_RECOVERY_KEY);\n        if (forwardedUrl) {\n          window.sessionStorage.removeItem(PARTNER_FORWARDED_RECOVERY_KEY);\n          await handle({ url: forwardedUrl });\n        }\n      } catch { /* appUrlOpen/getLaunchUrl continuam ativos */ }\n    } catch (error) {',
    );
    writeFileSync(recoveryPath, recovery, 'utf8');
  }
  if (!recovery.includes('PARTNER_FORWARDED_RECOVERY_KEY')) throw new Error('[FAIL] motorista parceiro: encaminhamento de recuperação não aplicado');
  console.log('[OK] motorista parceiro: link de recuperação encaminhado pelo shell');
}

const componentPath = file('src/components/DriverGoogleLoginButton.tsx');
mkdirSync(dirname(componentPath), { recursive: true });
writeFileSync(componentPath, `import { useEffect, useRef, useState } from "react";\nimport { App, type PluginListenerHandle } from "@capacitor/app";\nimport { Browser } from "@capacitor/browser";\nimport { Capacitor } from "@capacitor/core";\nimport { Loader2 } from "lucide-react";\nimport { useNavigate } from "@tanstack/react-router";\nimport { toast } from "sonner";\nimport { supabase } from "@/integrations/supabase/client";\nimport { loadDriverProfile } from "@/lib/driverProfile";\n\nconst CALLBACK = "apoismotorista://auth/google";\nconst FORWARDED_KEY = "apois-parceiro:motorista-google-url";\n\nfunction readParams(rawUrl: string) {\n  const url = new URL(rawUrl);\n  const params = new URLSearchParams(url.search);\n  const fragment = url.hash.replace(/^#/, "");\n  if (fragment) new URLSearchParams(fragment).forEach((value, key) => { if (!params.has(key)) params.set(key, value); });\n  return params;\n}\n\nexport function DriverGoogleLoginButton() {\n  const navigate = useNavigate();\n  const [loading, setLoading] = useState(false);\n  const listenerRef = useRef<PluginListenerHandle | null>(null);\n\n  const finish = async (rawUrl: string) => {\n    const params = readParams(rawUrl);\n    const providerError = params.get("error_description") || params.get("error");\n    if (providerError) throw new Error(providerError);\n    const code = params.get("code");\n    if (code) {\n      const { error } = await supabase.auth.exchangeCodeForSession(code);\n      if (error) throw error;\n    } else {\n      const accessToken = params.get("access_token");\n      const refreshToken = params.get("refresh_token");\n      if (accessToken && refreshToken) {\n        const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });\n        if (error) throw error;\n      }\n    }\n    const { data: { session } } = await supabase.auth.getSession();\n    if (!session) throw new Error("Sessão Google não confirmada.");\n    const profile = await loadDriverProfile();\n    if (!profile.ok) {\n      if (profile.reason === "not_found") { await navigate({ to: "/motorista/cadastro", replace: true }); return; }\n      throw new Error(profile.message || "Não foi possível validar o cadastro de motorista.");\n    }\n    await navigate({ to: profile.profile.approval_status === "aprovado" ? "/motorista/app" : "/motorista/status", replace: true });\n  };\n\n  const handleCallback = async (rawUrl: string) => {\n    if (!rawUrl.startsWith(CALLBACK)) return;\n    try {\n      await Browser.close().catch(() => undefined);\n      await finish(rawUrl);\n    } catch (error) {\n      console.error("[APOIS Motorista] Google callback failed", error);\n      toast.error("Não foi possível concluir o login com Google.");\n      setLoading(false);\n    }\n  };\n\n  useEffect(() => {\n    let alive = true;\n    void (async () => {\n      if (!Capacitor.isNativePlatform()) {\n        const params = new URLSearchParams(window.location.search);\n        if (params.has("code")) { setLoading(true); await finish(window.location.href).catch(() => setLoading(false)); }\n        return;\n      }\n      listenerRef.current = await App.addListener("appUrlOpen", ({ url }) => { if (alive) void handleCallback(url); });\n      const launch = await App.getLaunchUrl();\n      if (launch?.url && alive) void handleCallback(launch.url);\n      try {\n        const forwarded = window.sessionStorage.getItem(FORWARDED_KEY);\n        if (forwarded) { window.sessionStorage.removeItem(FORWARDED_KEY); if (alive) void handleCallback(forwarded); }\n      } catch {}\n    })();\n    return () => { alive = false; void listenerRef.current?.remove(); listenerRef.current = null; };\n  }, []);\n\n  const login = async () => {\n    if (loading) return;\n    setLoading(true);\n    try {\n      const isNative = Capacitor.isNativePlatform();\n      // O APK Parceiro pode expor origin http://localhost:3000 no WebView.\n      // OAuth nativo nunca deve usar esse origin como retorno: o callback\n      // precisa voltar pelo scheme registrado no Android.\n      const redirectTo = isNative ? CALLBACK : new URL("/motorista/login", window.location.origin).toString();\n      const { data, error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo, skipBrowserRedirect: isNative, queryParams: { prompt: "select_account" } } });\n      if (error) throw error;\n      if (isNative) {\n        if (!data.url) throw new Error("URL Google ausente.");\n        await Browser.open({ url: data.url });\n      }\n    } catch (error) {\n      console.error("[APOIS Motorista] Google sign-in failed", error);\n      toast.error("Não foi possível entrar com Google.");\n      setLoading(false);\n    }\n  };\n\n  return <button type="button" disabled={loading} onClick={() => void login()} className="flex min-h-[56px] w-full items-center justify-center gap-3 rounded-[17px] border border-white/12 bg-white px-4 py-3 text-[14px] font-black text-black disabled:opacity-60">{loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <span className="text-lg font-black">G</span>}{loading ? "Abrindo Google..." : "Continuar com Google"}</button>;\n}\n`, 'utf8');
{
  const generated = readFileSync(componentPath, 'utf8')
    .replace('import { App, type PluginListenerHandle } from "@capacitor/app";', 'import { App } from "@capacitor/app";')
    .replace('import { Capacitor } from "@capacitor/core";', 'import { Capacitor, type PluginListenerHandle } from "@capacitor/core";')
    .replace('import { useEffect, useRef, useState } from "react";', 'import { useCallback, useEffect, useRef, useState } from "react";')
    .replace(
      'export function DriverGoogleLoginButton() {',
      `function isDriverCallback(rawUrl: string) {\n  try {\n    const callback = new URL(rawUrl);\n    return callback.protocol === "apoismotorista:" && callback.hostname === "auth" && callback.pathname === "/google";\n  } catch {\n    return false;\n  }\n}\n\nfunction singlePkceCode(params: URLSearchParams) {\n  const codes = params.getAll("code");\n  return codes.length === 1 && codes[0]?.trim() ? codes[0] : null;\n}\n\nexport function DriverGoogleLoginButton() {`,
    )
    .replace(
      '  const finish = async (rawUrl: string) => {',
      '  const finish = useCallback(async (rawUrl: string) => {',
    )
    .replace(
      `    const code = params.get("code");\n    if (code) {\n      const { error } = await supabase.auth.exchangeCodeForSession(code);\n      if (error) throw error;\n    } else {\n      const accessToken = params.get("access_token");\n      const refreshToken = params.get("refresh_token");\n      if (accessToken && refreshToken) {\n        const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });\n        if (error) throw error;\n      }\n    }`,
      `    if (params.has("access_token") || params.has("refresh_token")) throw new Error("google_callback_tokens_rejected");\n    const code = singlePkceCode(params);\n    if (!code) throw new Error("google_callback_without_single_code");\n    const { error } = await supabase.auth.exchangeCodeForSession(code);\n    if (error) throw error;`,
    )
    .replace(
      '  };\n\n  const handleCallback = async (rawUrl: string) => {\n    if (!rawUrl.startsWith(CALLBACK)) return;',
      '  }, [navigate]);\n\n  const handleCallback = useCallback(async (rawUrl: string) => {\n    if (!isDriverCallback(rawUrl)) return;',
    )
    .replace(
      '  };\n\n  useEffect(() => {',
      '  }, [finish]);\n\n  useEffect(() => {',
    )
    .replace('      } catch {}', '      } catch { /* appUrlOpen/getLaunchUrl continuam ativos */ }')
    .replace('  }, []);\n\n  const login = async () => {', '  }, [finish, handleCallback]);\n\n  const login = async () => {');
  for (const marker of ['google_callback_tokens_rejected', 'function singlePkceCode', 'codes.length === 1', 'function isDriverCallback', 'callback.pathname === "/google"', '}, [finish, handleCallback]);']) {
    if (!generated.includes(marker)) throw new Error(`[FAIL] motorista: OAuth Google endurecido incompleto (${marker})`);
  }
  writeFileSync(componentPath, generated, 'utf8');
}
console.log('[OK] motorista: componente Google exige callback PKCE exato e remove listeners corretamente');
{
  const generated = readFileSync(componentPath, 'utf8');
  if (!generated.includes('const redirectTo = isNative ? CALLBACK :')) throw new Error('[FAIL] motorista: OAuth Google nativo não força callback apoismotorista');
  if (generated.includes('const redirectTo = new URL("/motorista/login", window.location.origin).toString();')) throw new Error('[FAIL] motorista: OAuth Google pode retornar ao origin localhost do WebView');
  console.log('[OK] motorista: OAuth Google nativo não pode retornar para localhost');
}


const loginPath = file('src/routes/motorista.login.tsx');
let login = readFileSync(loginPath, 'utf8');
if (!login.includes('DriverGoogleLoginButton')) {
  login = login.replace(
    'import { MovviLogo } from "@/components/MovviLogo";',
    'import { MovviLogo } from "@/components/MovviLogo";\nimport { DriverGoogleLoginButton } from "@/components/DriverGoogleLoginButton";',
  );
  login = login.replace(
    '</form>\n\n        <div className="mt-5 min-w-0 text-center">',
    '</form>\n        <div className="mt-3"><DriverGoogleLoginButton /></div>\n\n        <div className="mt-5 min-w-0 text-center">',
  );
  writeFileSync(loginPath, login, 'utf8');
}
if (!login.includes('<DriverGoogleLoginButton />')) throw new Error('[FAIL] motorista: botão Google não inserido no login');
if (!login.includes('to="/motorista/recuperar-senha"')) throw new Error('[FAIL] motorista: link Esqueci minha senha não está presente');
console.log('[OK] motorista: login contém Google + Esqueci minha senha');
