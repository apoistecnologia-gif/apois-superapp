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
  const legacyCardBlock = `    case "cartao_credito":
    case "card":
      return "Cartão de crédito";`;
  if (!source.includes(legacyCardBlock)) {
    throw new Error('[FAIL] Motorista Parceiro: bloco legado de rótulo do cartão não encontrado.');
  }
  source = source.replace(
    legacyCardBlock,
    `    case "credit":
    case "credit_card":
    case "cartao_credito":
    case "card":
      return "Cartão";`,
  );
}

// Dinheiro/cartão são recebimentos diretos. Não devem ser confundidos com
// saldo da carteira ou com pagamento eletrônico processado pela APOIS.
if (!source.includes('case "credit":') || !source.includes('return "Cartão";')) {
  throw new Error('[FAIL] Motorista Parceiro: código credit ainda não está normalizado como Cartão.');
}

writeFileSync(appPath, source, 'utf8');
console.log('[OK] Motorista Parceiro: Dinheiro/Cartão mantidos como recebimento direto; rótulo credit normalizado.');
