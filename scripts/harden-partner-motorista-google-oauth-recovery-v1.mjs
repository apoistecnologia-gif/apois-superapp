// APOIS_MOTORISTA_GOOGLE_OAUTH_RECOVERY_V1 — somente cópia de build.
import {readFileSync,writeFileSync} from "node:fs";
import {resolve} from "node:path";
const root=process.env.APOIS_MOTORISTA_WORKSPACE||".work/partner-motorista";
const path=resolve(root,"src/components/DriverGoogleLoginButton.tsx");
let src=readFileSync(path,"utf8");
if(src.includes("APOIS_MOTORISTA_GOOGLE_OAUTH_RECOVERY_V1")){console.log("[OK] OAuth recuperado anteriormente");process.exit(0);}
const pairs=[
  [
    "  const listenerRef = useRef<PluginListenerHandle | null>(null);",
    "  // APOIS_MOTORISTA_GOOGLE_OAUTH_RECOVERY_V1\n  const listenerRef = useRef<PluginListenerHandle | null>(null);\n  const resumeListenerRef = useRef<PluginListenerHandle | null>(null);\n  const pendingRef = useRef(false);\n  const callbackInProgressRef = useRef(false);\n  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);\n  const resetPending = () => {\n    pendingRef.current = false;\n    callbackInProgressRef.current = false;\n    if (timeoutRef.current) clearTimeout(timeoutRef.current);\n    timeoutRef.current = null;\n    setLoading(false);\n  };"
  ],
  [
    "  const handleCallback = async (rawUrl: string) => {\n    if (!rawUrl.startsWith(CALLBACK)) return;\n    try {\n      await Browser.close().catch(() => undefined);\n      await finish(rawUrl);\n    } catch (error) {\n      console.error(\"[APOIS Motorista] Google callback failed\", error);\n      toast.error(\"Não foi possível concluir o login com Google.\");\n      setLoading(false);\n    }\n  };",
    "  const handleCallback = async (rawUrl: string) => {\n    if (!rawUrl.startsWith(CALLBACK)) return;\n    if (callbackInProgressRef.current) return;\n    callbackInProgressRef.current = true;\n    pendingRef.current = false;\n    if (timeoutRef.current) clearTimeout(timeoutRef.current);\n    timeoutRef.current = null;\n    try {\n      await Browser.close().catch(() => undefined);\n      await finish(rawUrl);\n    } catch (error) {\n      console.error(\"[APOIS Motorista] Google callback failed\", error);\n      toast.error(\"O retorno do Google não concluiu o login. Tente novamente.\");\n      resetPending();\n    }\n  };"
  ],
  [
    "      listenerRef.current = await App.addListener(\"appUrlOpen\", ({ url }) => { if (alive) void handleCallback(url); });\n      const launch = await App.getLaunchUrl();",
    "      listenerRef.current = await App.addListener(\"appUrlOpen\", ({ url }) => { if (alive) void handleCallback(url); });\n      resumeListenerRef.current = await App.addListener(\"appStateChange\", ({ isActive }) => {\n        if (!isActive || !alive || !pendingRef.current) return;\n        window.setTimeout(() => {\n          if (alive && pendingRef.current && !callbackInProgressRef.current) {\n            toast.error(\"Login Google não concluído. Verifique a conexão e tente novamente.\");\n            resetPending();\n          }\n        }, 2500);\n      });\n      const launch = await App.getLaunchUrl();"
  ],
  [
    "    return () => { alive = false; void listenerRef.current?.remove(); listenerRef.current = null; };",
    "    return () => {\n      alive = false;\n      void listenerRef.current?.remove();\n      void resumeListenerRef.current?.remove();\n      listenerRef.current = null;\n      resumeListenerRef.current = null;\n      if (timeoutRef.current) clearTimeout(timeoutRef.current);\n    };"
  ],
  [
    "    setLoading(true);\n    try {\n      const isNative = Capacitor.isNativePlatform();",
    "    setLoading(true);\n    pendingRef.current = true;\n    callbackInProgressRef.current = false;\n    if (timeoutRef.current) clearTimeout(timeoutRef.current);\n    timeoutRef.current = setTimeout(() => {\n      if (!pendingRef.current || callbackInProgressRef.current) return;\n      toast.error(\"O Google não respondeu. Tente novamente.\");\n      resetPending();\n    }, 45_000);\n    try {\n      const isNative = Capacitor.isNativePlatform();"
  ],
  [
    "      toast.error(\"Não foi possível entrar com Google.\");\n      setLoading(false);\n    }\n  };",
    "      toast.error(\"Não foi possível entrar com Google.\");\n      resetPending();\n    }\n  };"
  ]
];
for(const [from,to] of pairs){const n=src.split(from).length-1;if(n!==1)throw Error("[FAIL] OAuth Google contrato divergente: "+from.slice(0,110)+" count="+n);src=src.replace(from,to);}
for(const required of ["APOIS_MOTORISTA_GOOGLE_OAUTH_RECOVERY_V1","appStateChange","45_000","resetPending","exchangeCodeForSession","signInWithOAuth"]){if(!src.includes(required))throw Error("[FAIL] Google OAuth faltando "+required);}
writeFileSync(path,src,"utf8");
console.log("[OK] OAuth Google recupera botão após erro, timeout ou fechar navegador.");
