import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const workspace = process.env.APOIS_MOTORISTA_WORKSPACE || '.work/partner-motorista';
const target = resolve(root, workspace, 'src/routes/motorista.app.tsx');
let source = readFileSync(target, 'utf8');

if (!source.includes('case "credit":')) {
  const needle = '    case "cartao_credito":\n    case "card":\n      return "Cartão de crédito";';
  if (!source.includes(needle)) {
    throw new Error('[FAIL] motorista: bloco de rótulo de cartão não encontrado');
  }
  source = source.replace(
    needle,
    '    case "credit":\n    case "credit_card":\n    case "cartao_credito":\n    case "card":\n      return "Cartão";',
  );
  writeFileSync(target, source, 'utf8');
}

const verified = readFileSync(target, 'utf8');
if (!verified.includes('case "credit":') || !verified.includes('return "Cartão";')) {
  throw new Error('[FAIL] motorista: rótulo canônico de pagamento direto por cartão ausente');
}

console.log('[OK] Motorista Parceiro: pagamento credit exibido como Cartão direto ao motorista');
