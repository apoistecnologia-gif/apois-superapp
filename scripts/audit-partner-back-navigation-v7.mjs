import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

let failed = false;
function read(path) {
  const full = resolve(path);
  if (!existsSync(full)) {
    console.error(`[FAIL] Partner back v7: arquivo ausente ${path}`);
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

requireAll('scripts/harden-partner-motorista-back-navigation.mjs', [
  'import { App } from "@capacitor/app";',
  'App.addListener("backButton"',
  'if (ratingRef.current)',
  'if (activeRef.current)',
  'if (incomingRef.current)',
  'if (online)',
  'Fique offline ou use Trocar perfil de parceiro',
  'window.location.replace("../../index.html")',
  'void backHandle?.remove();',
], 'Motorista bloqueia hardware back durante chamada/corrida/avaliação/presença online');

const motoristaPolicy = read('scripts/harden-partner-motorista-payment-policy.mjs');
if (!motoristaPolicy.includes("import './harden-partner-motorista-back-navigation.mjs';")) {
  console.error('[FAIL] Partner back v7: guard do Motorista não está no pipeline oficial');
  failed = true;
}

requireAll('scripts/harden-partner-entregador-back-navigation.mjs', [
  'App.addListener("backButton"',
  'if (supportOpen)',
  'if (historyOpen)',
  'if (financeOpen)',
  'if (profileOpen)',
  'if (activeJob || completedJob)',
  'if (availability?.is_online)',
  'Fique offline ou use Trocar perfil de parceiro',
  'window.location.replace("../../index.html")',
  'void backHandle?.remove();',
], 'Entregador fecha painéis internos mas bloqueia hardware back durante entrega/presença online');

const courierUmbrella = read('scripts/harden-partner-entregador-map.mjs');
if (!courierUmbrella.includes("import './harden-partner-entregador-back-navigation.mjs';")) {
  console.error('[FAIL] Partner back v7: guard do Entregador não está no pipeline oficial');
  failed = true;
}

if (!failed) console.log('[OK] Partner back v7: botão Voltar não permite burlar as reconciliações OFFLINE ao alternar Motorista/Entregador.');
process.exit(failed ? 1 : 0);
