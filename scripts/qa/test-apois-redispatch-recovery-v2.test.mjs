// APOIS Redispatch v2. No HTTP requests, no Supabase connections, no writes.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = (path) => readFileSync(path, "utf8");
const recovery = source("supabase/functions/driver-redispatch-recovery/index.ts");
const reject = source("supabase/functions/driver-reject-redispatch/index.ts");
const cancel = source("supabase/functions/driver-cancel-redispatch/index.ts");

const R1 = "00000000-0000-4000-8000-000000000001";
const R2 = "00000000-0000-4000-8000-000000000002";

function createRecoveryHarness({ events = [], stale = [], rides = {}, dispatch = async () => ({ ok: true, status: 200, body: { ok: true, action: "offered" } }) } = {}) {
  let handler;
  const filters = [];
  const dispatched = [];
  const Deno = { serve: (fn) => { handler = fn; } };
  const mockClient = {
    from(table) {
      const ops = [];
      const query = {
        select(cols) { ops.push(["select", cols]); return this; },
        eq(...a) { ops.push(["eq", ...a]); return this; },
        in(...a) { ops.push(["in", ...a]); return this; },
        gte(...a) { ops.push(["gte", ...a]); return this; },
        lte(...a) { ops.push(["lte", ...a]); return this; },
        gt(...a) { ops.push(["gt", ...a]); return this; },
        or(...a) { ops.push(["or", ...a]); return this; },
        is(...a) { ops.push(["is", ...a]); return this; },
        order(...a) { ops.push(["order", ...a]); return this; },
        limit(num) {
          filters.push({ table, ops, limit: num });
          if (table === "audit_logs") return Promise.resolve({ data: events, error: null });
          assert.equal(table, "rides");
          return Promise.resolve({ data: stale, error: null });
        },
        maybeSingle() {
          const id = ops.find((op) => op[0] === "eq" && op[1] === "id")?.[2];
          filters.push({ table, ops, lookupId: id });
          return Promise.resolve({ data: rides[id] ?? null, error: null });
        },
      };
      return query;
    },
  };
  // Execute *the actual Edge handler* with the Deno and DB boundaries mocked.
  // Strip the three TypeScript-only annotations present in this isolated file.
  const runnable = recovery.slice(recovery.indexOf("Deno.serve("))
    .replace("async(req:Request)", "async(req)")
    .replace("new Set<string>()", "new Set()")
    .replace(" as { ok?: boolean }", "");
  assert.doesNotMatch(runnable, /\breq:Request\b|\bnew Set<string>\b|\bas \{ ok\?: boolean \}/);
  new Function("Deno", "createClient", "getCorsHeaders", "fetch", "URL", "SERVICE", "UUID", "json", "console", runnable)(
    Deno, () => mockClient, () => ({}),
    async (url, options) => {
      const body = JSON.parse(options.body);
      dispatched.push({ url, body });
      const result = await dispatch(url, options);
      return { ok: result.ok, status: result.status, json: async () => result.body };
    },
    "https://supabase.invalid", "service-test",
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    (_req, value, status = 200) => new Response(JSON.stringify(value), { status }),
    { error: () => {} },
  );
  assert.equal(typeof handler, "function");
  return { handler, filters, dispatched };
}
const request = (auth = "Bearer service-test") => new Request("https://supabase.invalid", {
  method: "POST", headers: { Authorization: auth },
});
const pending = (extra = {}) => ({
  status: "procurar_motorista", driver_id: null, accepted_driver_id: null,
  created_at: new Date(Date.now() - 30_000).toISOString(),
  queued_after_ride_id: null, search_expires_at: new Date(Date.now() + 90_000).toISOString(),
  request_expires_at: new Date(Date.now() - 20_000).toISOString(),
  offered_driver_ids: [], candidate_driver_ids: [], ...extra,
});

test("Reject without audit event is recovered through bounded stale-search scan", async () => {
  const h = createRecoveryHarness({ stale: [{ id: R1 }], rides: { [R1]: pending() } });
  const res = await h.handler(request()); const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.retried, 1);
  assert.equal(body.stale_candidates, 1);
  assert.equal(body.event_candidates, 0);
  assert.deepEqual(h.dispatched[0].body, { ride_id: R1, mode: "initial" });
  const staleRead = h.filters.find((f) => f.table === "rides" && f.limit);
  for (const predicate of [
    ["eq", "status", "procurar_motorista"], ["is", "driver_id", null],
    ["is", "accepted_driver_id", null], ["is", "queued_after_ride_id", null],
  ]) assert.ok(staleRead.ops.some((op) => op.every((v, i) => v === predicate[i])), "Missing " + predicate);
  assert.ok(staleRead.ops.some((op) => op[0] === "or" && op[1].includes("request_expires_at.is.null")));
  assert.ok(staleRead.ops.some((op) => op[0] === "or" && op[1].includes("request_expires_at.lte.")));
  assert.ok(staleRead.ops.some((op) => op[0] === "lte" && op[1] === "created_at"));
  assert.ok(staleRead.ops.some((op) => op[0] === "gt" && op[1] === "search_expires_at"));
  assert.ok(staleRead.limit <= 100);
});

