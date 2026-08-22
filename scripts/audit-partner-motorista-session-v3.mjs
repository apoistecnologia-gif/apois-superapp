import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

let failed = false;
function read(path) {
  const full = resolve(path);
  if (!existsSync(full)) {
    console.error(`[FAIL] Motorista sessão v3: hardener ausente ${path}`);
    failed = true;
    return '';
  }
  return readFileSync(full, 'utf8');
}

const source = read('scripts/harden-partner-motorista-session-hygiene.mjs');
for (const marker of [
  "patch('src/routes/motorista.app.tsx'",
  'Finalize a corrida ativa antes de sair da conta.',
  'rpc("driver_set_presence"',
  '_online: false, _lat: null, _lng: null',
  "patch('src/components/MovviHeader.tsx'",
  "patch('src/routes/motorista.perfil.tsx'",
  "patch('src/routes/motorista.configuracoes.tsx'",
  'await unregisterCurrentDevice();',
  'window.location.replace("../../index.html")',
]) {
  if (!source.includes(marker)) {
    console.error(`[FAIL] Motorista sessão v3: proteção ausente ${marker}`);
    failed = true;
  }
}
if (source.includes('PushNotifications.unregister()')) {
  console.error('[FAIL] Motorista sessão v3: FCM nativo compartilhado não pode ser invalidado no logout do módulo');
  failed = true;
}

const profileSwitch = read('scripts/harden-partner-motorista-profile-switch.mjs');
for (const marker of [
  'Conclua a corrida ativa antes de trocar de perfil.',
  'rpc("driver_set_presence"',
  '_online: false,',
  'await stopNativeDriverLocation()',
  'localStorage.setItem("apois:driver:online", "0")',
  'onClick={() => void handleSwitchPartnerProfile()}',
]) {
  if (!profileSwitch.includes(marker)) {
    console.error(`[FAIL] Motorista sessão v3: troca segura de perfil ausente ${marker}`);
    failed = true;
  }
}
if (profileSwitch.includes(`onClick={() => window.location.replace('../../index.html')}`)) {
  console.error('[FAIL] Motorista sessão v3: troca de perfil ainda pode deixar presença/GPS online');
  failed = true;
}

const policy = read('scripts/harden-partner-motorista-payment-policy.mjs');
if (!policy.includes("import './harden-partner-motorista-profile-switch.mjs';")) {
  console.error('[FAIL] Motorista sessão v3: hardener de troca segura não está no pipeline oficial');
  failed = true;
}

if (!failed) console.log('[OK] Motorista sessão v3: logout e troca de perfil bloqueiam corrida ativa, confirmam OFFLINE, encerram GPS do módulo e preservam a sessão apropriada.');
process.exit(failed ? 1 : 0);
