import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const workspace = process.env.APOIS_MOTORISTA_WORKSPACE || '.work/partner-motorista';
const offlineRpc = `const { error: presenceError } = await (supabase as any).rpc("driver_set_presence", {\n        _online: false, _lat: null, _lng: null, _heading: null, _speed: null,\n      });\n      if (presenceError) throw presenceError;`;

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
    `  async function handleLogout() {\n    if (activeRef.current) {\n      toast.error(\"Finalize a corrida ativa antes de sair da conta.\");\n      return;\n    }\n    try {\n      setDesiredOnline(false);\n      const { error: presenceError } = await (supabase as any).rpc(\"driver_set_presence\", {\n        _online: false, _lat: null, _lng: null, _heading: null, _speed: null,\n      });\n      if (presenceError) throw presenceError;\n      await unregisterCurrentDevice();\n      const { error } = await supabase.auth.signOut();\n      if (error) throw error;\n      window.location.replace(\"../../index.html\");\n    } catch (error) {\n      if (import.meta.env.DEV) console.warn(\"[APOIS Motorista] falha ao sair\", error);\n      toast.error(\"Não foi possível confirmar que você ficou offline. Tente novamente antes de sair.\");\n    }\n  }`,
  );
  // Compatibilidade caso uma versão anterior deste hardener já tenha sido aplicada.
  next = next.replace(
    '      if (presenceError && import.meta.env.DEV) console.warn("[APOIS Motorista] falha ao confirmar offline no logout", presenceError);',
    '      if (presenceError) throw presenceError;',
  );
  for (const marker of [
    'Finalize a corrida ativa antes de sair da conta.',
    'setDesiredOnline(false);',
    'rpc("driver_set_presence"',
    '_online: false, _lat: null, _lng: null',
    'if (presenceError) throw presenceError;',
    'await unregisterCurrentDevice();',
    'window.location.replace("../../index.html")',
  ]) {
    if (!next.includes(marker)) throw new Error(`[FAIL] motorista.app.tsx: logout principal incompleto (${marker})`);
  }
  return next;
}, 'motorista: logout principal bloqueia corrida ativa, exige OFFLINE confirmado, desativa Push do módulo e retorna ao seletor');

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
    `      ${offlineRpc}\n      await unregisterCurrentDevice();\n      const { error } = await supabase.auth.signOut();\n      if (error) throw error;\n      if (logoutRedirect === "/") {\n        window.location.replace("../../index.html");\n        return;\n      }\n      await navigate({ to: logoutRedirect as "/", replace: true });`,
  );
  // Remove tolerância legada se o hardener anterior já tiver sido aplicado.
  next = next.replace(
    `      await (supabase as any).rpc("driver_set_presence", {\n        _online: false, _lat: null, _lng: null, _heading: null, _speed: null,\n      }).catch(() => undefined);`,
    `      ${offlineRpc}`,
  );
  for (const marker of ['driver_set_presence', 'if (presenceError) throw presenceError;', 'await unregisterCurrentDevice();', 'window.location.replace("../../index.html")']) {
    if (!next.includes(marker)) throw new Error(`[FAIL] MovviHeader.tsx: logout incompleto (${marker})`);
  }
  return next;
}, 'motorista: logout do cabeçalho exige OFFLINE confirmado, desativa Push do módulo e retorna ao seletor');

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
    `      ${offlineRpc}\n      await unregisterCurrentDevice();\n      const { error: signOutError } = await supabase.auth.signOut();\n      if (signOutError) throw signOutError;\n      toast.success("Sessão do Motorista encerrada.");\n      window.location.replace("../../index.html");`,
  );
  next = next.replace(
    `      await (supabase as any).rpc("driver_set_presence", {\n        _online: false, _lat: null, _lng: null, _heading: null, _speed: null,\n      }).catch(() => undefined);`,
    `      ${offlineRpc}`,
  );
  for (const marker of ['driver_set_presence', 'if (presenceError) throw presenceError;', 'Sessão do Motorista encerrada.', 'window.location.replace("../../index.html")']) {
    if (!next.includes(marker)) throw new Error(`[FAIL] motorista.perfil.tsx: logout Parceiro incompleto (${marker})`);
  }
  return next;
}, 'motorista: logout do perfil exige OFFLINE confirmado, encerra somente Motorista e retorna ao seletor');

patch('src/routes/motorista.configuracoes.tsx', (source) => {
  let next = source;
  const logoutMarker = '      // O token FCM pertence ao usuário no backend. Ele precisa ser desativado';
  if (next.includes(logoutMarker) && !next.slice(next.indexOf('async function handleLogout'), next.indexOf('async function handleDeleteAccount')).includes('driver_set_presence')) {
    const insertionPoint = next.indexOf('      if (scope === "global") await unregisterAllDevices();', next.indexOf('async function handleLogout'));
    if (insertionPoint < 0) throw new Error('[FAIL] motorista.configuracoes.tsx: ponto de logout não encontrado');
    const indentRpc = `      const { error: presenceError } = await (supabase as any).rpc("driver_set_presence", {\n        _online: false, _lat: null, _lng: null, _heading: null, _speed: null,\n      });\n      if (presenceError) throw presenceError;\n\n`;
    next = next.slice(0, insertionPoint) + indentRpc + next.slice(insertionPoint);
  }
  next = next.replace(
    `      await (supabase as any).rpc("driver_set_presence", {\n        _online: false, _lat: null, _lng: null, _heading: null, _speed: null,\n      }).catch(() => undefined);`,
    `      const { error: presenceError } = await (supabase as any).rpc("driver_set_presence", {\n        _online: false, _lat: null, _lng: null, _heading: null, _speed: null,\n      });\n      if (presenceError) throw presenceError;`,
  );
  next = next.replace(
    '      await navigate({ to: "/motorista/login", replace: true });\n    } catch (error) {',
    '      window.location.replace("../../index.html");\n    } catch (error) {',
  );
  next = next.replace(
    '      toast.success("Conta excluída com sucesso.");\n      await navigate({ to: "/motorista/login", replace: true });',
    '      toast.success("Conta excluída com sucesso.");\n      window.location.replace("../../index.html");',
  );
  const logoutBlockStart = next.indexOf('async function handleLogout');
  const logoutBlockEnd = next.indexOf('async function handleDeleteAccount', logoutBlockStart);
  const logoutBlock = logoutBlockStart >= 0 && logoutBlockEnd > logoutBlockStart ? next.slice(logoutBlockStart, logoutBlockEnd) : '';
  for (const marker of ['driver_set_presence', 'if (presenceError) throw presenceError;', 'unregisterCurrentDevice', 'window.location.replace("../../index.html")']) {
    if (!logoutBlock.includes(marker)) throw new Error(`[FAIL] motorista.configuracoes.tsx: logout não confirma limpeza (${marker})`);
  }
  return next;
}, 'motorista: logout em configurações exige OFFLINE confirmado, remove Push e retorna ao seletor; exclusão também retorna ao seletor');

console.log(`[OK] higiene de sessão do Motorista endurecida em ${workspace}: nenhuma saída normal prossegue se OFFLINE não for confirmado.`);
