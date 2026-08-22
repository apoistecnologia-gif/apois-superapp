import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const workspace = process.env.APOIS_MOTORISTA_WORKSPACE || '.work/partner-motorista';

function patch(relativePath, transform, label) {
  const path = resolve(root, workspace, relativePath);
  const before = readFileSync(path, 'utf8');
  const after = transform(before);
  if (after === before) {
    console.log(`[OK] ${label} (já aplicado/sem alteração)`);
    return;
  }
  writeFileSync(path, after, 'utf8');
  console.log(`[OK] ${label}`);
}

patch('src/routes/motorista.app.tsx', (source) => {
  let next = source;
  if (!next.includes('unregisterCurrentDevice')) {
    next = next.replace(
      'import { supabase } from "@/integrations/supabase/client";',
      'import { supabase } from "@/integrations/supabase/client";\nimport { unregisterCurrentDevice } from "@/lib/notifications/deviceTokenService";',
    );
  }
  next = next.replace(
    '  async function handleLogout() {\n    await supabase.auth.signOut();\n    navigate({ to: "/" });\n  }',
    `  async function handleLogout() {\n    if (activeRef.current) {\n      toast.error(\"Finalize a corrida ativa antes de sair da conta.\");\n      return;\n    }\n    try {\n      setDesiredOnline(false);\n      const { error: presenceError } = await (supabase as any).rpc(\"driver_set_presence\", {\n        _online: false, _lat: null, _lng: null, _heading: null, _speed: null,\n      });\n      if (presenceError && import.meta.env.DEV) console.warn(\"[APOIS Motorista] falha ao confirmar offline no logout\", presenceError);\n      await unregisterCurrentDevice();\n      const { error } = await supabase.auth.signOut();\n      if (error) throw error;\n      window.location.replace(\"../../index.html\");\n    } catch (error) {\n      if (import.meta.env.DEV) console.warn(\"[APOIS Motorista] falha ao sair\", error);\n      toast.error(\"Não foi possível sair da conta agora. Tente novamente.\");\n    }\n  }`,
  );
  for (const marker of [
    'Finalize a corrida ativa antes de sair da conta.',
    'setDesiredOnline(false);',
    'rpc("driver_set_presence"',
    '_online: false, _lat: null, _lng: null',
    'await unregisterCurrentDevice();',
    'window.location.replace("../../index.html")',
  ]) {
    if (!next.includes(marker)) throw new Error(`[FAIL] motorista.app.tsx: logout principal incompleto (${marker})`);
  }
  return next;
}, 'motorista: logout principal bloqueia corrida ativa, confirma OFFLINE no backend, desativa Push do módulo e retorna ao seletor');

patch('src/components/MovviHeader.tsx', (source) => {
  let next = source;
  if (!next.includes('unregisterCurrentDevice')) {
    next = next.replace(
      'import { supabase } from "@/integrations/supabase/client";',
      'import { supabase } from "@/integrations/supabase/client";\nimport { unregisterCurrentDevice } from "@/lib/notifications/deviceTokenService";',
    );
  }
  next = next.replace(
    '      const { error } = await supabase.auth.signOut();\n      if (error) throw error;\n      await navigate({ to: logoutRedirect as "/", replace: true });',
    '      await unregisterCurrentDevice();\n      const { error } = await supabase.auth.signOut();\n      if (error) throw error;\n      if (logoutRedirect === "/") {\n        window.location.replace("../../index.html");\n        return;\n      }\n      await navigate({ to: logoutRedirect as "/", replace: true });',
  );
  if (!next.includes('await unregisterCurrentDevice();')) throw new Error('[FAIL] MovviHeader.tsx: logout não desativa registro Push do Motorista');
  if (!next.includes('window.location.replace("../../index.html")')) throw new Error('[FAIL] MovviHeader.tsx: logout não retorna ao seletor Parceiro');
  return next;
}, 'motorista: logout do cabeçalho desativa Push do módulo e retorna ao seletor');

patch('src/routes/motorista.perfil.tsx', (source) => {
  let next = source;
  if (!next.includes('unregisterCurrentDevice')) {
    next = next.replace(
      'import { supabase } from "@/integrations/supabase/client";',
      'import { supabase } from "@/integrations/supabase/client";\nimport { unregisterCurrentDevice } from "@/lib/notifications/deviceTokenService";',
    );
  }
  next = next.replace(
    '      const { error: signOutError } = await supabase.auth.signOut();\n      if (signOutError) throw signOutError;\n      toast.success("Sessão encerrada.");\n      await navigate({ to: "/", replace: true });',
    '      await unregisterCurrentDevice();\n      const { error: signOutError } = await supabase.auth.signOut();\n      if (signOutError) throw signOutError;\n      toast.success("Sessão do Motorista encerrada.");\n      window.location.replace("../../index.html");',
  );
  if (!next.includes('Sessão do Motorista encerrada.')) throw new Error('[FAIL] motorista.perfil.tsx: logout Parceiro não aplicado');
  return next;
}, 'motorista: logout do perfil encerra somente Motorista e retorna ao seletor');

patch('src/routes/motorista.configuracoes.tsx', (source) => {
  let next = source;
  next = next.replace(
    '      await navigate({ to: "/motorista/login", replace: true });\n    } catch (error) {',
    '      window.location.replace("../../index.html");\n    } catch (error) {',
  );
  next = next.replace(
    '      toast.success("Conta excluída com sucesso.");\n      await navigate({ to: "/motorista/login", replace: true });',
    '      toast.success("Conta excluída com sucesso.");\n      window.location.replace("../../index.html");',
  );
  if (!next.includes('window.location.replace("../../index.html")')) throw new Error('[FAIL] motorista.configuracoes.tsx: retorno ao seletor não aplicado');
  return next;
}, 'motorista: logout/exclusão em configurações retornam ao seletor Parceiro');

console.log(`[OK] higiene de sessão do Motorista endurecida em ${workspace}`);
