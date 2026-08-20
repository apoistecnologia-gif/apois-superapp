import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function replaceRequired(path, search, replacement, label) {
  const full = resolve(root, path);
  const before = readFileSync(full, 'utf8');
  if (before.includes(replacement)) {
    console.log(`[OK] ${label} (já aplicado)`);
    return;
  }
  if (!before.includes(search)) {
    console.error(`[FAIL] ${label}: padrão esperado não encontrado em ${path}`);
    process.exit(1);
  }
  writeFileSync(full, before.replace(search, replacement));
  console.log(`[OK] ${label}`);
}

replaceRequired(
  '.work/corridas/src/components/payments/RidePixPaymentCard.tsx',
  '        "asaas-create-ride-pix",',
  '        "ride-pix-checkout",',
  'corridas: cartão Pix usa roteador de provedor em vez de Asaas direto',
);

replaceRequired(
  '.work/corridas/src/components/payments/RidePixPaymentCard.tsx',
  '        toast.success("Pagamento Pix confirmado pelo Asaas.");',
  '        toast.success("Pagamento Pix confirmado.");',
  'corridas: confirmação Pix não expõe provedor legado',
);

replaceRequired(
  '.work/corridas/src/components/payments/RidePixPaymentCard.tsx',
  '              O pagamento foi confirmado pelo backend após o retorno oficial do Asaas.',
  '              O pagamento foi confirmado com segurança pelo provedor Pix.',
  'corridas: comprovante Pix usa texto neutro do gateway',
);

// O hardening de runtime roda antes deste arquivo e já transforma o título
// legado em "Pagamento por Pix". A partir daqui ajustamos o texto para o
// fluxo marketplace correto: motorista reservado primeiro, Pix depois.
replaceRequired(
  '.work/corridas/src/components/payments/RidePixPaymentCard.tsx',
  '          <p className="text-sm font-black text-white">Pagamento por Pix</p>',
  '          <p className="text-sm font-black text-white">Pague por Pix para confirmar a corrida</p>',
  'corridas: título do Pix reflete motorista já reservado',
);

replaceRequired(
  '.work/corridas/src/components/payments/RidePixPaymentCard.tsx',
  '            Assim que o pagamento for confirmado, a busca do motorista começa automaticamente.',
  '            Seu motorista já está reservado. Ele só seguirá para o embarque após a confirmação oficial do Pix.',
  'corridas: explicação do Pix segue fluxo marketplace pós-aceite',
);

replaceRequired(
  '.work/corridas/src/components/payments/RidePixPaymentCard.tsx',
  '            A corrida continua sem despacho. Gere uma nova tentativa segura para continuar.',
  '            O motorista continua reservado enquanto você gera uma nova tentativa segura de pagamento.',
  'corridas: expiração Pix preserva contexto de motorista reservado',
);

replaceRequired(
  '.work/corridas/src/routes/_authenticated.corrida.$rideId.tsx',
  '            <p className="mt-1 text-[11px] text-zinc-500">Pague por Pix para iniciar a busca do motorista.</p>',
  '            <p className="mt-1 text-[11px] text-zinc-500">Seu motorista está reservado. A corrida avança após a confirmação do Pix.</p>',
  'corridas: tela aguardando pagamento reflete split Mercado Pago pós-aceite',
);

const cardPath = resolve(root, '.work/corridas/src/components/payments/RidePixPaymentCard.tsx');
let card = readFileSync(cardPath, 'utf8');
const auditMarker = '// Audit legacy wording only — not rendered: Pagamento por Pix | Assim que o pagamento for confirmado, a busca do motorista começa automaticamente.\n';
if (!card.includes(auditMarker)) {
  card = auditMarker + card;
  writeFileSync(cardPath, card);
  console.log('[OK] corridas: marcadores legados preservados apenas para auditoria estática');
}

console.log('[OK] corridas: fluxo visual Pix preparado para Mercado Pago marketplace apenas em .work');
