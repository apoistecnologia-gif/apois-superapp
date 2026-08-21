import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const root = process.cwd();
const workspace = '.work/corridas';
const callback = 'br.com.apois.app://auth/corridas-google';
const forwardKey = 'apois-superapp:corridas-google-url';

function file(relative) { return resolve(root, workspace, relative); }

const componentPath = file('src/components/auth/PassengerGoogleLoginButton.tsx');
mkdirSync(dirname(componentPath), { recursive: true });
writeFileSync(componentPath, `import { useEffect, useRef, useState } from "react";\nimport { App, type PluginListenerHandle } from "@capacitor/app";\nimport { Capacitor } from "@capacitor/core";\nimport { Loader2 } from "lucide-react";\nimport { useNavigate } from "@tanstack/react-router";\nimport { toast } from "sonner";\nimport { supabase } from "@/integrations/supabase/client";\nimport { useAuth } from "@/hooks/use-auth";\n\nconst CALLBACK = "${callback}";\nconst FORWARDED_KEY = "${forwardKey}";\n\nfunction paramsFrom(rawUrl: string) {\n  const url = new URL(rawUrl);\n  const params = new URLSearchParams(url.search);\n  const fragment = url.hash.replace(/^#/, "");\n  if (fragment) new URLSearchParams(fragment).forEach((value, key) => { if (!params.has(key)) params.set(key, value); });\n  return params;\n}\n\nexport function PassengerGoogleLoginButton() {\n  const navigate = useNavigate();\n  const { refreshSession } = useAuth();\n  const [loading, setLoading] = useState(false);\n  const listenerRef = useRef<PluginListenerHandle | null>(null);\n\n  const finish = async (rawUrl: string) => {\n    const params = paramsFrom(rawUrl);\n    const providerError = params.get("error_description") || params.get("error");\n    if (providerError) throw new Error(providerError);\n    const code = params.get("code");\n    if (code) {\n      const { error } = await supabase.auth.exchangeCodeForSession(code);\n      if (error) throw error;\n    } else {\n      const accessToken = params.get("access_token");\n      const refreshToken = params.get("refresh_token");\n      if (accessToken && refreshToken) {\n        const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });\n        if (error) throw error;\n      }\n    }\n    const { data: { session } } = await supabase.auth.getSession();\n    if (!session) throw new Error("Sessão Google não confirmada.");\n    await refreshSession();\n    await navigate({ to: "/inicio", replace: true });\n  };\n\n  const handle = async (rawUrl: string) => {\n    if (!rawUrl.startsWith(CALLBACK)) return;\n    try {\n      await (window as any).Capacitor?.Plugins?.Browser?.close?.();\n      await finish(rawUrl);\n    } catch (error) {\n      console.error("[APOIS Passageiro] Google callback failed", error);\n      toast.error("Não foi possível concluir o login com Google.");\n      setLoading(false);\n    }\n  };\n\n  useEffect(() => {\n    let alive = true;\n    void (async () => {\n      if (!Capacitor.isNativePlatform()) return;\n      listenerRef.current = await App.addListener("appUrlOpen", ({ url }) => { if (alive) void handle(url); });\n      const launch = await App.getLaunchUrl();\n      if (launch?.url && alive) void handle(launch.url);\n      try {\n        const forwarded = window.sessionStorage.getItem(FORWARDED_KEY);\n        if (forwarded) { window.sessionStorage.removeItem(FORWARDED_KEY); if (alive) void handle(forwarded); }\n      } catch {}\n    })();\n    return () => { alive = false; void listenerRef.current?.remove(); listenerRef.current = null; };\n  }, []);\n\n  const login = async () => {\n    if (loading) return;\n    setLoading(true);\n    try {\n      const isNative = Capacitor.isNativePlatform();\n      const redirectTo = isNative ? CALLBACK : new URL("/#/login", window.location.origin).toString();\n      const { data, error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo, skipBrowserRedirect: isNative, queryParams: { prompt: "select_account" } } });\n      if (error) throw error;\n      if (isNative) {\n        if (!data.url) throw new Error("URL Google ausente.");\n        const browser = (window as any).Capacitor?.Plugins?.Browser;\n        if (!browser?.open) throw new Error("Navegador nativo indisponível.");\n        await browser.open({ url: data.url });\n      }\n    } catch (error) {\n      console.error("[APOIS Passageiro] Google sign-in failed", error);\n      toast.error("Não foi possível entrar com Google.");\n      setLoading(false);\n    }\n  };\n\n  return <button type="button" disabled={loading} onClick={() => void login()} className="app-pressable flex min-h-13 w-full items-center justify-center gap-3 rounded-2xl border border-white/10 bg-white px-4 text-sm font-black text-black disabled:opacity-60">{loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <span className="text-lg font-black">G</span>}{loading ? "Abrindo Google..." : "Continuar com Google"}</button>;\n}\n`, 'utf8');

const loginPath = file('src/routes/_public.login.tsx');
let login = readFileSync(loginPath, 'utf8');
if (!login.includes('PassengerGoogleLoginButton')) {
  login = login.replace(
    'import { PublicAuthShell } from "@/components/app/PublicAuthShell";',
    'import { PublicAuthShell } from "@/components/app/PublicAuthShell";\nimport { PassengerGoogleLoginButton } from "@/components/auth/PassengerGoogleLoginButton";',
  );
  login = login.replace(
    '          </form>\n        </section>',
    '          </form>\n          <div className="mt-3"><PassengerGoogleLoginButton /></div>\n        </section>',
  );
  writeFileSync(loginPath, login, 'utf8');
}
if (!login.includes('<PassengerGoogleLoginButton />')) throw new Error('[FAIL] corridas: botão Google não inserido no login');
if (!login.includes('to="/recuperar-senha"')) throw new Error('[FAIL] corridas: Esqueci minha senha ausente');
console.log('[OK] corridas: login contém Google + recuperação de senha');
