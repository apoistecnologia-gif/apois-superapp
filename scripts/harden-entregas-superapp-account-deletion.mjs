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
    throw new Error(`${label}: padrão esperado não encontrado em ${path}`);
  }
  writeFileSync(full, before.replace(search, replacement), 'utf8');
  console.log(`[OK] ${label}`);
}

const path = '.work/entregas/src/routes/perfil/dados-pessoais.tsx';

replaceRequired(
  path,
  `  const deactivateAccount = async () => {\n    if (deactivating) return;\n    const confirmation = window.prompt(\n      "Esta ação desativa sua conta e encerra sua sessão. Digite DESATIVAR para confirmar.",\n    );\n    if (confirmation !== "DESATIVAR") return;\n    setDeactivating(true);\n    try {\n      await removeCustomerPushRegistration(true);\n      const { error } = await (supabase.rpc as any)("deactivate_own_account");\n      if (error) throw error;\n      const { error: signOutError } = await supabase.auth.signOut();\n      if (signOutError) throw signOutError;\n      navigate({ to: "/login" });\n    } catch (error) {\n      console.error("Erro ao desativar conta:", error);\n      toast.error("Não foi possível desativar sua conta com segurança. Tente novamente.");\n      setDeactivating(false);\n    }\n  };`,
  `  const requestAccountDeletion = async () => {\n    if (deactivating) return;\n    const confirmation = window.prompt(\n      "A APOIS receberá sua solicitação para excluir a conta e os dados associados. Digite EXCLUIR para confirmar.",\n    );\n    if (confirmation !== "EXCLUIR") return;\n    setDeactivating(true);\n    try {\n      await removeCustomerPushRegistration(true);\n      const { error } = await (supabase.rpc as any)("request_own_account_deletion");\n      if (error) throw error;\n      const { error: signOutError } = await supabase.auth.signOut();\n      if (signOutError) throw signOutError;\n      navigate({ to: "/login" });\n    } catch (error) {\n      console.error("Erro ao solicitar exclusão da conta:", error);\n      toast.error("Não foi possível solicitar a exclusão da conta. Tente novamente.");\n      setDeactivating(false);\n    }\n  };`,
  'Entregas: conta usa solicitação de exclusão em vez de simples desativação',
);

replaceRequired(
  path,
  `<h2 className="font-black text-red-300">Desativar minha conta</h2>\n                  <p className="mt-1 text-xs text-zinc-500">\n                    Seu acesso será bloqueado e a sessão será encerrada.\n                  </p>`,
  `<h2 className="font-black text-red-300">Excluir minha conta</h2>\n                  <p className="mt-1 text-xs text-zinc-500">\n                    Envie uma solicitação para excluir sua conta e os dados associados. Alguns registros podem ser mantidos quando houver obrigação legal ou de segurança, conforme a Política de Privacidade.\n                  </p>`,
  'Entregas: UI explica exclusão e possível retenção legítima',
);

replaceRequired(
  path,
  `onClick={() => void deactivateAccount()}\n                className="mt-4 h-11 w-full rounded-xl border border-red-500/30 bg-red-500/10 text-sm font-black text-red-300"\n              >\n                {deactivating ? "Desativando..." : "Desativar conta"}`,
  `onClick={() => void requestAccountDeletion()}\n                className="mt-4 h-11 w-full rounded-xl border border-red-500/30 bg-red-500/10 text-sm font-black text-red-300"\n              >\n                {deactivating ? "Enviando solicitação..." : "Solicitar exclusão da conta"}`,
  'Entregas: botão inicia solicitação de exclusão',
);

console.log('[OK] Entregas: fluxo de solicitação de exclusão preparado para requisitos da Play Store.');
