import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

let failed = false;
function read(path) {
  const full = resolve(path);
  if (!existsSync(full)) {
    console.error(`[FAIL] Partner secondary exits v12: arquivo ausente ${path}`);
    failed = true;
    return '';
  }
  return readFileSync(full, 'utf8');
}
function requireAll(path, markers, label) {
  const source = read(path);
  if (!source) return;
  const missing = markers.filter((marker) => !source.includes(marker));
  if (missing.length) {
    console.error(`[FAIL] ${label}: ${missing.join(' | ')}`);
    failed = true;
  } else console.log(`[OK] ${label}`);
}

requireAll('scripts/harden-partner-motorista-secondary-exit-guard.mjs', [
  "patch('src/routes/motorista.perfil.tsx'",
  "patch('src/routes/motorista.configuracoes.tsx'",
  "patch('src/components/MovviHeader.tsx'",
  'apois-parceiro:operational-role',
  'Fique offline no mapa antes de sair, trocar de conta ou excluir seu cadastro.',
  'APOIS_PARTNER_DRIVER_SETTINGS_OPERATIONAL_LOGOUT_GUARD',
  'APOIS_PARTNER_DRIVER_SETTINGS_OPERATIONAL_DELETE_GUARD',
  'APOIS_PARTNER_DRIVER_HEADER_OPERATIONAL_GUARD',
  'window.location.replace("#/motorista/app")',
], 'Motorista bloqueia logout, logout global e exclusão a partir de telas secundárias enquanto operacional');

requireAll('scripts/harden-partner-motorista-payment-policy.mjs', [
  "import './harden-partner-motorista-session-hygiene.mjs';",
  "import './harden-partner-motorista-operational-lock.mjs';",
  "import './harden-partner-motorista-settings-cleanup.mjs';",
  "import './harden-partner-motorista-secondary-exit-guard.mjs';",
], 'Pipeline do Motorista executa guarda de saída depois da higiene/limpeza de telas');

const pipeline = read('scripts/harden-partner-motorista-payment-policy.mjs');
const sessionIndex = pipeline.indexOf("import './harden-partner-motorista-session-hygiene.mjs';");
const lockIndex = pipeline.indexOf("import './harden-partner-motorista-operational-lock.mjs';");
const cleanupIndex = pipeline.indexOf("import './harden-partner-motorista-settings-cleanup.mjs';");
const guardIndex = pipeline.indexOf("import './harden-partner-motorista-secondary-exit-guard.mjs';");
if (!(sessionIndex >= 0 && lockIndex > sessionIndex && cleanupIndex > lockIndex && guardIndex > cleanupIndex)) {
  console.error('[FAIL] Partner secondary exits v12: guarda de saída precisa rodar após sessão, trava operacional e limpeza de configurações.');
  failed = true;
} else {
  console.log('[OK] Ordem do hardening de saída secundária do Motorista está correta.');
}

requireAll('scripts/harden-partner-entregador-profile-switch.mjs', [
  'Conclua a entrega ativa antes de trocar de perfil.',
  'rpc("set_courier_online", { _is_online: false })',
  'window.location.replace("../../index.html")',
], 'Entregador mantém troca de perfil protegida por OFFLINE confirmado');

if (!failed) console.log('[OK] Partner secondary exits v12: telas secundárias não encerram/trocam função durante operação ativa.');
process.exit(failed ? 1 : 0);
