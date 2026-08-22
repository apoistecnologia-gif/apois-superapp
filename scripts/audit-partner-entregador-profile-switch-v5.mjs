import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

let failed = false;
function read(path) {
  const full = resolve(path);
  if (!existsSync(full)) {
    console.error(`[FAIL] Entregador profile switch v5: arquivo ausente ${path}`);
    failed = true;
    return '';
  }
  return readFileSync(full, 'utf8');
}

const hardener = read('scripts/harden-partner-entregador-profile-switch.mjs');
for (const marker of [
  'const switchPartnerProfile = async () => {',
  'Conclua a entrega ativa antes de trocar de perfil.',
  'rpc("set_courier_online", { _is_online: false })',
  'window.location.replace("../../index.html")',
  'onSwitchProfile={() => void switchPartnerProfile()}',
  'switchingProfile={busy === "profile-switch"}',
  'onClick={onSwitchProfile}',
  'disabled={switchingProfile}',
]) {
  if (!hardener.includes(marker)) {
    console.error(`[FAIL] Entregador profile switch v5: proteção ausente ${marker}`);
    failed = true;
  }
}
if (hardener.includes(`onClick={() => window.location.replace('../../index.html')}`)) {
  console.error('[FAIL] Entregador profile switch v5: troca ainda pode abandonar o módulo sem confirmar OFFLINE');
  failed = true;
}

const umbrella = read('scripts/harden-partner-entregador-map.mjs');
if (!umbrella.includes("import './harden-partner-entregador-profile-switch.mjs';")) {
  console.error('[FAIL] Entregador profile switch v5: hardener não está no pipeline oficial');
  failed = true;
}

if (!failed) console.log('[OK] Entregador profile switch v5: troca para Motorista só ocorre após OFFLINE confirmado e fica bloqueada durante entrega/ação ativa.');
process.exit(failed ? 1 : 0);
