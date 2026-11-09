import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import {
  DRIVER_MARK, MERCHANT_MARK,
  patchDriverSubscription, patchMerchantSubscription,
} from "../fix-apois-financial-status-visual07-v1.mjs";

const root = resolve(fileURLToPath(new URL("../..", import.meta.url)));
function generatedTemplate(script, variable, afterMarker) {
  const source = readFileSync(resolve(root, "scripts", script), "utf8");
  const startMarker = "const " + variable + " = \`";
  const start = source.indexOf(startMarker);
  const end = source.indexOf(afterMarker, start + startMarker.length);
  assert.ok(start >= 0 && end > start, "review generated template boundaries for " + script);
  const statement = source.slice(start, end).trim();
  // This is the exact generated UI literal, evaluated in an isolated no-I/O VM.
  return vm.runInNewContext(statement + "\n" + variable, {}, { timeout: 500 });
}
const driverBefore = () => generatedTemplate(
  "harden-motorista-finance-boundary.mjs", "source", "\n\nfor (const forbidden of [",
);
const merchantBefore = () => generatedTemplate(
  "harden-entregas-merchant-direct-finance.mjs", "subscriptionSource", "\nfor (const forbidden of [",
);

function driverLabel(patched, { value, known = true, error = false, loading = false }) {
  const start = patched.indexOf("  const visualMembershipConfirmed = ");
  const end = patched.indexOf("\n  return (", start);
  assert.ok(start > 0 && end > start, "driver display block missing");
  const code = patched.slice(start, end);
  const status = value === undefined || value === null ? "" : String(value).toLowerCase();
  return vm.runInNewContext(
    "const driver = " + JSON.stringify(known ? { subscription_status: status } : null) + ";\n" +
    "const error = " + JSON.stringify(error ? "query_failed" : null) + ";\n" +
    "const loading = " + JSON.stringify(loading) + ";\n" +
    "const subscription = " + JSON.stringify(status) + ";\n" +
    'const paidActive = ["active", "ativa", "ativo", "paid", "pago"].includes(subscription);\n' +
    'const homologation = subscription === "teste";\n' +
    code + "\n({label: visualSubscriptionLabel, confirmed: visualMembershipConfirmed})",
    {}, { timeout: 500 },
  );
}
function merchantLabel(patched, value) {
  const start = patched.indexOf("function statusLabel(value:");
  const end = patched.indexOf("\nexport function MerchantSubscriptionGate(", start);
  assert.ok(start >= 0 && end > start);
  const snippet = patched.slice(start, end).replace(
    /function statusLabel\(value: string \| null \| undefined\)/,
    "function statusLabel(value)",
  );
  return vm.runInNewContext(
    snippet + "\nstatusLabel(" + JSON.stringify(value) + ")",
    {}, { timeout: 500 },
  );
}

test("CV-023: driver status is translated without changing operational eligibility or contract amount", () => {
  const before = driverBefore();
  const after = patchDriverSubscription(before);
  assert.ok(after.includes(DRIVER_MARK));
  assert.equal(patchDriverSubscription(after), after);
  assert.match(after, /const operational = paidActive \|\| homologation;/);
  assert.match(after, /\.eq\("user_id", profile.id\)/);
  assert.match(after, /<Link to="\/motorista\/suporte">Suporte<\/Link>/);
  assert.match(after, /onClick=\{\(\) => void refresh\(\)\}/);
  assert.match(after, /\{formatCurrency\(APOIS_MONTHLY_FEE_BRL\)\}/);
  assert.equal(after.split("Pagamento eletrônico temporariamente indisponível").length, before.split("Pagamento eletrônico temporariamente indisponível").length);
  for (const [value,expected] of [
    ["active", "Mensalidade ativa"], ["paid", "Mensalidade ativa"],
    ["teste", "Homologação ativa"],
    ["pending", "Pagamento pendente"], ["pendente", "Pagamento pendente"],
    ["processing", "Pagamento em processamento"], ["processando", "Pagamento em processamento"],
    ["inactive", "Mensalidade inativa"],
    ["unexpected_backend_value", "Situação da mensalidade indisponível"],
    ["", "Situação da mensalidade indisponível"],
  ]) {
    assert.equal(driverLabel(after,{value}).label, expected, value);
  }
  assert.equal(driverLabel(after, {value: "active", known: false}).label, "Situação da mensalidade indisponível");
  assert.equal(driverLabel(after, {value: "active", error: true}).label, "Situação da mensalidade indisponível");
  assert.equal(driverLabel(after, {value: "active", loading: true}).label, "Consultando mensalidade…");
  assert.equal(driverLabel(after, {value: "active", error: true}).confirmed, false);
  assert.match(after, /visualMembershipConfirmed && operational \? "bg-emerald-400"/);
  assert.match(after, /\{visualSubscriptionLabel\}/);
});

