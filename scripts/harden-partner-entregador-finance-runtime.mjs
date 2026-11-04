import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const workspace = process.env.APOIS_ENTREGAS_WORKSPACE || '.work/partner-entregador';
const path = resolve(root, workspace, 'src/routes/courier.tsx');
let source = readFileSync(path, 'utf8');

source = source.replace(
  'import { clearPayoutAttemptKey, getPayoutAttemptKey } from "@/lib/payout-attempt";\n',
  '',
);

const saveStart = source.indexOf('  const savePayoutAccount = async () => {');
const requestStart = source.indexOf('  const requestPayout = async () => {', saveStart);
const confirmStart = source.indexOf('  const confirmSettlementReceived = async (settlementId: string) => {', requestStart);
if (saveStart < 0 || requestStart < 0 || confirmStart < 0) {
  throw new Error('[FAIL] Entregador Parceiro: funções financeiras esperadas não foram encontradas no runtime.');
}

const replacement = `  const savePayoutAccount = async () => {\n    toast.error(\"Recebimento direto ainda está em homologação. O APOIS Parceiro não cadastra chave PIX para saque manual.\");\n  };\n\n  const requestPayout = async () => {\n    toast.error(\"Saque manual está desativado. O repasse ao entregador será liberado somente pelo fluxo financeiro direto homologado.\");\n  };\n\n`;

// Neutraliza somente cadastro de chave/saque. O settlement manual continua ativo:
source = source.slice(0, saveStart) + replacement + source.slice(confirmStart);

for (const marker of [
  'Recebimento direto ainda está em homologação.',
  'Saque manual está desativado.',
  'courier_confirm_courier_settlement',
  'courier_dispute_courier_settlement',
  'confirmSettlementReceived',
  'disputeSettlement',
]) {
  if (!source.includes(marker)) throw new Error(`[FAIL] Entregador Parceiro: trava financeira ausente (${marker}).`);
}

for (const forbidden of [
  'rpc("request_payout"',
  'getPayoutAttemptKey(',
  'clearPayoutAttemptKey(',
  'await from("payout_accounts").insert(row)',
  'await from("payout_accounts").update(row)',
  'toast.success("Chave PIX salva.")',
  'toast.success("Saque solicitado.")',
]) {
  if (source.includes(forbidden)) {
    throw new Error(`[FAIL] Entregador Parceiro: ação financeira legada ainda executável (${forbidden}).`);
  }
}

writeFileSync(path, source, 'utf8');
console.log('[OK] Entregador Parceiro: cadastro de chave PIX e request_payout legados foram neutralizados no runtime; apenas histórico permanece consultável até o repasse direto homologado.');
