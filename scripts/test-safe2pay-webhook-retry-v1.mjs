// Isolated webhook regression with an in-memory Supabase stub. No network, money or production records.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import assert from "node:assert/strict";

const root = fileURLToPath(new URL("../", import.meta.url));
const filename = join(root, "supabase/functions/safe2pay-webhook/index.ts");
const raw = readFileSync(filename, "utf8").replace(/^import \{ createClient \} from "npm:[^"]+";\s*/m, "");
let js;
try {
  const ts = await import("typescript");
  js = ts.transpileModule(raw, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
} catch {
  if (typeof Bun === "undefined") throw new Error("Need local typescript package or Bun transpiler for isolated Edge fixture");
  js = new Bun.Transpiler({ loader: "ts", target: "browser" }).transformSync(raw);
}

function fakeDb(initial, fault) {
  const data = structuredClone(initial);
  const calls = [];
  const supabase = {
    from(table) {
      const query = { table, predicates: [], kind: "select", patch: null, row: null };
      const qb = {
        select() { return this; },
        eq(field, value) { query.predicates.push([field, "=", value]); return this; },
        neq(field, value) { query.predicates.push([field, "!=", value]); return this; },
        insert(value) { query.kind = "insert"; query.row = value; return this; },
        update(value) { query.kind = "update"; query.patch = value; return this; },
        maybeSingle() { return run(true); },
        then(fulfill, reject) { return run(false).then(fulfill, reject); },
      };
      async function run(single) {
        calls.push({ table, kind: query.kind });
        const rows = data[table] ?? [];
        if (fault && fault(query, calls)) return { error: { code: "TEST", message: "Injected database failure" }, data: null };
        if (query.kind === "insert") {
          if (rows.some(r => query.row.event_key && r.event_key === query.row.event_key))
            return { error: { code: "23505" }, data: null };
          const row = { id: "fixture-event-" + (rows.length + 1), ...query.row, processed_at: null };
          rows.push(row);
          return { error: null, data: single ? structuredClone(row) : [structuredClone(row)] };
        }
        const matches = rows.filter(r => query.predicates.every(([f, op, v]) => op === "=" ? r[f] === v : r[f] !== v));
        if (query.kind === "update") {
          for (const row of matches) Object.assign(row, query.patch);
        }
        return { error: null, data: single ? (matches[0] ? structuredClone(matches[0]) : null) : structuredClone(matches) };
      }
      return qb;
    },
  };
  return { data, calls, client: supabase };
}

function fixture(product) {
  const db = { safe2pay_webhook_events: [], safe2pay_order_transactions: [], safe2pay_ride_transactions: [], orders: [], rides: [] };
  if (product === "orders") {
    db.safe2pay_order_transactions.push({ id: "tx1", order_id: "domain1", provider_transaction_id: 77, status: "pending", reference: "apois-order-fixture", amount: 12.50 });
    db.orders.push({ id: "domain1", payment_method: "pix", payment_status: "pending", status: "pending" });
  } else {
    db.safe2pay_ride_transactions.push({ id: "tx1", ride_id: "domain1", provider_transaction_id: 77, status: "pending", reference: "apois-ride-fixture", amount: 12.50 });
    db.rides.push({ id: "domain1", payment_method: "pix", payment_status: "pending", payment_provider: null, status: "procurando_motorista" });
  }
  return db;
}

function makeHandler(db, product) {
  let handler;
  const context = {
    createClient: () => db.client,
    Deno: { serve(fn) { handler = fn; }, env: { get(key) {
      return ({ SAFE2PAY_SECRET_KEY: "fixture-secret", SAFE2PAY_WEBHOOK_PRODUCT: product, SUPABASE_URL: "https://fake.invalid", SUPABASE_SERVICE_ROLE_KEY: "fixture-key" })[key] ?? null;
    } } },
    Response, Request, TextEncoder, crypto: globalThis.crypto, console, Date, Number, String, Object, Array, Math, JSON,
  };
  vm.runInNewContext(js, context, { filename: "safe2pay-webhook/index.ts" });
  assert.equal(typeof handler, "function");
  return async (status, overrides = {}) => {
    const body = { SecretKey: "fixture-secret", IdTransaction: 77, TransactionStatus: { Code: String(status) }, Reference: product === "orders" ? "apois-order-fixture" : "apois-ride-fixture", Amount: 12.50, ...overrides };
    const res = await handler(new Request("https://fake.invalid", { method: "POST", body: JSON.stringify(body) }));
    return { code: res.status, body: await res.json() };
  };
}

let passed = 0;
async function test(name, run) {
  await run();
  passed += 1;
  console.log("[OK] " + name);
}

await test("webhook rejects incorrect secret and performs no writes", async () => {
  const db = fakeDb(fixture("orders"));
  const invoke = makeHandler(db, "orders");
  assert.equal((await invoke(3, { SecretKey: "incorrect" })).code, 401);
  assert.equal(db.data.safe2pay_webhook_events.length, 0);
});

for (const product of ["orders", "rides"]) {
  const domain = product === "orders" ? "orders" : "rides";
  const txTable = product === "orders" ? "safe2pay_order_transactions" : "safe2pay_ride_transactions";
  await test(product + ": partial domain update failure retries successfully", async () => {
    let failOnce = true;
    const db = fakeDb(fixture(product), q => {
      if (q.table === domain && q.kind === "update" && failOnce) { failOnce = false; return true; }
      return false;
    });
    const invoke = makeHandler(db, product);
    assert.equal((await invoke(3)).code, 500);
    assert.equal(db.data[txTable][0].status, "authorized");
    assert.equal(db.data[domain][0].payment_status, "pending");
    assert.equal(db.data.safe2pay_webhook_events[0].processed_at, null);
    assert.equal((await invoke(3)).code, 200);
    assert.equal(db.data[domain][0].payment_status, "paid");
    assert.ok(db.data.safe2pay_webhook_events[0].processed_at);
    assert.equal((await invoke(3)).code, 200);
    assert.equal(db.data.safe2pay_webhook_events.length, 1);
  });
  await test(product + ": zero-row conditional updates must not acknowledge payment", async () => {
    const state = fixture(product);
    state[domain][0].status = product === "orders" ? "cancelled" : "cancelada_passageiro";
    const db = fakeDb(state);
    const invoke = makeHandler(db, product);
    assert.equal((await invoke(3)).code, 500);
    assert.equal(db.data[domain][0].payment_status, "pending");
    assert.equal(db.data.safe2pay_webhook_events[0].processed_at, null);
  });
  await test(product + ": refund, stale event and replay do not regress status", async () => {
    const db = fakeDb(fixture(product));
    const invoke = makeHandler(db, product);
    assert.equal((await invoke(3)).code, 200);
    assert.equal((await invoke(6)).code, 200);
    assert.equal(db.data[domain][0].payment_status, "refunded");
    assert.equal((await invoke(1)).code, 200);
    assert.equal(db.data[txTable][0].status, "refunded");
    assert.equal(db.data[domain][0].payment_status, "refunded");
    assert.equal((await invoke(6)).code, 200);
    assert.equal(db.data.safe2pay_webhook_events.length, 3);
  });
}
await test("event completion failure is retried instead of silently acknowledged", async () => {
  let failed = false;
  const db = fakeDb(fixture("orders"), q => {
    if (q.table === "safe2pay_webhook_events" && q.kind === "update" && !failed) { failed = true; return true; }
    return false;
  });
  const invoke = makeHandler(db, "orders");
  assert.equal((await invoke(3)).code, 500);
  assert.equal(db.data.orders[0].payment_status, "paid");
  assert.equal(db.data.safe2pay_webhook_events[0].processed_at, null);
  assert.equal((await invoke(3)).code, 200);
  assert.ok(db.data.safe2pay_webhook_events[0].processed_at);
});
await test("reference/amount mismatch rejects before financial domain mutation", async () => {
  const db = fakeDb(fixture("orders"));
  const invoke = makeHandler(db, "orders");
  assert.equal((await invoke(3, { Amount: 90 })).code, 409);
  assert.equal(db.data.orders[0].payment_status, "pending");
});

await test("reference mismatch rejects webhook without marking a payment", async () => {
  const db = fakeDb(fixture("rides"));
  const invoke = makeHandler(db, "rides");
  assert.equal((await invoke(3, { Reference: "apois-ride-another" })).code, 409);
  assert.equal(db.data.rides[0].payment_status, "pending");
  assert.equal(db.data.safe2pay_webhook_events[0].processed_at, null);
});
console.log("[PASS] " + passed + " isolated Safe2Pay webhook simulations; NO real payments, no DB writes.");
