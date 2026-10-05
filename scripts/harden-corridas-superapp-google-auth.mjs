import './harden-corridas-auth-profile-resolution.mjs';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const root = process.cwd();
const workspace = '.work/corridas';
const callback = 'br.com.apois.app://auth/callback';
const legacyCallback = 'br.com.apois.app://auth/corridas-google';
const forwardedKey = 'apois-superapp:corridas-google-url';
const pendingProductKey = 'apois-superapp:pending-oauth-product';

function file(relative) { return resolve(root, workspace, relative); }

const clientPath = file('src/integrations/supabase/client.ts');
let client = readFileSync(clientPath, 'utf8');
if (!client.includes('flowType: "pkce"')) {
  const anchor = '      detectSessionInUrl: true,';
  if (!client.includes(anchor)) throw new Error('[FAIL] corridas: configuração Auth do Supabase mudou; não foi possível ativar PKCE');
  client = client.replace(anchor, `${anchor}\n      flowType: "pkce",`);
  writeFileSync(clientPath, client, 'utf8');
}
if (!client.includes('flowType: "pkce"')) throw new Error('[FAIL] corridas: flowType pkce ausente');
console.log('[OK] corridas: cliente Supabase efetivo usa PKCE');

const componentPath = file('src/components/auth/PassengerGoogleLoginButton.tsx');
mkdirSync(dirname(componentPath), { recursive: true });
writeFileSync(componentPath, `import { useEffect, useRef, useState } from "react";\nimport { App, type PluginListenerHandle } from "@capacitor/app";\nimport { Capacitor } from "@capacitor/core";\nimport { Loader2 } from "lucide-react";\nimport { toast } from "sonner";\nimport { supabase } from "@/integrations/supabase/client";\n\nconst CALLBACK = "${callback}";\nconst LEGACY_CALLBACK = "${legacyCallback}";\nconst FORWARDED_KEY = "${forwardedKey}";\nconst PENDING_PRODUCT_KEY = "${pendingProductKey}";\n\nfunction browserPlugin() {\n  return (window as any).Capacitor?.Plugins?.Browser;\n}\n\nfunction isCorridasCallback(rawUrl: string) {\n  return rawUrl.startsWith(CALLBACK) || rawUrl.startsWith(LEGACY_CALLBACK);\n}\n\nfunction clearPendingProduct() {\n  try { window.localStorage.removeItem(PENDING_PRODUCT_KEY); } catch {}\n}\n\nfunction paramsFrom(rawUrl: string) {\n  const url = new URL(rawUrl);\n  const params = new URLSearchParams(url.search);\n  const fragment = url.hash.replace(/^#/, \"\");\n  if (fragment) new URLSearchParams(fragment).forEach((value, key) => { if (!params.has(key)) params.set(key, value); });\n  return params;\n}\n\nexport function PassengerGoogleLoginButton() {\n  const [loading, setLoading] = useState(false);\n  const appUrlListenerRef = useRef<PluginListenerHandle | null>(null);\n  const browserFinishedListenerRef = useRef<{ remove: () => Promise<void> } | null>(null);\n  const handlingRef = useRef(false);\n  const handledUrlRef = useRef<string | null>(null);\n\n  const finish = async (rawUrl: string) => {\n    const params = paramsFrom(rawUrl);\n    const providerError = params.get(\"error_description\") || params.get(\"error\");\n    if (providerError) throw new Error(providerError);\n\n    const code = params.get(\"code\");\n    if (code) {\n      const { error } = await supabase.auth.exchangeCodeForSession(code);\n      if (error) throw error;\n    } else {\n      const accessToken = params.get(\"access_token\");\n      const refreshToken = params.get(\"refresh_token\");\n      if (!accessToken || !refreshToken) throw new Error(\"google_callback_without_session\");\n      const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });\n      if (error) throw error;\n    }\n\n    const { data: { session } } = await supabase.auth.getSession();\n    if (!session?.user) throw new Error(\"google_session_not_confirmed\");\n    clearPendingProduct();\n    try { window.localStorage.removeItem(FORWARDED_KEY); } catch {}\n    toast.success(\"Login com Google realizado!\");\n    window.location.replace(\"./index.html#/inicio\");\n  };\n\n  const handle = async (rawUrl: string) => {\n    if (!isCorridasCallback(rawUrl)) return;\n    if (handlingRef.current || handledUrlRef.current === rawUrl) return;\n    handlingRef.current = true;\n    handledUrlRef.current = rawUrl;\n    try {\n      await browserPlugin()?.close?.().catch(() => undefined);\n      await finish(rawUrl);\n    } catch (error) {\n      clearPendingProduct();\n      console.error(\"[APOIS Passageiro] Google callback failed\", error);\n      toast.error(\"Não foi possível concluir o login com Google. Tente novamente.\");\n    } finally {\n      handlingRef.current = false;\n      setLoading(false);\n    }\n  };\n\n  useEffect(() => {\n    let alive = true;\n    void (async () => {\n      if (!Capacitor.isNativePlatform()) return;\n      appUrlListenerRef.current = await App.addListener(\"appUrlOpen\", ({ url }) => { if (alive) void handle(url); });\n\n      const browser = browserPlugin();\n      if (browser?.addListener) {\n        browserFinishedListenerRef.current = await browser.addListener(\"browserFinished\", () => {\n          if (!alive || handlingRef.current) return;\n          // Não apague o envelope aqui: no Android browserFinished pode chegar\n          // antes de appUrlOpen/getLaunchUrl. O TTL expira sozinho e um novo OAuth sobrescreve o produto pendente.\n          setLoading(false);\n        });\n      }\n\n      const launch = await App.getLaunchUrl();\n      if (launch?.url && alive) void handle(launch.url);\n      try {\n        const forwarded = window.localStorage.getItem(FORWARDED_KEY);\n        if (forwarded) {\n          window.localStorage.removeItem(FORWARDED_KEY);\n          if (alive) void handle(forwarded);\n        }\n      } catch {}\n    })();\n    return () => {\n      alive = false;\n      void appUrlListenerRef.current?.remove();\n      appUrlListenerRef.current = null;\n      void browserFinishedListenerRef.current?.remove();\n      browserFinishedListenerRef.current = null;\n    };\n  }, []);\n\n  const login = async () => {\n    if (loading) return;\n    handledUrlRef.current = null;\n    setLoading(true);\n    try {\n      const isNative = Capacitor.isNativePlatform();\n      const redirectTo = isNative ? CALLBACK : new URL(\"/#/login\", window.location.origin).toString();\n      if (isNative) {\n        try { window.localStorage.setItem(PENDING_PRODUCT_KEY, JSON.stringify({ product: \"corridas\", createdAt: Date.now() })); } catch {}\n      }\n      const { data, error } = await supabase.auth.signInWithOAuth({\n        provider: \"google\",\n        options: {\n          redirectTo,\n          skipBrowserRedirect: isNative,\n          queryParams: { prompt: \"select_account\" },\n        },\n      });\n      if (error) throw error;\n      if (isNative) {\n        if (!data.url) throw new Error(\"google_url_missing\");\n        const browser = browserPlugin();\n        if (!browser?.open) throw new Error(\"native_browser_unavailable\");\n        await browser.open({ url: data.url });\n      }\n    } catch (error) {\n      clearPendingProduct();\n      console.error(\"[APOIS Passageiro] Google sign-in failed\", error);\n      toast.error(\"Não foi possível entrar com Google.\");\n      setLoading(false);\n    }\n  };\n\n  return (\n    <button\n      type=\"button\"\n      disabled={loading}\n      onClick={() => void login()}\n      className=\"mt-3 flex min-h-14 w-full items-center justify-center gap-3 rounded-xl border border-zinc-700 bg-white px-4 text-sm font-black text-black transition active:scale-[0.99] disabled:opacity-60\"\n      aria-label=\"Continuar com Google\"\n    >\n      {loading ? <Loader2 className=\"h-5 w-5 animate-spin\" /> : <span className=\"text-lg font-black\">G</span>}\n      {loading ? \"Abrindo Google...\" : \"Continuar com Google\"}\n    </button>\n  );\n}\n`, 'utf8');

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

