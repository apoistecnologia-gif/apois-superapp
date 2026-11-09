// APOIS Relatório 11 / INV-063 — no live Supabase, e-mail or account mutation.
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const generator = resolve(root, "scripts/fix-partner-motorista-recovery-otp-v5.mjs");
const workDir = mkdtempSync(join(tmpdir(), "apois-report11-"));
const routePath = join(workDir, ".work/partner-motorista/src/routes/motorista.recuperar-senha.tsx");
mkdirSync(dirname(routePath), { recursive: true });
writeFileSync(routePath, [
  'import { createFileRoute, Link } from "@tanstack/react-router";',
  'import { useState } from "react";',
  "// APOIS_MOTORISTA_RECOVERY_HARDEN_V1",
  "function DriverPasswordRecoveryPage() { return null; }",
].join("\n"), "utf8");
const runGenerator = () => spawnSync(process.execPath, [generator], {
  cwd: workDir, encoding: "utf8", timeout: 10000,
});
const run = runGenerator();
if (run.status !== 0) throw Error("OTP generator failed synthetic fixture: " + run.stderr + run.stdout);
const generated = readFileSync(routePath, "utf8");
process.on("exit", () => { rmSync(workDir, { recursive: true, force: true }); });

const sliceBetween = (startMarker, endMarker) => {
  const start = generated.indexOf(startMarker);
  const end = generated.indexOf(endMarker, start + startMarker.length);
  assert.ok(start >= 0 && end > start, "generated callback boundary absent: " + startMarker);
  return generated.slice(start, end).trim().replace(
    "event: React.FormEvent<HTMLFormElement>", "event",
  );
};
const requestSrc = sliceBetween("  async function requestCode(", "  async function verifyCode(");
const verifySrc = sliceBetween("  async function verifyCode(", "\n  return (");
const inputStart = generated.indexOf('id="apois-otp-recovery-email"');
assert.ok(inputStart >= 0);
const editStart = generated.indexOf("onChange={(event) => {", inputStart);
const editEnd = generated.indexOf("\n                }}", editStart);
assert.ok(editStart >= 0 && editEnd > editStart);
const editSrc = generated.slice(editStart + "onChange={(event) => {".length, editEnd);

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const submitEvent = { preventDefault() {} };
function harness() {
  const state = {
    email: "a@example.invalid", code: "123456", sent: false, sentTo: null,
    loading: false, verifying: false, error: null, codeError: null,
    lastRequestedAt: 0, navigation: [],
  };
  const refs = {
    currentEmailRef: { current: state.email },
    requestGenerationRef: { current: 0 },
    requestInFlightRef: { current: false },
    verifyInFlightRef: { current: false },
  };
  let now = 100000;
  let send = async () => ({ error: null });
  let verify = async () => ({ data: { session: { id: "synthetic" } }, error: null });
  const sends = [], verifications = [];
  const supabase = { auth: {
    resetPasswordForEmail: (...args) => { sends.push(args); return send(...args); },
    verifyOtp: (...args) => { verifications.push(args); return verify(...args); },
  } };
  const schema = { safeParse: ({ email }) =>
    /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)
      ? { success: true, data: { email } }
      : { success: false, error: { issues: [{ message: "Informe um e-mail válido." }] } },
  };
  const setters = Object.fromEntries([
    "email", "code", "sent", "sentTo", "loading", "verifying",
    "error", "codeError", "lastRequestedAt",
  ].map((key) => ["set" + key[0].toUpperCase() + key.slice(1), (value) => { state[key] = value; }]));
  const context = {
    ...refs, ...setters, supabase, schema, Date: { now: () => now },
    getDriverPasswordRecoveryRedirectTo: () => null,
    navigate: async (params) => { state.navigation.push(params); },
  };
  const action = (source) => new Function(
    ...Object.keys(context), "email", "code", "loading", "verifying",
    "lastRequestedAt", "sent", "return (" + source + ")",
  )(...Object.values(context), state.email, state.code, state.loading, state.verifying,
    state.lastRequestedAt, state.sent);
  const edit = (value) => new Function(
    ...Object.keys(context), "event", editSrc,
  )(...Object.values(context), { target: { value } });
  return {
    state, refs, sends, verifications, edit,
    request: () => action(requestSrc), verify: () => action(verifySrc),
    sendUsing: (handler) => { send = handler; },
    verifyUsing: (handler) => { verify = handler; },
    setClock: (timestamp) => { now = timestamp; },
  };
}

