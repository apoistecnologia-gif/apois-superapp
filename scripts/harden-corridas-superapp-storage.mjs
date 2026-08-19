import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

function replaceRequired(path, search, replacement, label) {
  const full = resolve(path);
  const before = readFileSync(full, 'utf8');
  if (before.includes(replacement)) {
    console.log(`[OK] ${label} (já aplicado)`);
    return;
  }
  if (!before.includes(search)) {
    console.error(`[FAIL] ${label}: padrão esperado não encontrado em ${path}`);
    process.exit(1);
  }
  writeFileSync(full, before.replace(search, replacement), 'utf8');
  console.log(`[OK] ${label}`);
}

replaceRequired(
  '.work/corridas/src/services/destinations/destination-storage.ts',
  'const getProjectTokenKey = () => {\n  const url = (supabase as any).supabaseUrl || "";\n  const projectRef = url.split(".")[0]?.split("//")[1] || "unknown";\n  return `sb-${projectRef}-auth-token`;\n};',
  'const SUPERAPP_CORRIDAS_AUTH_STORAGE_KEY = "apois-superapp-corridas-auth-v1";',
  'Corridas: histórico/favoritos usam a mesma sessão isolada configurada no cliente Supabase',
);

replaceRequired(
  '.work/corridas/src/services/destinations/destination-storage.ts',
  '    const tokenKey = getProjectTokenKey();\n    const session = localStorage.getItem(tokenKey);\n    if (session) {\n      try {\n        const parsed = JSON.parse(session);\n        return parsed.user.id;\n      } catch (e) {\n        return "unknown";\n      }\n    }\n    return "anonymous";',
  '    const session = localStorage.getItem(SUPERAPP_CORRIDAS_AUTH_STORAGE_KEY);\n    if (session) {\n      try {\n        const parsed = JSON.parse(session);\n        const userId = parsed?.user?.id ?? parsed?.currentSession?.user?.id ?? parsed?.session?.user?.id;\n        return typeof userId === "string" && userId.trim() ? userId : "unknown";\n      } catch {\n        return "unknown";\n      }\n    }\n    return "anonymous";',
  'Corridas: favoritos e recentes ficam vinculados ao usuário autenticado do Superapp',
);

replaceRequired(
  '.work/corridas/src/services/push/push-service.ts',
  'const DEVICE_ID_KEY = "apois-push-device-id";',
  'const DEVICE_ID_KEY = "apois-superapp-corridas:push-device-id";',
  'Corridas: identificador lógico do dispositivo não colide com outros produtos no mesmo WebView',
);

console.log('[OK] Corridas: storage operacional isolado por módulo/usuário no Superapp');
