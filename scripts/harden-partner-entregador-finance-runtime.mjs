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

const start = source.indexOf('  const savePayoutAccount = async () => {');
const endMarker = '\n\n  if (loading) {';
const end = source.indexOf(endMarker, start);
if (start < 0 || end < 0) {
  throw new Error('[FAIL] Entregador Parceiro: bloco legado de payout não encontrado no runtime.');
}

const replacement = `  const savePayoutAccount = async () => {\n    toast.error(\"Recebimento direto ainda está em homologação. O APOIS Parceiro não cadastra chave PIX para saque manual.\");\n  };\n\n  const requestPayout = async () => {\n    toast.error(\"Saque manual está desativado. O repasse ao entregador será liberado somente pelo fluxo financeiro direto homologado.\");\n  };\n\n  const confirmSettlementReceived = async (_settlementId: string) => {\n    toast.error(\"Confirmação manual de recebimento está desativada durante a homologação do repasse direto.\");\n  };\n\n  const disputeSettlement = async (_settlementId: string) => {\n    toast.error(\"Contestação manual de repasse está desativada durante a homologação do repasse direto.\");\n  };`;
source = source.slice(0, start) + replacement + source.slice(end);

for (const marker of [
  'Recebimento direto ainda está em homologação.',
  'Saque manual está desativado.',
  'const confirmSettlementReceived = async (_settlementId: string)',
  'const disputeSettlement = async (_settlementId: string)',
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
