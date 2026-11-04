import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const workspace = '.work/corridas';

function patch(path, transform, label) {
  const full = resolve(root, workspace, path);
  const before = readFileSync(full, 'utf8');
  const after = transform(before);
  if (after === before) {
    console.log(`[OK] ${label} (já aplicado ou nativo)`);
    return;
  }
  writeFileSync(full, after, 'utf8');
  console.log(`[OK] ${label}`);
}

patch('src/routes/_public.recuperar-senha.tsx', (source) => {
  let next = source;
  if (!next.includes('import { Capacitor } from "@capacitor/core";')) {
    next = next.replace(
      'import { toast } from "sonner";',
      'import { toast } from "sonner";\nimport { Capacitor } from "@capacitor/core";',
    );
  }
  next = next.replace(
    '        redirectTo: `${window.location.origin}/#/redefinir-senha`,',
    '        redirectTo: Capacitor.isNativePlatform()\n          ? "br.com.apois.app://auth/corridas-reset"\n          : `${window.location.origin}/#/redefinir-senha`,',
  );
  return next;
}, 'Corridas: recuperação de senha usa callback nativo do Superapp');

patch('src/routes/_public.redefinir-senha.tsx', (source) => {
  let next = source;
  if (!next.includes('const CORRIDAS_RECOVERY_KEY = "apois-superapp:corridas-recovery-url";')) {
    next = next.replace(
      'export const Route = createFileRoute("/_public/redefinir-senha")({',
      'const CORRIDAS_RECOVERY_KEY = "apois-superapp:corridas-recovery-url";\n\nexport const Route = createFileRoute("/_public/redefinir-senha")({',
    );
  }

  const oldEffect = `  useEffect(() => {\n    // Verificar se o usuário está em um fluxo de recuperação de senha\n    // O Supabase coloca tokens na URL que se transformam em sessão\n    supabase.auth.getSession().then(({ data: { session } }) => {\n      if (session || window.location.hash.includes("access_token=")) {\n        setIsValidSession(true);\n      } else {\n        toast.error("Link de recuperação inválido ou expirado.");\n        navigate({ to: "/login" });\n      }\n    });\n  }, [navigate]);`;
  const newEffect = `  useEffect(() => {\n    let active = true;\n\n    const restoreRecoverySession = async () => {\n      try {\n        let forwarded = "";\n        try {\n          forwarded = window.sessionStorage.getItem(CORRIDAS_RECOVERY_KEY) || "";\n          if (forwarded) window.sessionStorage.removeItem(CORRIDAS_RECOVERY_KEY);\n        } catch {}\n\n        if (forwarded) {\n          const url = new URL(forwarded);\n          const params = new URLSearchParams(url.search);\n          const fragment = url.hash.replace(/^#/, "");\n          if (fragment) {\n            new URLSearchParams(fragment).forEach((value, key) => {\n              if (!params.has(key)) params.set(key, value);\n            });\n          }\n\n          const code = params.get("code");\n          const accessToken = params.get("access_token");\n          const refreshToken = params.get("refresh_token");\n          if (code) {\n            const { error } = await supabase.auth.exchangeCodeForSession(code);\n            if (error) throw error;\n          } else if (accessToken && refreshToken) {\n            const { error } = await supabase.auth.setSession({\n              access_token: accessToken,\n              refresh_token: refreshToken,\n            });\n            if (error) throw error;\n          }\n        }\n\n        const { data: { session } } = await supabase.auth.getSession();\n        if (!active) return;\n        if (session) {\n          setIsValidSession(true);\n          return;\n        }\n        toast.error("Link de recuperação inválido ou expirado.");\n        await navigate({ to: "/login", replace: true });\n      } catch (error) {\n        console.error("[APOIS Passageiro] Falha ao restaurar recuperação de senha", error);\n        if (!active) return;\n        toast.error("Não foi possível validar o link de recuperação.");\n        await navigate({ to: "/login", replace: true });\n      }\n    };\n\n    void restoreRecoverySession();\n    return () => { active = false; };\n  }, [navigate]);`;
  if (next.includes(oldEffect)) next = next.replace(oldEffect, newEffect);
  next = next.replace(
    '          if (forwarded) window.sessionStorage.removeItem(CORRIDAS_RECOVERY_KEY);\n        } catch {}',
    '          if (forwarded) window.sessionStorage.removeItem(CORRIDAS_RECOVERY_KEY);\n        } catch { /* sessionStorage pode estar indisponível; a sessão atual ainda será consultada */ }',
  );
  return next;
}, 'Corridas: redefinição restaura sessão encaminhada pelo shell');

const recover = readFileSync(resolve(root, workspace, 'src/routes/_public.recuperar-senha.tsx'), 'utf8');
const reset = readFileSync(resolve(root, workspace, 'src/routes/_public.redefinir-senha.tsx'), 'utf8');
for (const marker of ['Capacitor.isNativePlatform()', 'br.com.apois.app://auth/corridas-reset']) {
  if (!recover.includes(marker)) throw new Error(`[FAIL] Corridas recovery: ${marker}`);
}
for (const marker of ['CORRIDAS_RECOVERY_KEY', 'exchangeCodeForSession(code)', 'supabase.auth.setSession']) {
  if (!reset.includes(marker)) throw new Error(`[FAIL] Corridas reset: ${marker}`);
}

console.log('[OK] Corridas: recuperação nativa completa sem depender de URL localhost');