test("INV-063: V5 generator emits bound-recipient V11 without disrupting OTP layout", () => {
  for (const marker of [
    "APOIS_DRIVER_RECOVERY_EMAIL_BINDING_V11", "requestInFlightRef.current",
    "verifyInFlightRef.current", "sentTo === email.trim().toLowerCase()",
    "disabled={loading || verifying}", 'type: "recovery"',
    "Se a conta existir", "WebkitTextFillColor",
  ]) assert.ok(generated.includes(marker), marker);
  assert.ok(!generated.includes("Usar link no aplicativo"));
  assert.notEqual(runGenerator().status, 0, "generator fails closed if applied twice");
});

test("INV-063: pending A locks email; B after A completion respects global 60s throttle", async () => {
  const h = harness(), pending = deferred();
  h.sendUsing(() => pending.promise);
  const active = h.request()(submitEvent);
  h.edit("b@example.invalid");
  assert.equal(h.state.email, "a@example.invalid");
  pending.resolve({ error: null });
  await active;
  assert.equal(h.state.sentTo, "a@example.invalid");
  h.edit("b@example.invalid");
  assert.equal(h.state.sent, false);
  assert.equal(h.state.sentTo, null);
  await h.request()(submitEvent);
  assert.equal(h.sends.length, 1);
  assert.match(h.state.error, /um minuto/);
  h.sendUsing(async () => ({ error: null }));
  h.setClock(161000);
  await h.request()(submitEvent);
  assert.equal(h.sends.length, 2);
  assert.equal(h.sends[1][0], "b@example.invalid");
  assert.equal(h.state.sentTo, "b@example.invalid");
});

test("INV-063: stale success suppressed but accepted server send counts against throttle", async () => {
  const h = harness(), pending = deferred();
  h.sendUsing(() => pending.promise);
  const active = h.request()(submitEvent);
  h.refs.currentEmailRef.current = "b@example.invalid";
  h.refs.requestGenerationRef.current++;
  pending.resolve({ error: null });
  await active;
  assert.equal(h.state.sent, false);
  assert.equal(h.state.sentTo, null);
  assert.equal(h.state.lastRequestedAt, 100000);
});

test("INV-063: stale network error is not shown for another recipient", async () => {
  const h = harness(), pending = deferred();
  h.sendUsing(() => pending.promise);
  const active = h.request()(submitEvent);
  h.refs.currentEmailRef.current = "b@example.invalid";
  h.refs.requestGenerationRef.current++;
  pending.reject(Error("synthetic failure"));
  await active;
  assert.equal(h.state.error, null);
  assert.equal(h.state.sent, false);
});

test("INV-063: error allows retry and simultaneous submits do not duplicate requests", async () => {
  const h = harness();
  let attempts = 0;
  h.sendUsing(async () => ({ error: ++attempts === 1 ? { status: 500 } : null }));
  await h.request()(submitEvent);
  assert.ok(h.state.error);
  assert.equal(h.state.lastRequestedAt, 0);
  await h.request()(submitEvent);
  assert.equal(h.sends.length, 2);
  assert.equal(h.state.sent, true);

  const h2 = harness(), pending = deferred();
  h2.sendUsing(() => pending.promise);
  const action = h2.request();
  const a = action(submitEvent);
  const b = action(submitEvent);
  assert.equal(h2.sends.length, 1);
  pending.resolve({ error: null });
  await Promise.all([a, b]);
});

test("INV-063: verification locks email, uses captured recipient and server session", async () => {
  const h = harness(), pending = deferred();
  h.verifyUsing(() => pending.promise);
  const active = h.verify()(submitEvent);
  h.edit("b@example.invalid");
  assert.equal(h.state.email, "a@example.invalid");
  assert.equal(h.verifications[0][0].email, "a@example.invalid");
  assert.equal(h.verifications[0][0].type, "recovery");
  pending.resolve({ data: { session: { id: "synthetic" } }, error: null });
  await active;
  assert.equal(h.state.navigation.length, 1);
});

test("INV-063: stale verify error cannot override newly selected email", async () => {
  const h = harness(), pending = deferred();
  h.verifyUsing(() => pending.promise);
  const active = h.verify()(submitEvent);
  h.refs.currentEmailRef.current = "b@example.invalid";
  h.refs.requestGenerationRef.current++;
  pending.reject(Error("synthetic failure"));
  await active;
  assert.equal(h.state.codeError, null);
  assert.equal(h.state.navigation.length, 0);
});
