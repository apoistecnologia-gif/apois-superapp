import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const workspace = process.env.APOIS_MOTORISTA_WORKSPACE || '.work/partner-motorista';
const ROLE_KEY = 'apois-parceiro:operational-role';

function patch(relativePath, transform, label) {
  const path = resolve(root, workspace, relativePath);
  const before = readFileSync(path, 'utf8');
  const after = transform(before);
  if (after === before) console.log(`[OK] ${label} (já aplicado/sem alteração)`);
  else {
    writeFileSync(path, after, 'utf8');
    console.log(`[OK] ${label}`);
  }
}

const operationalGuard = `    try {\n      if (localStorage.getItem("${ROLE_KEY}") === "motorista") {\n        toast.error("Fique offline no mapa antes de sair, trocar de conta ou excluir seu cadastro.");\n        window.location.replace("#/motorista/app");\n        return;\n      }\n    } catch {\n      // Se o storage estiver indisponível, o backend ainda será exigido pelo fluxo de logout.\n    }\n`;

patch('src/routes/motorista.perfil.tsx', (source) => {
  let next = source;
  const anchor = `  async function handleLogout() {\n    if (loggingOut) return;\n`;
  if (!next.includes('Fique offline no mapa antes de sair, trocar de conta ou excluir seu cadastro.')) {
    if (!next.includes(anchor)) throw new Error('[FAIL] Motorista Parceiro: handleLogout do perfil não encontrado');
    next = next.replace(anchor, `${anchor}${operationalGuard}`);
  }
  for (const marker of [
    `localStorage.getItem("${ROLE_KEY}") === "motorista"`,
    'Fique offline no mapa antes de sair, trocar de conta ou excluir seu cadastro.',
    'window.location.replace("#/motorista/app")',
  ]) if (!next.includes(marker)) throw new Error(`[FAIL] Motorista Parceiro: guarda operacional do perfil incompleto (${marker})`);
  return next;
}, 'motorista: perfil não encerra sessão enquanto a função Motorista permanece operacional');

patch('src/routes/motorista.configuracoes.tsx', (source) => {
  let next = source;
  const logoutAnchor = `  async function handleLogout(scope: "local" | "global" = "local") {\n    if (signingOut || deleting) return;\n`;
  if (!next.includes('APOIS_PARTNER_DRIVER_SETTINGS_OPERATIONAL_LOGOUT_GUARD')) {
    if (!next.includes(logoutAnchor)) throw new Error('[FAIL] Motorista Parceiro: handleLogout de configurações não encontrado');
    next = next.replace(logoutAnchor, `${logoutAnchor}    // APOIS_PARTNER_DRIVER_SETTINGS_OPERATIONAL_LOGOUT_GUARD\n${operationalGuard}`);
  }

  const deleteAnchor = `  async function handleDeleteAccount() {\n    if (deleting || signingOut) return;\n`;
  if (!next.includes('APOIS_PARTNER_DRIVER_SETTINGS_OPERATIONAL_DELETE_GUARD')) {
    if (!next.includes(deleteAnchor)) throw new Error('[FAIL] Motorista Parceiro: handleDeleteAccount não encontrado');
    next = next.replace(deleteAnchor, `${deleteAnchor}    // APOIS_PARTNER_DRIVER_SETTINGS_OPERATIONAL_DELETE_GUARD\n${operationalGuard}`);
  }
  for (const marker of [
    'APOIS_PARTNER_DRIVER_SETTINGS_OPERATIONAL_LOGOUT_GUARD',
    'APOIS_PARTNER_DRIVER_SETTINGS_OPERATIONAL_DELETE_GUARD',
    `localStorage.getItem("${ROLE_KEY}") === "motorista"`,
    'Fique offline no mapa antes de sair, trocar de conta ou excluir seu cadastro.',
  ]) if (!next.includes(marker)) throw new Error(`[FAIL] Motorista Parceiro: guarda operacional de configurações incompleto (${marker})`);
  return next;
}, 'motorista: configurações bloqueiam logout global/local e exclusão enquanto Motorista está operacional');

patch('src/components/MovviHeader.tsx', (source) => {
  let next = source;
  const anchor = `  async function handleLogout() {\n    if (loggingOut) return;\n`;
  if (!next.includes('APOIS_PARTNER_DRIVER_HEADER_OPERATIONAL_GUARD')) {
    if (!next.includes(anchor)) throw new Error('[FAIL] Motorista Parceiro: handleLogout do cabeçalho não encontrado');
    const guard = `    // APOIS_PARTNER_DRIVER_HEADER_OPERATIONAL_GUARD\n    try {\n      if (localStorage.getItem("${ROLE_KEY}") === "motorista") {\n        setLogoutError("Fique offline no mapa antes de sair da conta.");\n        await navigate({ to: "/motorista/app", replace: true });\n        return;\n      }\n    } catch {\n      // O fluxo de logout ainda exige confirmação OFFLINE no backend.\n    }\n`;
    next = next.replace(anchor, `${anchor}${guard}`);
  }
  for (const marker of [
    'APOIS_PARTNER_DRIVER_HEADER_OPERATIONAL_GUARD',
    `localStorage.getItem("${ROLE_KEY}") === "motorista"`,
    'Fique offline no mapa antes de sair da conta.',
    'to: "/motorista/app"',
  ]) if (!next.includes(marker)) throw new Error(`[FAIL] Motorista Parceiro: guarda operacional do cabeçalho incompleto (${marker})`);
  return next;
}, 'motorista: cabeçalho das telas secundárias retorna ao mapa em vez de encerrar sessão operacional');

console.log('[OK] Motorista Parceiro: nenhuma saída secundária encerra sessão, troca conta ou exclui cadastro enquanto a trava operacional indica Motorista ativo.');
