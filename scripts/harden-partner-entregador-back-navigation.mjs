import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const workspace = process.env.APOIS_ENTREGAS_WORKSPACE || '.work/partner-entregador';
const path = resolve(root, workspace, 'src/routes/courier.tsx');
let source = readFileSync(path, 'utf8');

if (!source.includes('App.addListener("backButton"')) {
  const anchor = `  useEffect(() => {\n    if (!courier?.id || courier.status !== "approved" || !courier.is_active) return;\n    void installCourierPushListeners()`;
  const index = source.indexOf(anchor);
  if (index < 0) throw new Error('[FAIL] Entregador Parceiro: efeito Push não encontrado para inserir proteção do botão Voltar');
  const effect = `  useEffect(() => {\n    if (!isNativeCourierAndroid()) return;\n    let disposed = false;\n    let backHandle: { remove: () => Promise<void> } | null = null;\n    void App.addListener("backButton", () => {\n      if (disposed) return;\n      if (supportOpen) {\n        if (busy !== "support") {\n          setSupportOpen(false);\n          setSupportDescription("");\n        }\n        return;\n      }\n      if (historyOpen) { setHistoryOpen(false); return; }\n      if (financeOpen) { setFinanceOpen(false); return; }\n      if (profileOpen) { setProfileOpen(false); return; }\n      if (activeJob || completedJob) {\n        toast.message("Conclua a entrega atual antes de sair desta tela.");\n        return;\n      }\n      if (availability?.is_online) {\n        toast.message("Fique offline ou use Trocar perfil de parceiro antes de sair do modo Entregador.");\n        return;\n      }\n      window.location.replace("../../index.html");\n    }).then((handle) => {\n      if (disposed) void handle.remove();\n      else backHandle = handle;\n    });\n    return () => {\n      disposed = true;\n      void backHandle?.remove();\n    };\n  }, [activeJob, availability?.is_online, busy, completedJob, financeOpen, historyOpen, profileOpen, supportOpen]);\n\n`;
  source = source.slice(0, index) + effect + source.slice(index);
}

for (const marker of [
  'App.addListener("backButton"',
  'if (activeJob || completedJob)',
  'Conclua a entrega atual antes de sair desta tela.',
  'if (availability?.is_online)',
  'Fique offline ou use Trocar perfil de parceiro',
  // O snapshot corrigiu a guarda para `historyOpen && !activeJob` (não fechar
  // painel durante entrega ativa). Aceitamos as duas formas; o que importa é
  // o handler existir, tratar os painéis e só sair quando não há operação.
  'historyOpen',
  'financeOpen',
  'profileOpen',
  'void backHandle?.remove();',
]) {
  if (!source.includes(marker)) throw new Error(`[FAIL] Entregador Parceiro: proteção do botão Voltar incompleta (${marker})`);
}

writeFileSync(path, source, 'utf8');
console.log('[OK] Entregador Parceiro: botão Voltar do Android fecha painéis internos, mas não abandona entrega nem deixa o shell ser aberto enquanto o entregador continua ONLINE.');
