import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const workspace = resolve('.work/entregas');

function patch(relativePath, transform, verify, label) {
  const path = resolve(workspace, relativePath);
  const before = readFileSync(path, 'utf8');
  const after = transform(before);
  if (!verify(after)) throw new Error(`[FAIL] ${label}: contrato final não confirmado em ${relativePath}`);
  if (after !== before) writeFileSync(path, after, 'utf8');
  console.log(`[OK] ${label}${after === before ? ' (já aplicado)' : ''}`);
}

patch('src/components/MerchantOrderControlCenter.tsx', (source) => {
  let next = source;
  if (!next.includes('function isOperationalPayment(order: MerchantOrder)')) {
    next = next.replace(
      'function money(value: MerchantOrder["total"]) {',
      `function isOperationalPayment(order: MerchantOrder) {\n  const method = String(order.payment_method ?? "").toLowerCase();\n  const status = String(order.payment_status ?? "").toLowerCase();\n  return status === "paid";\n}\n\nfunction money(value: MerchantOrder["total"]) {`,
    );
  }
  next = next.replace('      .eq("payment_status", "paid")\n      .in("status", ACTIVE_STATUSES)', '      .in("status", ACTIVE_STATUSES)');
  next = next.replace(
    '          (order.payment_method !== "pix" || order.payment_status === "paid"),',
    '          isOperationalPayment(order),',
  );
  next = next.replace(
    '              const paymentReady =\n                order.payment_method !== "pix" || order.payment_status === "paid";',
    '              const paymentReady = isOperationalPayment(order);',
  );
  next = next.replace(
    'description: "Informe o motivo do cancelamento para o cliente e o estorno.",',
    'description: "Informe o motivo do cancelamento para o cliente.",',
  );
  return next;
}, (source) =>
  source.includes('function isOperationalPayment(order: MerchantOrder)') &&
  source.includes('return status === "paid" || (method === "cash" && status === "pending");') &&
  source.includes('const paymentReady = isOperationalPayment(order);') &&
  !source.includes('.eq("payment_status", "paid")\n      .in("status", ACTIVE_STATUSES)') &&
  !source.includes('motivo do cancelamento para o cliente e o estorno'),
'Entregas merchant: somente pedidos pagos ficam operacionais');

patch('src/components/MerchantOrderSoundWatcher.tsx', (source) => {
  let next = source;
  if (!next.includes('function isAlertableOrderPayment(')) {
    next = next.replace(
      'function persistAlertedOrders(ids: Set<string>) {',
      `function isAlertableOrderPayment(paymentMethod: unknown, paymentStatus: unknown) {\n  const method = String(paymentMethod ?? "").toLowerCase();\n  const status = String(paymentStatus ?? "").toLowerCase();\n  return status === "paid" || (method === "cash" && status === "pending");\n}\n\nfunction persistAlertedOrders(ids: Set<string>) {`,
    );
  }
  next = next.replaceAll('queuePaidOrder', 'queueOrder');
  next = next.replace(
    '      toast.success(`Novo pedido pago${label}!`, {\n        description: "Pagamento confirmado. O pedido já pode ser atendido pelo estabelecimento.",',
    '      toast.success(`Novo pedido${label}!`, {\n        description: "O pedido já pode ser atendido pelo estabelecimento.",',
  );

  const oldRealtime = `          const paymentStatus = String(next?.["payment_status"] ?? "").toLowerCase();\n          const previousPaymentStatus = String(previous?.["payment_status"] ?? "").toLowerCase();\n          const status = String(next?.["status"] ?? "").toLowerCase();\n          if (\n            !orderId ||\n            paymentStatus !== "paid" ||\n            previousPaymentStatus === "paid" ||\n            status !== "confirmed"\n          )\n            return;\n          queueOrder(orderId, next?.["order_number"] ? String(next["order_number"]) : "");`;
  const newRealtime = `          const paymentStatus = String(next?.["payment_status"] ?? "").toLowerCase();\n          const paymentMethod = String(next?.["payment_method"] ?? "").toLowerCase();\n          const previousPaymentStatus = String(previous?.["payment_status"] ?? "").toLowerCase();\n          const previousPaymentMethod = String(previous?.["payment_method"] ?? "").toLowerCase();\n          const status = String(next?.["status"] ?? "").toLowerCase();\n          const paymentReady = isAlertableOrderPayment(paymentMethod, paymentStatus);\n          const wasPaymentReady = isAlertableOrderPayment(previousPaymentMethod, previousPaymentStatus);\n          if (!orderId || !paymentReady || wasPaymentReady || status !== "confirmed") return;\n          queueOrder(orderId, next?.["order_number"] ? String(next["order_number"]) : "");`;
  if (next.includes(oldRealtime)) next = next.replace(oldRealtime, newRealtime);

  next = next.replace(
    '.select("id,order_number,payment_status,status,created_at")\n        .eq("merchant_id", merchantId)\n        .eq("payment_status", "paid")\n        .eq("status", "confirmed")',
    '.select("id,order_number,payment_status,payment_method,status,created_at")\n        .eq("merchant_id", merchantId)\n        .eq("status", "confirmed")',
  );
  next = next.replace(
    '      data.forEach((order) => {\n        if (typeof order?.id === "string") {\n          queueOrder(order.id, order?.order_number ? String(order.order_number) : "");\n        }\n      });',
    '      data.forEach((order) => {\n        if (typeof order?.id === "string" && isAlertableOrderPayment(order.payment_method, order.payment_status)) {\n          queueOrder(order.id, order?.order_number ? String(order.order_number) : "");\n        }\n      });',
  );
  return next;
}, (source) =>
  source.includes('function isAlertableOrderPayment(') &&
  source.includes('return status === "paid" || (method === "cash" && status === "pending");') &&
  source.includes('const queueOrder = useCallback(') &&
  source.includes('const paymentReady = isAlertableOrderPayment(paymentMethod, paymentStatus);') &&
  source.includes('.select("id,order_number,payment_status,payment_method,status,created_at")') &&
  !source.includes('queuePaidOrder') &&
  !source.includes('Novo pedido pago') &&
  !source.includes('.eq("payment_status", "paid")\n        .eq("status", "confirmed")'),
'Entregas merchant: alerta sonoro somente após pagamento confirmado');

console.log('[OK] Entregas: operação merchant exige pagamento Safe2Pay confirmado.');
