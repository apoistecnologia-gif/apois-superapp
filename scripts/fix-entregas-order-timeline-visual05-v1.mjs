import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

// APOIS_VISUAL05_ORDER_TIMELINE_V1 — presentation-only late overlay.
// Applies to generated .work/entregas, never to pinned source, DB, or lifecycle.
const root = resolve(process.env.APOIS_ENTREGAS_WORKSPACE || ".work/entregas");
const path = resolve(root, "src/routes/pedido/$orderId/index.tsx");
const before = readFileSync(path, "utf8");
function once(src, expected, replacement, name) {
  const count = src.split(expected).length - 1;
  if (count !== 1) throw Error("[FAIL] CV05 " + name + " occurrences=" + count);
  return src.replace(expected, replacement);
}
const statusHelper = [
  "  // APOIS_VISUAL05_ORDER_TIMELINE_V1: only explain existing official order.status.",
  "  // payment_status is independent; never infer payment from the timeline index.",
  "  const orderStageExplanation = (() => {",
  "    switch (order.status) {",
  '      case "created":',
  '        return "Pedido criado. Acompanhe as próximas atualizações."; ',
  '      case "pending_payment":',
  '        return "Pedido aguardando pagamento. Consulte o status na seção Pagamento."; ',
  '      case "paid":',
  '        return order.payment_status === "paid"',
  '          ? "Pagamento confirmado. Aguardando confirmação do estabelecimento."',
  '          : "Pedido na etapa de pagamento. Confira a situação na seção Pagamento."; ',
  '      case "searching_driver":',
  '        return isPickup ? null : "Buscando entregador para este pedido."; ',
  '      case "driver_assigned":',
  '        return isPickup ? null : "Entregador encontrado. Acompanhe as próximas atualizações."; ',
  '      case "driver_arriving_store":',
  '        return isPickup ? null : "Entregador a caminho do estabelecimento."; ',
  "      default:",
  "        return null;",
  "    }",
  "  })();",
].join("\n");
let result = before;
if (!result.includes("APOIS_VISUAL05_ORDER_TIMELINE_V1")) {
  result = once(result,
    '  const pickupReady = isPickup && ["ready", "ready_for_pickup"].includes(order.status);',
    '  const pickupReady = isPickup && ["ready", "ready_for_pickup"].includes(order.status);\n' + statusHelper,
    "text status insertion");
  result = once(result,
    '            <div className="space-y-6">\n              {steps.map((step, index) => {',
    '            {orderStageExplanation ? (\n' +
    '              <p data-apois-cv05-order-stage-message className="mb-4 rounded-xl border border-[#E5E7EB] bg-white px-3 py-2 text-sm font-medium leading-5 text-[#344054]">{orderStageExplanation}</p>\n' +
    '            ) : null}\n' +
    '            <ol aria-label="Etapas do pedido" data-apois-cv05-order-steps className="space-y-6">\n              {steps.map((step, index) => {',
    "timeline structure and status caption");
  result = once(result,
    '                  <div key={step.label} className="relative flex gap-4">',
    '                  <li key={step.label} aria-current={step.status === "current" ? "step" : undefined} className="relative flex gap-4">',
    "list item");
  result = once(result,
    '                      <Icon className="h-4 w-4" />',
    '                      <Icon aria-hidden="true" className="h-4 w-4" />',
    "hide decorative timeline SVG");
  result = once(result,
    '                        {step.label}\n                      </p>\n                      {step.status === "current" ? (',
    '                        {step.label}\n                      </p>\n' +
    '                      <span className="sr-only">{step.status === "completed" ? "Etapa concluída" : step.status === "current" ? "Etapa atual" : "Etapa pendente"}</span>\n' +
    '                      {step.status === "current" ? (',
    "state for screen readers");
  result = once(result,
    '<p className="animate-pulse text-[10px] font-bold text-primary">',
    '<p aria-hidden="true" className="animate-pulse text-[10px] font-bold text-primary">',
    "avoid duplicate state speech");
  result = once(result,
    '                  </div>\n                );\n              })}\n            </div>\n          </section>\n        )}',
    '                  </li>\n                );\n              })}\n            </ol>\n          </section>\n        )}',
    "timeline closure");
}
for (const marker of [
  "APOIS_VISUAL05_ORDER_TIMELINE_V1",
  "data-apois-cv05-order-stage-message",
  "data-apois-cv05-order-steps",
  'aria-label="Etapas do pedido"',
  'aria-current={step.status === "current" ? "step" : undefined}',
  '"Etapa concluída"', '"Etapa atual"', '"Etapa pendente"',
  'role="status"', 'aria-live="polite"',
  'order.status !== "delivered"',
  'deliveryJob?.status === "arrived_destination"',
  'order.payment_status === "refunded"',
  'order.fulfillment_type === "pickup"',
  'customer_cancel_order',
  'fetchOrder()',
  'CustomerDeliveryMap',
]) {
  if (!result.includes(marker)) throw Error("[FAIL] CV05 preserved contract missing: " + marker);
}
if (result.includes('aria-live="polite" data-apois-cv05-order-steps')) {
  throw Error("[FAIL] CV05 timeline must not be a live region");
}
if (result !== before) writeFileSync(path, result, "utf8");
console.log("[OK] CV05: order status explanations and accessible timeline; order/payment/route logic unchanged.");
