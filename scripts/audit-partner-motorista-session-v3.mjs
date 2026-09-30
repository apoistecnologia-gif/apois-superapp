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
  return readFileSync(full, 'utf8').replace(/\r\n/g, '\n');
}

const source = read('scripts/harden-partner-motorista-session-hygiene.mjs');
for (const marker of [
  "patch('src/routes/motorista.app.tsx'",
  'Finalize a corrida ativa antes de sair da conta.',
  'rpc("driver_set_presence"',
  '_online: false, _lat: null, _lng: null',
  'profile_missing", "driver_profile_missing',
  'Não foi possível confirmar que você ficou offline.',
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

// O hardener mantém o padrão legado com .catch(() => undefined) apenas como
// entrada de migração para substituí-lo pela RPC que lança em caso de erro.
// Validamos a própria guarda estrutural, em vez de reprovar a presença textual
// desse padrão dentro do script de transformação.
for (const marker of [
  'const offlineRpc = `const { error: presenceError } = await (supabase as any).rpc("driver_set_presence"',
  'profile_missing", "driver_profile_missing',
  'Remove tolerância legada se o hardener anterior já tiver sido aplicado.',
  ').catch(() => undefined);`,\n    `      ${offlineRpc}`',
]) {
  if (!source.includes(marker)) {
    console.error(`[FAIL] Motorista sessão v3: saída ainda ignora falha ao confirmar OFFLINE — guarda ausente ${marker}`);
    failed = true;
  }
}
if (!failed) console.log('[OK] Motorista sessão v3: logout não ignora falha de OFFLINE; padrões legados só existem como entrada de migração e são substituídos por RPC fail-closed.');

const profileSwitch = read('scripts/harden-partner-motorista-profile-switch.mjs');
for (const marker of [
  'Conclua a corrida ativa antes de trocar de perfil.',
  'rpc("driver_set_presence"',
  '_online: false,',
  'profile_missing", "driver_profile_missing',
  'await stopNativeDriverLocation()',
  'localStorage.setItem("apois:driver:online", "0")',
  'onClick={() => void handleSwitchPartnerProfile()}',
  'disabled={switchingProfile}',
  'const oldButton = `',
  'const safeButton = `',
  'if (source.includes(oldButton)) source = source.replace(oldButton, safeButton);',
  "throw new Error('[FAIL] Motorista Parceiro: troca de perfil ainda pode abandonar presença ONLINE sem reconciliação')",
]) {
  if (!profileSwitch.includes(marker)) {
    console.error(`[FAIL] Motorista sessão v3: troca segura de perfil ausente ${marker}`);
    failed = true;
  }
}

// O CTA direto ao seletor aparece somente dentro de oldButton e na guarda final
// que proíbe sua permanência no DriverSideMenu transformado. A auditoria deve
// verificar substituição + guarda, não interpretar esse literal como runtime ativo.
if (!profileSwitch.includes("onClick={() => window.location.replace('../../index.html')}")) {
  console.error('[FAIL] Motorista sessão v3: padrão legado da troca não está coberto pelo hardener');
  failed = true;
} else if (!profileSwitch.includes('if (source.includes(oldButton)) source = source.replace(oldButton, safeButton);') ||
           !profileSwitch.includes("if (source.includes(`onClick={() => window.location.replace('../../index.html')}`))")) {
  console.error('[FAIL] Motorista sessão v3: troca de perfil ainda pode deixar presença/GPS online');
  failed = true;
} else {
  console.log('[OK] Motorista sessão v3: CTA legado de troca é substituído e bloqueado se sobreviver ao hardening.');
}

const policy = read('scripts/harden-partner-motorista-payment-policy.mjs');
if (!policy.includes("import './harden-partner-motorista-profile-switch.mjs';")) {
  console.error('[FAIL] Motorista sessão v3: hardener de troca segura não está no pipeline oficial');
  failed = true;
}

if (!failed) console.log('[OK] Motorista sessão v3: logout e troca só prosseguem após OFFLINE confirmado, encerram GPS do módulo e preservam o FCM compartilhado.');
process.exit(failed ? 1 : 0);
