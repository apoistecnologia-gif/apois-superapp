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

replaceRequired(
  '.work/entregas/src/lib/customer-push.ts',
  `    } catch (error) {\n      console.warn(\n        "customer backend push cleanup pending",\n        error instanceof Error ? error.message : "unknown",\n      );\n    }`,
  `    } catch (error) {\n      console.warn(\n        "customer backend push cleanup failed",\n        error instanceof Error ? error.message : "unknown",\n      );\n      throw new Error("Não foi possível encerrar o vínculo de notificações deste aparelho.");\n    }`,
  'Entregas: logout não ignora falha ao remover token Push do usuário',
);

replaceRequired(
  '.work/entregas/src/routes/perfil/index.tsx',
  `  const handleLogout = async () => {\n    await removeCustomerPushRegistration(true);\n    const { error } = await supabase.auth.signOut();\n    if (error) toast.error("Erro ao sair da conta");\n    else navigate({ to: "/login" });\n  };`,
  `  const handleLogout = async () => {\n    try {\n      await removeCustomerPushRegistration(true);\n      const { error } = await supabase.auth.signOut();\n      if (error) throw error;\n      navigate({ to: "/login" });\n    } catch (error) {\n      console.error("Erro ao sair da conta:", error);\n      toast.error("Não foi possível sair com segurança. Verifique sua conexão e tente novamente.");\n    }\n  };`,
  'Entregas: logout só encerra sessão depois da limpeza segura do Push',
);

replaceRequired(
  '.work/entregas/src/routes/perfil/dados-pessoais.tsx',
  `import { supabase } from "@/integrations/supabase/client";\nimport { toast } from "sonner";`,
  `import { supabase } from "@/integrations/supabase/client";\nimport { removeCustomerPushRegistration } from "@/lib/customer-push";\nimport { toast } from "sonner";`,
  'Entregas: desativação importa limpeza do Push',
);

replaceRequired(
  '.work/entregas/src/routes/perfil/dados-pessoais.tsx',
  `    } catch (error: any) {\n      console.error("Erro ao salvar dados pessoais:", error);\n      toast.error(error?.message || "Não foi possível salvar as alterações.");\n    } finally {`,
  `    } catch (error) {\n      console.error("Erro ao salvar dados pessoais:", error);\n      toast.error("Não foi possível salvar as alterações. Revise os dados e tente novamente.");\n    } finally {`,
  'Entregas: perfil não expõe erro técnico do Supabase ao cliente',
);

replaceRequired(
  '.work/entregas/src/routes/perfil/dados-pessoais.tsx',
  `      const { error } = await (supabase.rpc as any)("deactivate_own_account");\n      if (error) throw error;\n      await supabase.auth.signOut();\n      navigate({ to: "/login" });\n    } catch (error: any) {\n      toast.error(error?.message || "Não foi possível desativar sua conta.");\n      setDeactivating(false);\n    }`,
  `      await removeCustomerPushRegistration(true);\n      const { error } = await (supabase.rpc as any)("deactivate_own_account");\n      if (error) throw error;\n      const { error: signOutError } = await supabase.auth.signOut();\n      if (signOutError) throw signOutError;\n      navigate({ to: "/login" });\n    } catch (error) {\n      console.error("Erro ao desativar conta:", error);\n      toast.error("Não foi possível desativar sua conta com segurança. Tente novamente.");\n      setDeactivating(false);\n    }`,
  'Entregas: desativação remove Push antes de encerrar a sessão e sanitiza falhas',
);

console.log('[OK] Entregas: segurança de conta/logout endurecida para o Superapp.');
