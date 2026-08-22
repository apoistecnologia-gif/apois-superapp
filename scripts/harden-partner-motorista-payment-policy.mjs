import './harden-partner-motorista-history-receipt.mjs';
import './harden-partner-motorista-direct-earnings.mjs';
import './harden-partner-motorista-release-surface.mjs';
import './harden-partner-motorista-native-utilities.mjs';
import './harden-partner-motorista-native-session-sync.mjs';
import './harden-partner-motorista-native-token-forward.mjs';
import './harden-partner-motorista-session-hygiene.mjs';
import './harden-partner-motorista-profile-switch.mjs';
import './harden-partner-motorista-operational-lock.mjs';
import './harden-partner-motorista-back-navigation.mjs';
import './harden-partner-motorista-navigation.mjs';
import './harden-partner-motorista-legal-navigation.mjs';
import './harden-partner-motorista-settings-cleanup.mjs';
import './harden-partner-motorista-secondary-exit-guard.mjs';
import './harden-partner-motorista-brand-theme.mjs';
import './harden-partner-motorista-mobile-ui.mjs';
import './harden-partner-motorista-external-links.mjs';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const workspace = process.env.APOIS_MOTORISTA_WORKSPACE || '.work/partner-motorista';
const appPath = resolve(root, workspace, 'src/routes/motorista.app.tsx');
let source = readFileSync(appPath, 'utf8');

// O Passageiro envia "credit" como código canônico para cartão pago
// diretamente na maquininha do motorista. O app do Motorista antigo só
// reconhecia aliases legados e acabava exibindo a palavra técnica "credit".
if (!source.includes('case "credit":')) {
  const legacyCardBlock = `    case "cartao_credito":\n    case "card":\n      return "Cartão de crédito";`;
  if (!source.includes(legacyCardBlock)) {
    throw new Error('[FAIL] Motorista Parceiro: bloco legado de rótulo do cartão não encontrado.');
  }
  source = source.replace(
    legacyCardBlock,
    `    case "credit":\n    case "credit_card":\n    case "cartao_credito":\n    case "card":\n      return "Cartão";`,
  );
}

// Dinheiro/cartão são recebimentos diretos. Não devem ser confundidos com
// saldo da carteira ou com pagamento eletrônico processado pela APOIS.
if (!source.includes('case "credit":') || !source.includes('return "Cartão";')) {
  throw new Error('[FAIL] Motorista Parceiro: código credit ainda não está normalizado como Cartão.');
}

writeFileSync(appPath, source, 'utf8');
console.log('[OK] Motorista Parceiro: Dinheiro/Cartão mantidos como recebimento direto; rótulo credit normalizado.');