test("Committed initial ride with NULL offer expiry recovers after creation grace", async () => {
  const h = createRecoveryHarness({
    stale: [{ id: R1 }],
    rides: { [R1]: pending({ request_expires_at: null, offered_driver_ids: [] }) },
  });
  const body = await (await h.handler(request())).json();
  assert.equal(body.retried, 1);
  assert.deepEqual(h.dispatched.map(d => d.body), [{ ride_id: R1, mode: "initial" }]);
});

test("Brand-new ride is never redispatched while its initial dispatcher can be running", async () => {
  const h = createRecoveryHarness({
    stale: [{ id: R1 }],
    rides: { [R1]: pending({
      request_expires_at: null,
      created_at: new Date(Date.now() - 3_000).toISOString(),
    }) },
  });
  const body = await (await h.handler(request())).json();
  assert.equal(body.skipped, 1);
  assert.equal(body.retried, 0);
  assert.equal(h.dispatched.length, 0);
});

test("Cancellation or release audited events: dedupe, correct pool mode and skip assigned queue", async () => {
  const h = createRecoveryHarness({
    events: [
      { entity_id: R1, action: "ride.driver_cancelled_for_redispatch" },
      { entity_id: R1, action: "ride.driver_cancelled_for_redispatch" },
      { entity_id: R2, action: "ride.queued_released_ineligible_driver" },
    ],
    stale: [{ id: R1 }],
    rides: { [R1]: pending({ candidate_driver_ids: ["driver-remaining"] }),
      [R2]: pending({ candidate_driver_ids: ["driver-remaining"], queued_after_ride_id: R1 }) },
  });
  const body = await (await h.handler(request())).json();
  assert.equal(body.checked, 2);
  assert.equal(body.retried, 1);
  assert.equal(body.skipped, 1);
  assert.deepEqual(h.dispatched.map((d) => d.body), [{ ride_id: R1, mode: "redispatch" }]);
});

test("Active offer and completed ride are never redispatched; HTTP 200 logical failure defers", async () => {
  const h = createRecoveryHarness({
    stale: [{ id: R1 }, { id: R2 }],
    rides: { [R1]: pending({ offered_driver_ids: ["active-driver"], request_expires_at: new Date(Date.now() + 30_000).toISOString() }),
      [R2]: pending({ candidate_driver_ids: ["unused"] }) },
    dispatch: async () => ({ ok: true, status: 200, body: { ok: false, error: "dispatch_not_committed" } }),
  });
  const body = await (await h.handler(request())).json();
  assert.equal(body.skipped, 1);
  assert.equal(body.deferred, 1);
  assert.equal(body.retried, 0);
  assert.equal(h.dispatched.length, 1);
});

test("Recovery requires service role; user JWT cannot dispatch", async () => {
  const h = createRecoveryHarness({ stale: [{ id: R1 }], rides: { [R1]: pending() } });
  const res = await h.handler(request("Bearer user-jwt"));
  assert.equal(res.status, 401);
  assert.equal(h.dispatched.length, 0);
  assert.equal(h.filters.length, 0);
});

function actualTrigger(sourceText) {
  const start = sourceText.indexOf("async function triggerRedispatch(");
  const end = sourceText.indexOf("\n}\n\nDeno.serve", start);
  assert.ok(start >= 0 && end > start, "real trigger function exists");
  const fn = sourceText.slice(start, end + 2)
    .replace("rideId: string", "rideId")
    .replace(": Promise<{ ok: boolean; action?: string; status?: number }>", "")
    .replace(" as { ok?: boolean; action?: string }", "");
  return (fetchImpl) => new Function("fetch", "SUPABASE_URL", "SERVICE_ROLE", "console",
    fn + "\nreturn triggerRedispatch;")(fetchImpl, "https://supabase.invalid", "service-test", { error: () => {} });
}

for (const [name, sourceText] of [["reject", reject], ["cancel", cancel]]) {
  test(name + " cannot call HTTP 200 with {ok:false} a successful redispatch", async () => {
    const invoke = actualTrigger(sourceText)(async () => ({
      ok: true, status: 200, json: async () => ({ ok: false, action: "no_candidate_yet" }),
    }));
    const result = await invoke(R1);
    assert.equal(result.ok, false);
    assert.equal(result.status, 200);
    const accepted = actualTrigger(sourceText)(async () => ({
      ok: true, status: 200, json: async () => ({ ok: true, action: "offered" }),
    }));
    assert.deepEqual(await accepted(R1), { ok: true, status: 200, action: "offered" });
  });
}
