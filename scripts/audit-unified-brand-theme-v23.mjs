import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

let failed = false;
const fail = (message) => { console.error(`[FAIL] Unified brand theme v23: ${message}`); failed = true; };
const ok = (message) => console.log(`[OK] Unified brand theme v23: ${message}`);

function read(path) {
  const full = resolve(path);
  if (!existsSync(full)) { fail(`arquivo ausente: ${path}`); return ''; }
  return readFileSync(full, 'utf8');
}

const customerTheme = read('scripts/harden-entregas-superapp-brand-theme.mjs');
for (const marker of [
  'APOIS_CUSTOMER_UNIFIED_LIGHT_V1',
  '--background: #F7F7F8',
  '--primary: #E51B23',
  '--border: #E2E4E8',
  'color-scheme: light',
  "replaceAll('#1F7894', '#111111')",
  "replaceAll('#35A9C9', '#E51B23')",
]) {
  if (!customerTheme.includes(marker)) fail(`Cliente Entregas sem regra de marca: ${marker}`);
}
if (!failed) ok('Cliente Entregas usa branco/cinza, preto e vermelho APOIS');

const customerUx = read('scripts/harden-entregas-superapp-customer-ux.mjs');
if (!customerUx.startsWith("import './harden-entregas-superapp-brand-theme.mjs';")) {
  fail('hardening de marca de Entregas não roda antes da UX interna');
} else ok('tema de Entregas é aplicado antes das correções UX');

const courierTheme = read('scripts/harden-partner-entregador-theme.mjs');
for (const marker of [
  'APOIS_PARTNER_COURIER_UNIFIED_LIGHT_V1',
  '--background:#F7F7F8',
  '--primary:#E51B23',
  'color-scheme:light',
]) {
  if (!courierTheme.includes(marker)) fail(`Entregador sem identidade unificada: ${marker}`);
}
if (!failed) ok('Entregador usa a mesma identidade do restante do ecossistema');

const driverApplicator = read('scripts/apply-apois-brand-v2.mjs');
for (const marker of [
  'html[data-app-role="motorista"]',
  '--color-online: ${s.success};',
  '--color-map-accent: ${s.primaryBrand};',
  'color-scheme: light;',
]) {
  if (!driverApplicator.includes(marker)) fail(`Motorista sem regra visual central: ${marker}`);
}
if (!failed) ok('Motorista usa identidade central e mantém verde somente para online/sucesso');

const shell = read('superapp/shell/index.html');
for (const marker of ['--bg:#F7F7F8','--red:#E51B23','--border:#E2E4E8','background:#FFFFFF']) {
  if (!shell.includes(marker)) fail(`Shell Cliente sem identidade clara: ${marker}`);
}
if (!failed) ok('Shell Cliente usa branco/cinza predominante e vermelho de ação');

const partnerShell = read('superapp/partner-shell/index.html');
for (const marker of ['background:#F7F7F8','--red:#E51B23','--surface:#FFFFFF','--border:#E2E4E8']) {
  if (!partnerShell.includes(marker)) fail(`Shell Parceiro sem identidade clara: ${marker}`);
}
if (!failed) ok('Shell Parceiro usa a mesma identidade do Superapp');

const packageJson = JSON.parse(read('package.json') || '{}');
const uiAudit = String(packageJson.scripts?.['audit:ui'] ?? '');
if (!uiAudit.includes('audit-unified-brand-theme-v23.mjs')) fail('audit:ui não inclui v23');
else ok('v23 está encadeada no gate visual');

process.exit(failed ? 1 : 0);
