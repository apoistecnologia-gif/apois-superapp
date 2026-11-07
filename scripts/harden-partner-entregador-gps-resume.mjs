import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const workspace = process.env.APOIS_ENTREGAS_WORKSPACE || '.work/partner-entregador';
const path = resolve(root, workspace, 'src/components/CourierLocationTracker.tsx');
let source = readFileSync(path, 'utf8');

if (!source.includes('import { App } from "@capacitor/app";')) {
  const anchor = 'import { Capacitor } from "@capacitor/core";';
  if (!source.includes(anchor)) throw new Error('Entregador Parceiro: import Capacitor não encontrado no rastreador GPS.');
  source = source.replace(anchor, `${anchor}\nimport { App } from "@capacitor/app";`);
}

// Idempotente: `appStateHandle` e `nativeRestartPromise` só podem ser declarados
// uma vez. Rodar este hardener duas vezes duplicava a declaração e o build do
// Vite caía com "Identifier `appStateHandle` has already been declared".
{
  const before = `    let disposed = false;\n    let nativeWatchId: string | null = null;\n    let webWatchId: number | null = null;`;
  const after = `${before}\n    let appStateHandle: { remove: () => Promise<void> } | null = null;\n    let nativeRestartPromise: Promise<void> | null = null;`;
  if (!source.includes(after) && source.includes(before)) {
    source = source.replace(before, after);
  }
  const declarationCount = (source.match(/let appStateHandle/g) ?? []).length;
  if (declarationCount > 1) throw new Error(`Entregador Parceiro: appStateHandle declarado ${declarationCount}x no rastreador GPS`);
}

const oldErrorTail = `      latestPositionRef.current = null;\n      onPosition?.(null);\n      if (permissionDenied) void forceOffline();`;
const newErrorTail = `      // Uma falha temporária de GPS não deve apagar a última posição válida e\n      // desmontar a rota ativa. Só removemos a posição e forçamos offline\n      // quando a permissão realmente foi negada.\n      if (permissionDenied) {\n        latestPositionRef.current = null;\n        onPosition?.(null);\n        void forceOffline();\n      }`;
if (source.includes(oldErrorTail)) source = source.replace(oldErrorTail, newErrorTail);

if (!source.includes('const clearNativeWatch = async () =>')) {
  const anchor = `    const startNativeTracking = async () => {`;
  if (!source.includes(anchor)) throw new Error('Entregador Parceiro: startNativeTracking não encontrado.');
  source = source.replace(
    anchor,
    `    const clearNativeWatch = async () => {\n      const watchId = nativeWatchId;\n      nativeWatchId = null;\n      if (!watchId) return;\n      try {\n        await Geolocation.clearWatch({ id: watchId });\n      } catch (error) {\n        console.warn("courier native GPS watch cleanup failed", error);\n      }\n    };\n\n${anchor}`,
  );
}

if (!source.includes('const restartNativeTracking = async () =>')) {
  const anchor = `    const startWebTracking = () => {`;
  if (!source.includes(anchor)) throw new Error('Entregador Parceiro: startWebTracking não encontrado.');
  const restart = `    const restartNativeTracking = async () => {\n      if (nativeRestartPromise) return nativeRestartPromise;\n      nativeRestartPromise = (async () => {\n        await clearNativeWatch();\n        if (disposed) return;\n        await startNativeTracking();\n      })().finally(() => {\n        nativeRestartPromise = null;\n      });\n      return nativeRestartPromise;\n    };\n\n`;
  source = source.replace(anchor, `${restart}${anchor}`);
}

source = source.replace(
  `    if (isNativeAndroid()) {\n      void startNativeTracking().catch(receiveError);\n    } else {\n      startWebTracking();\n    }`,
  `    if (isNativeAndroid()) {\n      void restartNativeTracking().catch(receiveError);\n      void App.addListener("appStateChange", ({ isActive }) => {\n        if (!isActive || disposed) return;\n        // O Android pode suspender o watcher enquanto o app fica em segundo\n        // plano. Ao voltar, recriamos o watcher e buscamos uma posição fresca.\n        void restartNativeTracking().catch(receiveError);\n      }).then((handle) => {\n        if (disposed) void handle.remove();\n        else appStateHandle = handle;\n      });\n    } else {\n      startWebTracking();\n    }`,
);

source = source.replace(
  `      if (nativeWatchId) void Geolocation.clearWatch({ id: nativeWatchId });\n      if (webWatchId !== null) navigator.geolocation?.clearWatch(webWatchId);`,
  `      void clearNativeWatch();\n      void appStateHandle?.remove();\n      if (webWatchId !== null) navigator.geolocation?.clearWatch(webWatchId);`,
);

for (const marker of [
  'import { App } from "@capacitor/app";',
  'let appStateHandle:',
  'let nativeRestartPromise:',
  'const clearNativeWatch = async () =>',
  'const restartNativeTracking = async () =>',
  'App.addListener("appStateChange"',
  'void restartNativeTracking().catch(receiveError);',
  'Uma falha temporária de GPS não deve apagar a última posição válida',
  'void appStateHandle?.remove();',
]) {
  if (!source.includes(marker)) throw new Error(`[FAIL] Entregador Parceiro: retomada GPS incompleta (${marker}).`);
}

writeFileSync(path, source, 'utf8');
console.log('[OK] Entregador Parceiro: GPS nativo é rearmado ao voltar do segundo plano e falha temporária não desmonta a rota ativa.');
