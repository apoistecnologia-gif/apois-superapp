import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const path = resolve('.work/entregas/src/components/MerchantOrderControlCenter.tsx');
let source = readFileSync(path, 'utf8');

// O atalho fixo "Solicitar entregador · Pedido #..." cobria qualquer tela do
// painel (Financeiro, Configurações etc.). A solicitação continua existindo
// dentro da Central de pedidos, junto do pedido correto, mas nunca como CTA
// global. readyDeliveryOrder não tem nenhuma outra declaração neste arquivo
// (confirmado varrendo todas as linhas em produção) — é código órfão restrito
// a este bloco flutuante, então removê-lo inteiro basta.
const floatingCourierBlock = `      {readyDeliveryOrder ? (
        <button
          type="button"
          disabled={busyOrderId === readyDeliveryOrder.id}
          onClick={() => void requestCourier(readyDeliveryOrder.id)}
          className="mb-3 flex w-[min(420px,calc(100vw-2.5rem))] items-center justify-center gap-3 rounded-2xl border border-[#FFD700] bg-[#FFD700] px-5 py-4 text-sm font-black uppercase text-black shadow-2xl disabled:opacity-60"
        >
          {busyOrderId === readyDeliveryOrder.id ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Truck className="h-5 w-5" />
          )}
          Solicitar entregador · Pedido #{readyDeliveryOrder.order_number}
        </button>
      ) : null}
`;

if (source.includes(floatingCourierBlock)) {
  source = source.replace(floatingCourierBlock, '');
} else if (source.includes('readyDeliveryOrder')) {
  throw new Error('[FAIL] Entregas: CTA global de solicitar entregador mudou de formato; hardener precisa ser atualizado.');
}

if (source.includes('SOLICITAR ENTREGADOR') || source.includes('Solicitar entregador · Pedido #')) {
  throw new Error('[FAIL] Entregas: CTA global de solicitar entregador ainda permanece no painel.');
}
if (source.includes('readyDeliveryOrder')) {
  throw new Error('[FAIL] Entregas: estado do atalho global de entregador ainda permanece.');
}
if (!source.includes('void requestCourier(order.id)')) {
  throw new Error('[FAIL] Entregas: ação de solicitar entregador dentro do pedido foi removida indevidamente.');
}
if (!source.includes('Central de pedidos')) {
  throw new Error('[FAIL] Entregas: Central de pedidos não encontrada após ajuste.');
}

writeFileSync(path, source, 'utf8');
console.log('[OK] Entregas: solicitar entregador fica somente dentro da Central de pedidos; CTA amarelo global removido.');