test("CV-024: merchant accepts only known provider states and never exposes raw status", () => {
  const before = merchantBefore();
  const after = patchMerchantSubscription(before);
  assert.ok(after.includes(MERCHANT_MARK));
  assert.equal(patchMerchantSubscription(after), after);
  assert.equal(after.includes("Status: \${value}"), false);
  for (const [value,expected] of [
    ["paid", "Mensalidade ativa"],
    ["authorized", "Mensalidade ativa"],
    ["pending", "Regularização pendente"],
    ["paused", "Mensalidade pausada"],
    ["cancelled", "Mensalidade cancelada"],
    ["canceled", "Mensalidade cancelada"],
    ["novidade_tecnica_123", "Situação da mensalidade indisponível"],
    [null, "Situação da mensalidade indisponível"],
  ]) {
    assert.equal(merchantLabel(after,value),expected,String(value));
  }
  for (const protectedFragment of ["R$ 69,90 por mês", "Nenhum gateway de cobrança está ativo",
    "subscription?.provider_status", "subscription?.current_period_end", "void refresh()", "void onLogout()"]) {
    assert.ok(after.includes(protectedFragment), "preserved: " + protectedFragment);
  }
  assert.doesNotMatch(after, /Gerar novo PIX|Pagar R\$ 69,90 por PIX/);
});

test("CV-023/CV-024: fail closed on drift, no accidental double transformations", () => {
  assert.throws(() => patchDriverSubscription("unexpected driver"), /baseline changed/);
  assert.throws(() => patchMerchantSubscription("unexpected merchant"), /dictionary changed/);
  assert.throws(() => patchDriverSubscription(DRIVER_MARK), /partially transformed/);
  assert.throws(() => patchMerchantSubscription(MERCHANT_MARK), /partially transformed/);
});

test("CV-023/CV-024: both build pipelines apply the overlay after their existing hardeners", () => {
  const partner = readFileSync(resolve(root, "scripts/build-partner-release.sh"), "utf8");
  const standalone = readFileSync(resolve(root, "scripts/build-motorista-module.mjs"), "utf8");
  const merchant = readFileSync(resolve(root, "scripts/build-merchant-panel.mjs"), "utf8");
  const call = "fix-apois-financial-status-visual07-v1.mjs";
  assert.ok(partner.indexOf("fix-partner-driver-new-monthly-price-v1.mjs") < partner.indexOf(call));
  assert.ok(partner.indexOf(call) < partner.indexOf("bun run typecheck"));
  assert.ok(standalone.indexOf("harden-motorista-finance-boundary.mjs") < standalone.indexOf(call));
  assert.ok(standalone.indexOf(call) < standalone.indexOf("['run', 'typecheck']"));
  assert.ok(merchant.indexOf("neutralize-entregas-superapp-legacy.mjs") < merchant.indexOf(call));
  assert.ok(merchant.indexOf(call) < merchant.indexOf("['run', 'typecheck']"));
});
