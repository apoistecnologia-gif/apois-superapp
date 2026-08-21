import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const workspace = process.env.APOIS_MOTORISTA_WORKSPACE || '.work/partner-motorista';
const path = resolve(root, workspace, 'src/routes/motorista.app.tsx');
let source = readFileSync(path, 'utf8');

const oldBlock = `function paymentLabelFor(method: string | null | undefined): string {
  switch (method) {
    case "dinheiro":
    case "cash":
      return "Dinheiro";
    case "pix":
      return "PIX";
    case "cartao_credito":
    case "card":
      return "Cartão de crédito";
    default:
      return method ?? "—";
  }
}`;

const newBlock = `function paymentLabelFor(method: string | null | undefined): string {
  const normalized = String(method ?? "").trim().toLowerCase();
  if (!normalized || normalized === "pix") return "PIX";
  return "PIX";
}`;

if (source.includes(oldBlock)) source = source.replace(oldBlock, newBlock);

for (const marker of [
  'const normalized = String(method ?? "").trim().toLowerCase();',
  'if (!normalized || normalized === "pix") return "PIX";',
]) {
  if (!source.includes(marker)) throw new Error(`Motorista Parceiro: política Pix-only incompleta (${marker}).`);
}

if (source.includes('return "Dinheiro";') || source.includes('return "Cartão de crédito";')) {
  throw new Error('Motorista Parceiro: meios de pagamento antigos ainda aparecem na interface.');
}

writeFileSync(path, source, 'utf8');
console.log('[OK] Motorista Parceiro: interface de corrida segue política Pix-only; dinheiro/cartão antigos não são exibidos.');
