import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// A prontidão financeira de Entrega já está implementada nativamente no
// snapshot fixado (deliveryPlatformAvailable/deliveryUnavailableMessage,
// alimentados por get_delivery_checkout_readiness), com nomes diferentes dos
// usados quando este hardener foi escrito originalmente (deliveryFinancialReady
// etc.). Confirmamos a presença do mecanismo atual em vez de injetar um
// duplicado.
const path = resolve('.work/entregas/src/routes/checkout.tsx');
const source = readFileSync(path, 'utf8');

const requiredMarkers = [
  'const [deliveryPlatformAvailable, setDeliveryPlatformAvailable] = useState(true);',
  'const [deliveryUnavailableMessage, setDeliveryUnavailableMessage] = useState<string | null>(null);',
  'get_delivery_checkout_readiness',
  'disabled={merchantConfig?.delivery_enabled === false || !deliveryPlatformAvailable}',
  '{!deliveryPlatformAvailable && deliveryUnavailableMessage ? (',
];
const missing = requiredMarkers.filter((marker) => !source.includes(marker));
if (missing.length) {
  throw new Error(`[FAIL] Entregas: readiness de entrega incompleto (${missing.join(', ')}).`);
}
console.log('[OK] Entregas: checkout desabilita Entrega antes do pedido quando repasse direto do entregador ainda não está homologado (já nativo no snapshot fixado).');
