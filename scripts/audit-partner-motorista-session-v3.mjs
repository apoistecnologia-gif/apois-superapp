import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

let failed = false;
const path = resolve('scripts/harden-partner-motorista-session-hygiene.mjs');
if (!existsSync(path)) {
  console.error('[FAIL] Motorista sessão v3: hardener ausente');
  process.exit(1);
}
const source = readFileSync(path, 'utf8');
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
if (!failed) console.log('[OK] Motorista sessão v3: logout bloqueia corrida ativa, confirma OFFLINE, limpa registro Push e preserva FCM compartilhado.');
process.exit(failed ? 1 : 0);
