import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const workspace = process.env.APOIS_MOTORISTA_WORKSPACE || '.work/partner-motorista';
const path = resolve(root, workspace, 'src/routes/motorista.app.tsx');
let source = readFileSync(path, 'utf8');

if (!source.includes('import { App } from "@capacitor/app";')) {
  const anchor = 'import { createFileRoute, useNavigate } from "@tanstack/react-router";';
  if (!source.includes(anchor)) throw new Error('[FAIL] Motorista Parceiro: import TanStack não encontrado para adicionar App');
  // O import de Capacitor é adicionado pelo hardener de GPS nativo, executado
  // depois deste. Aqui adicionamos somente App para não gerar import duplicado.
  source = source.replace(anchor, `${anchor}\nimport { App } from "@capacitor/app";`);
}

if (!source.includes('App.addListener("backButton"')) {
  const anchor = `  \n  const phase = active?.status;`;
  if (!source.includes(anchor)) throw new Error('[FAIL] Motorista Parceiro: âncora de fase não encontrada para proteção do botão Voltar');
  const effect = `\n  useEffect(() => {\n    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "android") return;\n    let disposed = false;\n    let backHandle: { remove: () => Promise<void> } | null = null;\n    void App.addListener("backButton", () => {\n      if (disposed) return;\n      if (ratingRef.current) {\n        toast.message("Conclua ou pule a avaliação antes de sair desta tela.");\n        return;\n      }\n      if (activeRef.current) {\n        toast.message("Finalize ou cancele a corrida ativa antes de trocar de perfil.");\n        return;\n      }\n      if (incomingRef.current) {\n        toast.message("Responda à chamada de corrida antes de sair desta tela.");\n        return;\n      }\n      if (online) {\n        toast.message("Fique offline ou use Trocar perfil de parceiro antes de sair do modo Motorista.");\n        return;\n      }\n      window.location.replace("../../index.html");\n    }).then((handle) => {\n      if (disposed) void handle.remove();\n      else backHandle = handle;\n    });\n    return () => {\n      disposed = true;\n      void backHandle?.remove();\n    };\n  }, [online]);\n`;
  source = source.replace(anchor, `${effect}${anchor}`);
}

// Migração defensiva: versões anteriores deste hardener podiam ter injetado no
// PRÓPRIO efeito do hardware back a dependência do side menu. Remova somente
// esse acoplamento antigo; o side menu original da tela ainda pode existir neste
// ponto do pipeline e será removido pelo hardener mobile-ui executado depois.
const backStart = source.indexOf('App.addListener("backButton"');
const backEnd = backStart >= 0 ? source.indexOf('  }, [online', backStart) : -1;
if (backStart >= 0 && backEnd > backStart) {
  const prefix = source.slice(0, backStart);
  let backBlock = source.slice(backStart, backEnd + 32);
  const suffix = source.slice(backEnd + 32);
  backBlock = backBlock
    .replace(/\n\s*if \(sideMenuOpen\) \{\n\s*setSideMenuOpen\(false\);\n\s*return;\n\s*\}/g, '')
    .replace(/\[online,\s*sideMenuOpen\]/g, '[online]');
  source = prefix + backBlock + suffix;
}

for (const marker of [
  'import { App } from "@capacitor/app";',
  'App.addListener("backButton"',
  'if (ratingRef.current)',
  'if (activeRef.current)',
  'if (incomingRef.current)',
  'if (online)',
  'Fique offline ou use Trocar perfil de parceiro',
  'window.location.replace("../../index.html")',
  'void backHandle?.remove();',
  '}, [online]);',
]) {
  if (!source.includes(marker)) throw new Error(`[FAIL] Motorista Parceiro: proteção do botão Voltar incompleta (${marker})`);
}

// Valide apenas o efeito injetado pelo hardener. Não examine o arquivo inteiro:
// neste estágio o componente original ainda contém sideMenuOpen e isso é esperado
// até o hardener mobile-ui removê-lo na etapa seguinte.
const finalBackStart = source.indexOf('App.addListener("backButton"');
const finalBackEnd = finalBackStart >= 0 ? source.indexOf('  }, [online]);', finalBackStart) : -1;
const finalBackBlock = finalBackStart >= 0 && finalBackEnd > finalBackStart
  ? source.slice(finalBackStart, finalBackEnd + '  }, [online]);'.length)
  : '';
if (!finalBackBlock) {
  throw new Error('[FAIL] Motorista Parceiro: bloco final do hardware back não pôde ser isolado');
}
if (/\bsideMenuOpen\b|\bsetSideMenuOpen\b/.test(finalBackBlock)) {
  throw new Error('[FAIL] Motorista Parceiro: proteção do botão Voltar ainda referencia o menu paralelo removido');
}

writeFileSync(path, source, 'utf8');
console.log('[OK] Motorista Parceiro: botão Voltar do Android protege chamada/corrida/avaliação/presença ONLINE sem depender do menu paralelo removido.');
