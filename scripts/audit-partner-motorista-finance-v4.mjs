import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

let failed = false;
function read(path) {
  const full = resolve(path);
  if (!existsSync(full)) {
    console.error(`[FAIL] Motorista financeiro v4: arquivo ausente ${path}`);
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

requireAll('scripts/harden-partner-motorista-payment-policy.mjs', [
  "import './harden-partner-motorista-direct-earnings.mjs';",
  "import './harden-partner-motorista-release-surface.mjs';",
  'case "credit":',
  'case "credit_card":',
  'return "Cartão";',
], 'política financeira do Motorista aplica ganhos diretos e normaliza cartão');

requireAll('scripts/harden-partner-motorista-direct-earnings.mjs', [
  'PartnerDirectEarningsRedirect',
  'to: "/motorista/ganhos"',
  'Recebimento direto ao motorista',
  'Ganhos registrados',
  'false ? (',
  'sem saldo custodial da APOIS',
], 'carteira legada é desviada e ganhos exibem recebimento direto sem saque manual');

// O hardener usa uma única blocklist genérica e valida cada resíduo com
// next.includes(forbidden). Não exija uma chamada literal específica para cada
// item da lista, pois isso transforma a própria implementação genérica em falso
// negativo. O que importa é: o stub de saque está bloqueado, a chave legada faz
// parte da blocklist e qualquer item remanescente faz o hardener falhar.
requireAll('scripts/harden-partner-motorista-release-surface.mjs', [
  'requestDriverWithdrawal(_amountCents: number)',
  'Saque manual não está disponível no APOIS Parceiro',
  "for (const forbidden of ['request-driver-payout'",
  'if (next.includes(forbidden))',
  'resíduo legado de saque permaneceu',
], 'runtime de saque é neutralizado mesmo se uma tela legada tentar chamá-lo');

forbidAll('scripts/harden-partner-motorista-direct-earnings.mjs', [
  "replaceAll('Solicitar saque', 'Solicitar saque')",
], 'hardener não preserva rótulo legado de saque');

requireAll('scripts/build-partner-modules.sh', [
  'harden-partner-motorista-payment-policy.mjs',
  "if grep -R -Fq 'Solicitar saque' dist/client; then",
], 'build mantém bloqueio de release se CTA legado de saque reaparecer');

process.exit(failed ? 1 : 0);
