import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const workspace = process.env.APOIS_MOTORISTA_WORKSPACE || '.work/partner-motorista';
const path = resolve(root, workspace, 'src/routes/motorista.app.tsx');
let source = readFileSync(path, 'utf8');

if (!source.includes('import { App } from "@capacitor/app";')) {
  const anchor = 'import { createFileRoute, useNavigate } from "@tanstack/react-router";';
  if (!source.includes(anchor)) throw new Error('[FAIL] Motorista Parceiro: import TanStack não encontrado para adicionar App');
  source = source.replace(anchor, `${anchor}\nimport { App } from "@capacitor/app";\nimport { Capacitor } from "@capacitor/core";`);
}

if (!source.includes('App.addListener("backButton"')) {
  const anchor = `  \n  const phase = active?.status;`;
  if (!source.includes(anchor)) throw new Error('[FAIL] Motorista Parceiro: âncora de fase não encontrada para proteção do botão Voltar');
  const effect = `\n  useEffect(() => {\n    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "android") return;\n    let disposed = false;\n    let backHandle: { remove: () => Promise<void> } | null = null;\n    void App.addListener("backButton", () => {\n      if (disposed) return;\n      if (sideMenuOpen) {\n        setSideMenuOpen(false);\n        return;\n      }\n      if (ratingRef.current) {\n        toast.message("Conclua ou pule a avaliação antes de sair desta tela.");\n        return;\n      }\n      if (activeRef.current) {\n        toast.message("Finalize ou cancele a corrida ativa antes de trocar de perfil.");\n        return;\n      }\n      if (incomingRef.current) {\n        toast.message("Responda à chamada de corrida antes de sair desta tela.");\n        return;\n      }\n      if (online) {\n        toast.message("Fique offline ou use Trocar perfil de parceiro antes de sair do modo Motorista.");\n        return;\n      }\n      window.location.replace("../../index.html");\n    }).then((handle) => {\n      if (disposed) void handle.remove();\n      else backHandle = handle;\n    });\n    return () => {\n      disposed = true;\n      void backHandle?.remove();\n    };\n  }, [online, sideMenuOpen]);\n`;
  source = source.replace(anchor, `${effect}${anchor}`);
}

for (const marker of [
  'import { App } from "@capacitor/app";',
  'App.addListener("backButton"',
  'if (ratingRef.current)',
  'if (activeRef.current)',
  'if (incomingRef.current)',
  'if (online)',
  'Fique offline ou use Trocar perfil de parceiro',
  'void backHandle?.remove();',
]) {
  if (!source.includes(marker)) throw new Error(`[FAIL] Motorista Parceiro: proteção do botão Voltar incompleta (${marker})`);
}

writeFileSync(path, source, 'utf8');
console.log('[OK] Motorista Parceiro: botão Voltar do Android não abandona chamada, corrida, avaliação nem presença ONLINE; fora da operação retorna ao seletor Parceiro.');
