import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const workspace = process.env.APOIS_ENTREGAS_WORKSPACE || '.work/partner-entregador';
const path = resolve(root, workspace, 'src/routes/courier.tsx');
let source = readFileSync(path, 'utf8');

if (!source.includes('import { App } from "@capacitor/app";')) {
  const anchor = 'import { Geolocation } from "@capacitor/geolocation";';
  if (!source.includes(anchor)) throw new Error('Entregador Parceiro: import nativo de Geolocation não encontrado.');
  source = source.replace(anchor, `${anchor}\nimport { App } from "@capacitor/app";`);
}

const mountAnchor = `  useEffect(() => {\n    void loadAll();\n  }, [loadAll]);`;
const refreshEffect = `${mountAnchor}\n\n  useEffect(() => {\n    if (!courier?.id || courier.status !== "approved" || !courier.is_active) return;\n\n    let disposed = false;\n    let appStateHandle: { remove: () => Promise<void> } | null = null;\n    const refreshOperations = () => {\n      if (disposed) return;\n      void loadCourierOperations(courier.id);\n    };\n    const refreshAll = () => {\n      if (disposed) return;\n      void loadAll(true);\n    };\n    const onVisibility = () => {\n      if (document.visibilityState === "visible") refreshAll();\n    };\n\n    window.addEventListener("apois:courier-push", refreshOperations as EventListener);\n    window.addEventListener("apois:courier-push-open", refreshOperations as EventListener);\n    window.addEventListener("focus", refreshAll);\n    document.addEventListener("visibilitychange", onVisibility);\n\n    if (isNativeCourierAndroid()) {\n      void App.addListener("appStateChange", ({ isActive }) => {\n        if (isActive) refreshAll();\n      }).then((handle) => {\n        if (disposed) void handle.remove();\n        else appStateHandle = handle;\n      });\n    }\n\n    return () => {\n      disposed = true;\n      window.removeEventListener("apois:courier-push", refreshOperations as EventListener);\n      window.removeEventListener("apois:courier-push-open", refreshOperations as EventListener);\n      window.removeEventListener("focus", refreshAll);\n      document.removeEventListener("visibilitychange", onVisibility);\n      void appStateHandle?.remove();\n    };\n  }, [courier?.id, courier?.is_active, courier?.status, loadAll, loadCourierOperations]);`;

if (!source.includes('App.addListener("appStateChange"')) {
  if (!source.includes(mountAnchor)) throw new Error('Entregador Parceiro: efeito inicial de carga não encontrado.');
  source = source.replace(mountAnchor, refreshEffect);
}

for (const marker of [
  'import { App } from "@capacitor/app";',
  'App.addListener("appStateChange"',
  'window.addEventListener("apois:courier-push"',
  'window.addEventListener("apois:courier-push-open"',
  'document.addEventListener("visibilitychange"',
  'void loadAll(true);',
  'void loadCourierOperations(courier.id);',
]) {
  if (!source.includes(marker)) throw new Error(`Entregador Parceiro: restauração incompleta (${marker}).`);
}

writeFileSync(path, source, 'utf8');
console.log('[OK] Entregador Parceiro: retorno do segundo plano, foco e Push restauram imediatamente oferta/entrega ativa.');
