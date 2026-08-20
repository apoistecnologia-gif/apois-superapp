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

replaceRequired(
  '.work/corridas/src/components/payments/RidePixPaymentCard.tsx',
  '          <p className="text-sm font-black text-white">Pague por Pix para chamar o motorista</p>',
  '          <p className="text-sm font-black text-white">Pague por Pix para confirmar a corrida</p>',
  'corridas: título do Pix reflete motorista já reservado',
);

replaceRequired(
  '.work/corridas/src/components/payments/RidePixPaymentCard.tsx',
  '            A corrida só entra na busca de motorista depois que o Asaas confirmar o pagamento ao backend.',
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
  '            <p className="mt-1 text-[11px] text-zinc-500">Nenhum motorista será chamado enquanto o Pix estiver pendente.</p>',
  '            <p className="mt-1 text-[11px] text-zinc-500">Seu motorista está reservado. A corrida avança após a confirmação do Pix.</p>',
  'corridas: tela aguardando pagamento reflete split Mercado Pago pós-aceite',
);

console.log('[OK] corridas: fluxo visual Pix preparado para Mercado Pago marketplace apenas em .work');
