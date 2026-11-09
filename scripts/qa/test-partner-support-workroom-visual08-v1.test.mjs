import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import vm from "node:vm";
import { applyVisual08, patchWorkroomVisual08, VISUAL08_MARK } from "../fix-partner-support-workroom-visual08-v1.mjs";

const project = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const generator = resolve(project, "scripts/fix-partner-support-case-workroom-v1.mjs");
const overlay = resolve(project, "scripts/fix-partner-support-workroom-visual08-v1.mjs");
const rel = ".work/partner-motorista/src/components/ApoisCaseWorkroom.tsx";

function save(root, relative, content) {
  const path = resolve(root, relative);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content, "utf8");
}

function makeFixture() {
  const temp = mkdtempSync(join(tmpdir(), "apois-cv08-"));
  save(temp, ".work/partner-motorista/src/routes/motorista.suporte.tsx",
    'import { HelpCenterView } from "@/components/support/HelpCenterView";\nfunction Driver(){return <SettingsPageShell>\n        </SettingsPageShell>;}');
  save(temp, ".work/partner-motorista/src/routes/admin.suporte.tsx",
    'import { AdminLayout } from "@/components/admin/AdminLayout";\nfunction Admin(){return <AdminLayout>\n    </AdminLayout>;}');
  const generated = spawnSync(process.execPath, [generator], { cwd: temp, encoding: "utf8" });
  assert.equal(generated.status, 0, generated.stderr || generated.stdout);
  const before = readFileSync(resolve(temp, rel), "utf8");
  assert.match(before, /APOIS_STAFF_REQUEST_DRIVER_STATEMENT_V1/);
  assert.match(before, /APOIS_CASE_CONTEXT_SAFE_V2/);
  assert.match(before, /APOIS_CASE_UPLOAD_IDEMPOTENCY_V2/);
  return { temp, before };
}

async function fixture(fn) {
  const f = makeFixture();
  try { return await fn(f); } finally { rmSync(f.temp, { recursive: true, force: true }); }
}

