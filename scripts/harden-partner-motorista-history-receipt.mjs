import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const workspace = process.env.APOIS_MOTORISTA_WORKSPACE || '.work/partner-motorista';

function patch(relativePath, transform, verify, label) {
  const path = resolve(root, workspace, relativePath);
  const before = readFileSync(path, 'utf8');
  const after = transform(before);
  if (!verify(after)) throw new Error(`[FAIL] ${label}: contrato esperado não encontrado em ${relativePath}`);
  if (after !== before) writeFileSync(path, after, 'utf8');
  console.log(`[OK] ${label}${after === before ? ' (já aplicado)' : ''}`);
}

patch(
  'src/routes/motorista.corridas.$id.tsx',
  (source) => source
    .replace(
      'const rideValue = settlement?.passenger_charge ?? ride.final_price ?? ride.estimated_price;',
      'const rideValue = settlement?.driver_earning ?? settlement?.passenger_charge ?? ride.final_price ?? ride.estimated_price;',
    )
    .replace('Repasse do motorista:', 'Valor do motorista:')
    .replace(
      'O valor recebido só aparece depois da confirmação financeira do backend.',
      'O valor do motorista só aparece depois da confirmação financeira do backend.',
    ),
  (source) =>
    source.includes('settlement?.driver_earning ?? settlement?.passenger_charge') &&
    source.includes('Valor do motorista:') &&
    !source.includes('Repasse do motorista:'),
  'motorista: histórico usa ganho do motorista e não sugere repasse pela APOIS',
);

patch(
  'src/lib/rideReceipt.ts',
  (source) => {
    let next = source.replace(
      '"A APOIS não recebe pagamentos de corridas; o pagamento é acertado diretamente com o motorista.";',
      '"A APOIS não retém comissão nem recebe o valor da corrida. O pagamento é destinado diretamente ao motorista conforme a forma escolhida.";',
    );
    if (!next.includes('function receiptPaymentLabel(')) {
      const anchor = 'export function buildReceiptText(r: ReceiptData): string {';
      const helper = `function receiptPaymentLabel(method: string | null | undefined): string {\n  const normalized = String(method ?? "").trim().toLowerCase();\n  if (!normalized) return "Não informado";\n  if (normalized.includes("pix")) return "Pix";\n  if (normalized.includes("cash") || normalized.includes("dinheiro")) return "Dinheiro";\n  if (normalized.includes("credit") || normalized.includes("credito") || normalized.includes("card") || normalized.includes("cartao")) return "Cartão de crédito";\n  return "Forma de pagamento registrada";\n}\n\n${anchor}`;
      if (!next.includes(anchor)) throw new Error('rideReceipt: buildReceiptText não encontrado');
      next = next.replace(anchor, helper);
    }
    next = next.replace(
      'if (r.paymentMethod) lines.push(`Pagamento: ${r.paymentMethod}`);',
      'if (r.paymentMethod) lines.push(`Pagamento: ${receiptPaymentLabel(r.paymentMethod)}`);',
    );
    return next;
  },
  (source) =>
    source.includes('function receiptPaymentLabel(') &&
    source.includes('Pagamento: ${receiptPaymentLabel(r.paymentMethod)}') &&
    source.includes('A APOIS não retém comissão nem recebe o valor da corrida.'),
  'motorista: recibo compartilhado usa rótulos legíveis e recebimento direto',
);

patch(
  'src/lib/driverReceipt.ts',
  (source) => source
    .replace('doc.setFillColor(141, 217, 43);', 'doc.setFillColor(246, 190, 28);')
    .replace('doc.setTextColor(5, 7, 13);', 'doc.setTextColor(8, 8, 8);')
    .replace('doc.text("Total pago", 20, finalY + 19);', 'doc.text("Valor da corrida", 20, finalY + 19);')
    .replace(
      '"Este recibo é uma confirmação de viagem realizada na plataforma APOIS.",',
      '"A APOIS não retém comissão nem recebe o valor da corrida; o pagamento é destinado diretamente ao motorista.",',
    ),
  (source) =>
    source.includes('doc.setFillColor(246, 190, 28);') &&
    (source.includes('doc.text("Valor da corrida"') ||
      (source.includes('APOIS_REPORT06_RECEIPT_NULL_SAFE_V1') &&
        source.includes('doc.text(finalPrice === null && estimatedPrice !== null ? "Valor estimado da corrida" : "Valor da corrida"'))) &&
    source.includes('A APOIS não retém comissão nem recebe o valor da corrida;'),
  'motorista: PDF do recibo usa identidade dourada e deixa pagamento direto explícito',
);

console.log(`[OK] histórico/recibos do Motorista Parceiro endurecidos em ${workspace}`);
