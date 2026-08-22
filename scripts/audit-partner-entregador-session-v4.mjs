import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

let failed = false;
function read(path) {
  const full = resolve(path);
  if (!existsSync(full)) {
    console.error(`[FAIL] Entregador sessão v4: arquivo ausente ${path}`);
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
function forbidAll(path, markers, label) {
  const source = read(path);
  if (!source) return;
  const found = markers.filter((marker) => source.includes(marker));
  if (found.length) {
    console.error(`[FAIL] ${label}: ${found.join(' | ')}`);
    failed = true;
  } else console.log(`[OK] ${label}`);
}

requireAll('scripts/harden-partner-entregador-session-hygiene.mjs', [
  'await removeCourierPushRegistration();',
  'await supabase.auth.signOut();',
  'window.location.replace("../../index.html")',
  'logout explícito ainda cai no login interno',
], 'logout do Entregador encerra o módulo e retorna ao seletor');
forbidAll('scripts/harden-partner-entregador-session-hygiene.mjs', [
  'PushNotifications.unregister()',
], 'logout do Entregador não invalida FCM nativo compartilhado');

requireAll('scripts/harden-partner-entregador-active-tracking.mjs', [
  'const online = Boolean(availability?.is_online) || Boolean(activeJob);',
  'disabled={Boolean(activeJob || completedJob)}',
  'Perfil indisponível durante a entrega',
  '{!activeJob && !completedJob ? (',
], 'jornada ativa mantém GPS e bloqueia saídas acidentais');

requireAll('scripts/harden-partner-entregador-map.mjs', [
  "import './harden-partner-entregador-active-tracking.mjs';",
  "import './harden-partner-entregador-session-hygiene.mjs';",
], 'umbrella do Entregador aplica tracking ativo e higiene de sessão');

process.exit(failed ? 1 : 0);