const component = readFileSync(componentPath, 'utf8');
for (const marker of [
  'exchangeCodeForSession(code)',
  'handledUrlRef.current === rawUrl',
  'browserFinished',
  'App.getLaunchUrl()',
  'appUrlListenerRef.current?.remove()',
  'browserFinishedListenerRef.current?.remove()',
  'JSON.stringify({ product: "corridas", createdAt: Date.now() })',
]) {
  if (!component.includes(marker)) throw new Error(`[FAIL] corridas Google OAuth incompleto: ${marker}`);
}
if (!login.includes('import { PassengerGoogleLoginButton }')) throw new Error('[FAIL] corridas: import do Google Login não foi inserido');
if (!login.includes('<PassengerGoogleLoginButton />')) throw new Error('[FAIL] corridas: botão Google não foi inserido no login atual');
if (!login.includes('to="/recuperar-senha"')) throw new Error('[FAIL] corridas: recuperação de senha desapareceu');
if (!login.includes('window.location.replace("./index.html#/inicio")')) throw new Error('[FAIL] corridas: navegação pós-login não é determinística');
if (!login.includes('existing.session?.user')) throw new Error('[FAIL] corridas: sessão válida não é preservada em erro tardio de login');
console.log('[OK] corridas: Google OAuth usa PKCE, callback deduplicado, browserFinished e cleanup determinístico');
