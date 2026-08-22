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
  'await removeCourierPushRegistration()',
  'window.location.replace("../../index.html")',
  'onSwitchProfile={() => void switchPartnerProfile()}',
  'switchingProfile={busy === "profile-switch"}',
  'onClick={onSwitchProfile}',
  'disabled={switchingProfile}',
  "if (panels.includes(`onClick={() => window.location.replace('../../index.html')}`))",
  "throw new Error('[FAIL] Entregador Parceiro: perfil ainda troca de módulo sem confirmar OFFLINE')",
]) {
  if (!hardener.includes(marker)) {
    console.error(`[FAIL] Entregador profile switch v5: proteção ausente ${marker}`);
    failed = true;
  }
}

// O texto do CTA inseguro aparece legitimamente dentro do hardener como padrão de
// entrada e dentro da guarda que impede sua permanência no CourierPanels final.
// Portanto, a auditoria do script-fonte deve exigir a guarda, não reprovar a mera
// presença textual desse padrão dentro do próprio mecanismo de proteção.
const unsafePattern = "onClick={() => window.location.replace('../../index.html')}";
const guardMarker = 'if (panels.includes(`onClick={() => window.location.replace(\'../../index.html\')}`))';
if (!hardener.includes(unsafePattern) || !hardener.includes(guardMarker)) {
  console.error('[FAIL] Entregador profile switch v5: hardener não comprova bloqueio do CTA direto ao seletor');
  failed = true;
}

const umbrella = read('scripts/harden-partner-entregador-map.mjs');
if (!umbrella.includes("import './harden-partner-entregador-profile-switch.mjs';")) {
  console.error('[FAIL] Entregador profile switch v5: hardener não está no pipeline oficial');
  failed = true;
}

if (!failed) console.log('[OK] Entregador profile switch v5: troca para Motorista só ocorre após OFFLINE confirmado, com registro Push do Entregador desativado e bloqueio durante entrega/ação ativa.');
process.exit(failed ? 1 : 0);
