import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

let failed = false;
const read = (path) => readFileSync(resolve(path), 'utf8');
const release = read('scripts/build-partner-release.sh');
const pkg = JSON.parse(read('package.json'));

function requireText(source, marker, label) {
  if (!source.includes(marker)) {
    failed = true;
    console.error(`[FAIL] ${label}: ${marker}`);
  } else console.log(`[OK] ${label}`);
}
function forbidText(source, marker, label) {
  if (source.includes(marker)) {
    failed = true;
    console.error(`[FAIL] ${label}: ${marker}`);
  } else console.log(`[OK] ${label}`);
}

requireText(pkg.scripts['build:partner'] ?? '', 'scripts/build-partner-release.sh', 'build:partner usa pipeline release atual');
requireText(release, 'harden-motorista-provider-boundary.mjs', 'Motorista remove provisionamento legado');
requireText(release, 'harden-motorista-finance-boundary.mjs', 'Motorista aplica boundary de mensalidade');
requireText(release, 'harden-motorista-direct-ride-copy.mjs', 'Motorista neutraliza copy de gateway na corrida');
requireText(release, 'audit-motorista-release-surface.mjs', 'Motorista audita bundle release');
requireText(release, "forbid_bundle 'Mercado Pago'", 'Bundle bloqueia Mercado Pago');
requireText(release, "forbid_bundle 'asaas-create-driver'", 'Bundle bloqueia provisionamento Asaas');
requireText(release, 'harden-partner-entregador-map.mjs', 'Entregador usa umbrella de hardening operacional');
requireText(release, 'confirm_courier_settlement', 'Entregador exige contrato de settlement manual');

for (const marker of [
  'harden-motorista-field-mercadopago.mjs',
  'harden-partner-mercadopago-callback.mjs',
  'harden-motorista-mercadopago-disconnect.mjs',
  'harden-motorista-direct-mercadopago.mjs',
  'harden-motorista-payment-wait.mjs',
  "require_contains 'Conectar Mercado Pago'",
  "require_contains 'mercadopago-oauth-start'",
  "require_contains 'Aguardando pagamento do passageiro'",
]) forbidText(release, marker, 'Pipeline release não reintroduz gateway legado');

process.exit(failed ? 1 : 0);