function queryHarness(component) {
  const match = component.match(/const refresh=useCallback\(async\(\)=>\{([\s\S]*?)\n \},\[\]\);/);
  assert.ok(match, "refresh callback not found in generated component");
  const state = {
    tickets: [], error: null, loading: false,
    ticketListLoaded: false, ticketListFailed: false,
  };
  const queue = [];
  const setError = next => { state.error = typeof next === "function" ? next(state.error) : next; };
  const db = { from(table) {
    assert.equal(table, "passenger_support_tickets");
    return { select() { return { order() { return {
      async limit() { assert.ok(queue.length > 0, "missing simulated response"); return queue.shift(); },
    }; } }; } };
  } };
  const create = new Function("db", "setLoading", "setTicketListFailed", "setTicketListLoaded", "setError", "setTickets",
    "return async function refresh(){" + match[1] + "};");
  const refresh = create(db, v => { state.loading = v; },
    v => { state.ticketListFailed = v; }, v => { state.ticketListLoaded = v; },
    setError, v => { state.tickets = v; });
  const empty = component.match(/\{(tickets\.length===0&&!loading&&ticketListLoaded&&!ticketListFailed)&&<p/);
  assert.ok(empty, "success-only empty visibility guard missing");
  const isEmptyVisible = new Function("tickets", "loading", "ticketListLoaded", "ticketListFailed",
    "return " + empty[1] + ";");
  const renderEmpty = () => isEmptyVisible(state.tickets, state.loading, state.ticketListLoaded, state.ticketListFailed);
  const respond = async response => { queue.push(response); await refresh(); };
  return { state, respond, renderEmpty };
}

test("CV-025: translated public labels match the supported contract and preserve raw status for eligibility", async () => {
  await fixture(({ before, temp }) => {
    const patch = spawnSync(process.execPath, [overlay], { cwd: temp, encoding: "utf8" });
    assert.equal(patch.status, 0, patch.stderr || patch.stdout);
    const after = readFileSync(resolve(temp, rel), "utf8");
    assert.match(after, /caseStatusLabel\(t.status\)/);
    const m = after.match(/const CASE_STATUS_LABELS:Record<string,string>=(\{[^;]+\});/);
    assert.ok(m);
    const labels = vm.runInNewContext("(" + m[1] + ")", {});
    for (const [status, label] of Object.entries({
      open:"Aberto", in_progress:"Em atendimento", resolved:"Resolvido", closed:"Fechado",
    })) assert.equal(labels[status], label);
    assert.match(after, /CASE_STATUS_LABELS\[value\]\?\?"Situação indisponível"/);
    assert.match(after, /\["open","in_progress"\]\.includes\(current.status\)/);
    assert.match(after, /onClick=\{\(\)=>selectCase\(t.id\)\}/);
    assert.match(after, /new Date\(t.created_at\)\.toLocaleString\("pt-BR"\)/);
    assert.ok(before.includes("{t.status}"));
    assert.ok(!after.includes("{t.status}"));
  });
});

test("CV-026: failed initial query is NOT empty; success empty is empty; stale list is retained and recoverable", async () => {
  await fixture(async ({ temp }) => {
    const first = applyVisual08(resolve(temp, ".work/partner-motorista"));
    assert.equal(first.changed, true);
    const component = readFileSync(resolve(temp, rel), "utf8");
    const h = queryHarness(component);
    assert.equal(h.renderEmpty(), false);
    await h.respond({ error: { message:"network" }, data: null });
    assert.equal(h.state.ticketListFailed, true);
    assert.equal(h.state.ticketListLoaded, false);
    assert.equal(h.renderEmpty(), false);
    assert.equal(h.state.error, "Não foi possível consultar os protocolos.");
    await h.respond({ error: null, data: [] });
    assert.equal(h.state.ticketListFailed, false);
    assert.equal(h.state.ticketListLoaded, true);
    assert.equal(h.state.error, null);
    assert.equal(h.renderEmpty(), true);
    const ticket = { id:"fixture-case", protocol:"APOIS-TEST", status:"open" };
    await h.respond({ error: null, data: [ticket] });
    assert.equal(h.renderEmpty(), false);
    await h.respond({ error: { message:"timeout" }, data: null });
    assert.deepEqual(h.state.tickets, [ticket]);
    assert.equal(h.state.ticketListFailed, true);
    assert.equal(h.renderEmpty(), false);
    assert.match(component, /Os protocolos exibidos podem estar desatualizados/);
    assert.match(component, /ticketListFailed\?"Tentar novamente":"Atualizar"/);
    await h.respond({ error: null, data: [ticket] });
    assert.equal(h.state.ticketListFailed, false);
    assert.equal(h.state.error, null);
  });
});

test("CV-025/026: no extra repeating alerts, staff triage, private notes and attachments survive unchanged", async () => {
  await fixture(({before,temp}) => {
    const after = patchWorkroomVisual08(before);
    assert.equal((after.match(/role="alert"/g)||[]).length, (before.match(/role="alert"/g)||[]).length);
    assert.equal((after.match(/role="status"/g)||[]).length, (before.match(/role="status"/g)||[]).length);
    for (const marker of [
      "APOIS_CASE_CONTEXT_SAFE_V2", "APOIS_CASE_UPLOAD_IDEMPOTENCY_V2",
      "APOIS_STAFF_REQUEST_DRIVER_STATEMENT_V1",
      "apois_request_driver_statement", "apois_case_reply",
      "apois_case_internal_note", "apois_case_register_evidence",
      'disabled={role==="staff"&&privateNote}', "draftsRef.current.set(previous",
      "detailSequence.current===sequence", "Anexo indisponível.",
      "window.setInterval(()=>{void detail(selected);void refresh();},30000)",
    ]) assert.ok(after.includes(marker), "protected behavior: " + marker);
    assert.ok(after.includes(VISUAL08_MARK));
    assert.equal(applyVisual08(resolve(temp, ".work/partner-motorista")).changed, true);
    assert.equal(applyVisual08(resolve(temp, ".work/partner-motorista")).changed, false);
  });
});

test("CV-025/026: drift causes fail-closed and overlay runs after Motorista generators", async () => {
  await fixture(({before}) => {
    const after = patchWorkroomVisual08(before);
    assert.equal(patchWorkroomVisual08(after), after);
    assert.throws(() => patchWorkroomVisual08("unrelated text"), /baseline/);
    assert.throws(() => patchWorkroomVisual08(after.replace("Os protocolos exibidos podem estar desatualizados.", "")), /partially patched/);
    assert.throws(() => patchWorkroomVisual08(before.replace("{t.status}", "{status}")), /expected one anchor/);
    const build = readFileSync(resolve(project, "scripts/build-partner-release.sh"), "utf8");
    const origin = build.indexOf("fix-partner-support-case-workroom-v1.mjs");
    const visual = build.indexOf("fix-partner-support-workroom-visual08-v1.mjs");
    const tests = build.indexOf("test-partner-support-workroom-visual08-v1.test.mjs");
    assert.ok(origin >= 0 && visual > origin && tests > visual);
    assert.ok(visual < build.indexOf("bun run typecheck"));
  });
});
