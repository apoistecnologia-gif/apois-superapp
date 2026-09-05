import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const root = process.cwd();
const workspace = '.work/corridas';
const callback = 'br.com.apois.app://auth/callback';
const legacyCallback = 'br.com.apois.app://auth/corridas-google';
const forwardedKey = 'apois-superapp:corridas-google-url';
const pendingProductKey = 'apois-superapp:pending-oauth-product';

function file(relative) { return resolve(root, workspace, relative); }

const componentPath = file('src/components/auth/PassengerGoogleLoginButton.tsx');
mkdirSync(dirname(componentPath), { recursive: true });
writeFileSync(componentPath, `import { useEffect, useRef, useState } from "react";\nimport { App, type PluginListenerHandle } from "@capacitor/app";\nimport { Capacitor } from "@capacitor/core";\nimport { Loader2 } from "lucide-react";\nimport { toast } from "sonner";\nimport { supabase } from "@/integrations/supabase/client";\n\nconst CALLBACK = "${callback}";\nconst LEGACY_CALLBACK = "${legacyCallback}";\nconst FORWARDED_KEY = "${forwardedKey}";\nconst PENDING_PRODUCT_KEY = "${pendingProductKey}";\n\nfunction browserPlugin() {\n  return (window as any).Capacitor?.Plugins?.Browser;\n}\n\nfunction isCorridasCallback(rawUrl: string) {\n  return rawUrl.startsWith(CALLBACK) || rawUrl.startsWith(LEGACY_CALLBACK);\n}\n\nfunction clearPendingProduct() {\n  try { window.localStorage.removeItem(PENDING_PRODUCT_KEY); } catch {}\n}\n\nfunction paramsFrom(rawUrl: string) {\n  const url = new URL(rawUrl);\n  const params = new URLSearchParams(url.search);\n  const fragment = url.hash.replace(/^#/, \"\");\n  if (fragment) new URLSearchParams(fragment).forEach((value, key) => { if (!params.has(key)) params.set(key, value); });\n  return params;\n}\n\nexport function PassengerGoogleLoginButton() {\n  const [loading, setLoading] = useState(false);\n  const listenerRef = useRef<PluginListenerHandle | null>(null);\n  const handlingRef = useRef(false);\n\n  const finish = async (rawUrl: string) => {\n    if (handlingRef.current) return;\n    handlingRef.current = true;\n    try {\n      const params = paramsFrom(rawUrl);\n      const providerError = params.get(\"error_description\") || params.get(\"error\");\n      if (providerError) throw new Error(providerError);\n\n      const code = params.get(\"code\");\n      if (code) {\n        const { error } = await supabase.auth.exchangeCodeForSession(code);\n        if (error) throw error;\n      } else {\n        const accessToken = params.get(\"access_token\");\n        const refreshToken = params.get(\"refresh_token\");\n        if (!accessToken || !refreshToken) throw new Error(\"google_callback_without_session\");\n        const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });\n        if (error) throw error;\n      }\n\n      const { data: { session } } = await supabase.auth.getSession();\n      if (!session?.user) throw new Error(\"google_session_not_confirmed\");\n      clearPendingProduct();\n      try { window.localStorage.removeItem(FORWARDED_KEY); } catch {}\n      toast.success(\"Login com Google realizado!\");\n      window.location.replace(\"./index.html#/inicio\");\n      return;\n    } finally {\n      handlingRef.current = false;\n      setLoading(false);\n    }\n  };\n\n  const handle = async (rawUrl: string) => {\n    if (!isCorridasCallback(rawUrl)) return;\n    try {\n      await browserPlugin()?.close?.().catch(() => undefined);\n      await finish(rawUrl);\n    } catch (error) {\n      clearPendingProduct();\n      console.error(\"[APOIS Passageiro] Google callback failed\", error);\n      toast.error(\"Não foi possível concluir o login com Google.\");\n      setLoading(false);\n    }\n  };\n\n  useEffect(() => {\n    let alive = true;\n    void (async () => {\n      if (!Capacitor.isNativePlatform()) return;\n      listenerRef.current = await App.addListener(\"appUrlOpen\", ({ url }) => { if (alive) void handle(url); });\n      const launch = await App.getLaunchUrl();\n      if (launch?.url && alive) void handle(launch.url);\n      try {\n        const forwarded = window.localStorage.getItem(FORWARDED_KEY);\n        if (forwarded) {\n          window.localStorage.removeItem(FORWARDED_KEY);\n          if (alive) void handle(forwarded);\n        }\n      } catch {}\n    })();\n    return () => { alive = false; void listenerRef.current?.remove(); listenerRef.current = null; };\n  }, []);\n\n  const login = async () => {\n    if (loading) return;\n    setLoading(true);\n    try {\n      const isNative = Capacitor.isNativePlatform();\n      const redirectTo = isNative ? CALLBACK : new URL(\"/#/login\", window.location.origin).toString();\n      if (isNative) {\n        try { window.localStorage.setItem(PENDING_PRODUCT_KEY, \"corridas\"); } catch {}\n      }\n      const { data, error } = await supabase.auth.signInWithOAuth({\n        provider: \"google\",\n        options: {\n          redirectTo,\n          skipBrowserRedirect: isNative,\n          queryParams: { prompt: \"select_account\" },\n        },\n      });\n      if (error) throw error;\n      if (isNative) {\n        if (!data.url) throw new Error(\"google_url_missing\");\n        const browser = browserPlugin();\n        if (!browser?.open) throw new Error(\"native_browser_unavailable\");\n        await browser.open({ url: data.url });\n      }\n    } catch (error) {\n      clearPendingProduct();\n      console.error(\"[APOIS Passageiro] Google sign-in failed\", error);\n      toast.error(\"Não foi possível entrar com Google.\");\n      setLoading(false);\n    }\n  };\n\n  return (\n    <button\n      type=\"button\"\n      disabled={loading}\n      onClick={() => void login()}\n      className=\"mt-3 flex min-h-14 w-full items-center justify-center gap-3 rounded-xl border border-zinc-700 bg-white px-4 text-sm font-black text-black transition active:scale-[0.99] disabled:opacity-60\"\n      aria-label=\"Continuar com Google\"\n    >\n      {loading ? <Loader2 className=\"h-5 w-5 animate-spin\" /> : <span className=\"text-lg font-black\">G</span>}\n      {loading ? \"Abrindo Google...\" : \"Continuar com Google\"}\n    </button>\n  );\n}\n`, 'utf8');

