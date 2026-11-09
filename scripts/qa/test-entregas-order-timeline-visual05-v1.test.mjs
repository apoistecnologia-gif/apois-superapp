import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const root = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const patch = resolve(root, "scripts/fix-entregas-order-timeline-visual05-v1.mjs");
const target = "src/routes/pedido/$orderId/index.tsx";
// Fixture mirrors the relevant generated JSX anchors. It is NOT a real Android
// rendering or backend operation.
const screen = [
  "function OrderDetailsPage() {",
  '  const order = { status: "created", payment_status: "pending", fulfillment_type: "delivery" };',
  '  const isPickup = order.fulfillment_type === "pickup";',
  '  const isCancelled = order.status === "cancelled";',
  '  const isRefunded = order.status === "refunded" || order.payment_status === "refunded";',
  '  const pickupReady = isPickup && ["ready", "ready_for_pickup"].includes(order.status);',
  '  const steps = isPickup ? pickupSteps : deliverySteps;',
  "  fetchOrder();",
  "  customer_cancel_order;",
  '  const deliveryJob = { status: "picked_up" };',
  "  return (",
  "    <main>",
  "      {isCancelled || isRefunded ? (",
  "        <section>Pedido cancelado ou reembolsado</section>",
  "      ) : (",
  '          <section className="rounded-2xl border border-zinc-900 bg-zinc-950 p-6">',
  '            <div className="space-y-6">',
  "              {steps.map((step, index) => {",
  "                const Icon = step.icon;",
  "                return (",
  '                  <div key={step.label} className="relative flex gap-4">',
  "                    {index !== steps.length - 1 ? (",
  '                      <div className="connector" />',
  "                    ) : null}",
  '                    <div>',
  '                      <Icon className="h-4 w-4" />',
  '                    </div>',
  '                    <div className="flex-1 pt-1">',
  '                      <p className="text-sm font-bold">',
  "                        {step.label}",
  "                      </p>",
  '                      {step.status === "current" ? (',
  '                        <p className="animate-pulse text-[10px] font-bold text-primary">',
  "                          EM ANDAMENTO",
  "                        </p>",
  "                      ) : null}",
  "                    </div>",
  "                  </div>",
  "                );",
  "              })}",
  "            </div>",
  "          </section>",
  "        )}",
  '        <section role="status" aria-live="polite">Entrega concluída!</section>',
  '        {order.status !== "delivered" ? <CustomerDeliveryMap job={deliveryJob} /> : null}',
  '        {["picked_up", "on_the_way", "arrived_destination"].includes(deliveryJob?.status ?? "") ? (<div>PIN</div>) : null}',
  '        <button onClick={cancelOrder}>Cancelar</button>',
  "    </main>",
  "  );",
  "}",
].join("\n");
function save(base, text) {
  const path = join(base, target);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text, "utf8");
}
function load(base) { return readFileSync(join(base, target), "utf8"); }
function apply(base) {
  return spawnSync(process.execPath, [patch], {
    cwd: base,
    encoding: "utf8",
    env: { ...process.env, APOIS_ENTREGAS_WORKSPACE: base },
  });
}
test("CV-019/020: order timeline transformation is idempotent and fail closed", () => {
  const tmp = mkdtempSync(join(tmpdir(), "apois-cv05-"));
  try {
    save(tmp, screen);
    let processResult = apply(tmp);
    assert.equal(processResult.status, 0, processResult.stderr);
    const updated = load(tmp);
    assert.match(updated, /APOIS_VISUAL05_ORDER_TIMELINE_V1/);
    assert.match(updated, /data-apois-cv05-order-stage-message/);
    assert.match(updated, /<ol aria-label="Etapas do pedido"/);
    assert.match(updated, /<li key=\{step.label\} aria-current=/);
    assert.match(updated, /aria-hidden="true"/);
    assert.match(updated, /"Etapa concluída"/);
    assert.match(updated, /"Etapa atual"/);
    assert.match(updated, /"Etapa pendente"/);
    assert.match(updated, /role="status" aria-live="polite"/);
    assert.match(updated, /\["picked_up", "on_the_way", "arrived_destination"\]\.includes/);
    assert.match(updated, /customer_cancel_order/);
    assert.match(updated, /order\.payment_status === "refunded"/);
    const firstOutput = updated;
    processResult = apply(tmp);
    assert.equal(processResult.status, 0, processResult.stderr);
    assert.equal(load(tmp), firstOutput);
    save(tmp, screen.replace('key={step.label} className="relative flex gap-4"',
      'key={step.label} className="unknown"'));
    processResult = apply(tmp);
    assert.notEqual(processResult.status, 0, "altered upstream timeline must fail closed");
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});
test("CV-019: state language does not infer payment or promise courier for pickup", () => {
  const tmp = mkdtempSync(join(tmpdir(), "apois-cv05-status-"));
  try {
    save(tmp, screen);
    const r = apply(tmp);
    assert.equal(r.status, 0, r.stderr);
    const output = load(tmp);
    const start = output.indexOf("  const orderStageExplanation = (() => {");
    const end = output.indexOf("  })();", start);
    assert.ok(start > -1 && end > start, "status helper in generated source");
    const helper = output.slice(start, end + "  })();".length);
    const statusText = new Function("order", "isPickup",
      helper + "\nreturn orderStageExplanation;");
    assert.match(statusText({ status: "created" }, false), /Pedido criado/);
    assert.match(statusText({ status: "pending_payment", payment_status: "pending" }, false), /aguardando pagamento/);
    assert.doesNotMatch(statusText({ status: "pending_payment", payment_status: "paid" }, false), /aguardando pagamento/);
    assert.match(statusText({ status: "paid", payment_status: "paid" }, false), /Pagamento confirmado/);
    assert.doesNotMatch(statusText({ status: "paid", payment_status: "pending" }, false), /Pagamento confirmado/);
    assert.match(statusText({ status: "searching_driver" }, false), /Buscando entregador/);
    assert.match(statusText({ status: "driver_assigned" }, false), /Entregador encontrado/);
    assert.match(statusText({ status: "driver_arriving_store" }, false), /a caminho do estabelecimento/);
    for (const status of ["searching_driver", "driver_assigned", "driver_arriving_store"]) {
      assert.equal(statusText({ status }, true), null, "pickup may not promise courier");
    }
    for (const status of ["ready", "preparing", "delivered", "cancelled", "refunded"]) {
      assert.equal(statusText({ status }, false), null, "existing stages/terminal screen unchanged");
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});
test("CV-05: visual overlays execute late without modifying delivery tracking", () => {
  const builder = readFileSync(resolve(root, "scripts/build-isolated-module.mjs"), "utf8");
  const tracking = builder.indexOf("fix-entregas-customer-delivery-tracking-v1.mjs");
  const visual = builder.indexOf("fix-entregas-order-timeline-visual05-v1.mjs");
  assert.ok(tracking >= 0 && visual > tracking, "presentation overlay after tracking");
  const script = readFileSync(patch, "utf8");
  assert.doesNotMatch(script, /supabase\.(rpc|from|functions)\s*\(/);
  assert.doesNotMatch(script, /window\.setInterval\s*\(/);
});