const loginPath = file('src/routes/_public.login.tsx');
let login = readFileSync(loginPath, 'utf8');
if (!login.includes('PassengerGoogleLoginButton')) {
  login = login.replace(
    'import { useAuth } from "@/hooks/use-auth";',
    'import { useAuth } from "@/hooks/use-auth";\nimport { PassengerGoogleLoginButton } from "@/components/auth/PassengerGoogleLoginButton";',
  );
  login = login.replace(
    '        </form>\n\n        <div className="mt-10 flex flex-col gap-1 text-center">',
    '        </form>\n\n        <div className="w-full"><PassengerGoogleLoginButton /></div>\n\n        <div className="mt-10 flex flex-col gap-1 text-center">',
  );
}

login = login.replace(
  `      if (error) {\n        console.error("[Login] signIn failed", {\n          name: error.name,\n          status: error.status,\n          code: (error as { code?: string }).code,\n          message: error.message,\n        });\n        toast.error(friendlyLoginError(error.message));\n        return;\n      }`,
  `      if (error) {\n        const { data: existing } = await supabase.auth.getSession();\n        if (existing.session?.user) {\n          window.location.replace("./index.html#/inicio");\n          return;\n        }\n        console.error("[Login] signIn failed", {\n          name: error.name,\n          status: error.status,\n          code: (error as { code?: string }).code,\n          message: error.message,\n        });\n        toast.error(friendlyLoginError(error.message));\n        return;\n      }`,
);

login = login.replace(
  '      toast.success("Login realizado com sucesso!");\n      await navigate({ to: "/inicio", replace: true });',
  '      toast.success("Login realizado com sucesso!");\n      window.location.replace("./index.html#/inicio");\n      return;',
);
login = login.replace(
  '      toast.success("Login realizado com sucesso!");\n      void navigate({ to: "/inicio", replace: true });',
  '      toast.success("Login realizado com sucesso!");\n      window.location.replace("./index.html#/inicio");\n      return;',
);

login = login.replace(
  `    } catch (error) {\n      console.error("[Login] unexpected failure", {\n        message: error instanceof Error ? error.message : "unknown_error",\n      });\n      toast.error("Falha de conexão com o servidor. Tente novamente.");\n    } finally {`,
  `    } catch (error) {\n      const { data: existing } = await supabase.auth.getSession();\n      if (existing.session?.user) {\n        window.location.replace("./index.html#/inicio");\n        return;\n      }\n      console.error("[Login] unexpected failure", {\n        message: error instanceof Error ? error.message : "unknown_error",\n      });\n      toast.error("Falha de conexão com o servidor. Tente novamente.");\n    } finally {`,
);

writeFileSync(loginPath, login, 'utf8');

if (!login.includes('import { PassengerGoogleLoginButton }')) throw new Error('[FAIL] corridas: import do Google Login não foi inserido');
if (!login.includes('<PassengerGoogleLoginButton />')) throw new Error('[FAIL] corridas: botão Google não foi inserido no login atual');
if (!login.includes('to="/recuperar-senha"')) throw new Error('[FAIL] corridas: recuperação de senha desapareceu');
if (!login.includes('window.location.replace("./index.html#/inicio")')) throw new Error('[FAIL] corridas: navegação pós-login não é determinística');
if (!login.includes('existing.session?.user')) throw new Error('[FAIL] corridas: sessão válida não é preservada em erro tardio de login');
console.log('[OK] corridas: Google e senha usam roteamento persistente e preservam sessão válida');
