// Static, read-only contract test for the private registration guard review.
// Does NOT call a live Supabase project and does NOT prove PostgreSQL RLS/E2E.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const path = "database/review/20261102_driver_complete_registration_v3_approved_guard_REVIEW_ONLY.sql";
const sql = readFileSync(path, "utf8");
const pos = (s) => sql.indexOf(s);
const auth = pos("if auth.uid() is null then");
const profile = pos("select * into v_user from public.users where auth_user_id=auth.uid()");
const lock = pos("select * into v_driver from public.drivers d where d.user_id=v_user.id for update;");
const guard = pos("if found and v_driver.approval_status in (");
const deny = pos("raise exception 'driver_registration_closed' using errcode='42501';");
const userUpdate = pos("update public.users\n");
const roleInsert = pos("insert into public.user_roles(");
const driverUpsert = pos("insert into public.drivers(");

assert.match(sql, /REVIEW ONLY, NOT APPLIED TO PRODUCTION/);
assert.match(sql, /CREATE OR REPLACE FUNCTION apois_rpc_private\.driver_complete_registration_v3\(/);
assert.match(sql, /RETURNS jsonb/i);
assert.match(sql, /SECURITY DEFINER/);
assert.ok([auth, profile, lock, guard, deny, userUpdate, roleInsert, driverUpsert].every(p => p >= 0), "required guard stage is absent");
assert.ok(auth < profile && profile < lock && lock < guard && guard < deny && deny < userUpdate && userUpdate < roleInsert && roleInsert < driverUpsert,
  "deny must happen under row lock and before any profile, role or driver mutation");
assert.match(sql.slice(lock, userUpdate), /if found and v_driver\.approval_status in \([^)]+\) then\s+raise exception 'driver_registration_closed' using errcode='42501';\s+end if;/);
const statuses = sql.slice(guard).match(/^if found and v_driver\.approval_status in \(([^)]+)\)/)?.[1]
  .split(",").map(x => x.trim().replace(/^'|'$/g, "")) ?? [];
assert.deepEqual(statuses.sort(), ["aprovado", "bloqueado", "suspenso"].sort());
console.log("[OK] Private driver registration locks existing row and blocks approved/suspended/blocked BEFORE mutations");

for (const [existing, denied] of [
  ["aprovado", true], ["suspenso", true], ["bloqueado", true],
  ["em_analise", false], ["reprovado", false], ["pendente", false], [null, false],
]) {
  assert.equal(existing !== null && statuses.includes(existing), denied, "review guard mismatch: " + String(existing));
}
console.log("[OK] Seven review-only status fixtures preserve approved/suspended/blocked and allow reviewable/new records");
// A stale precheck must never reset a row approved/suspended by a concurrent transaction.
// Conditional INSERT ... ON CONFLICT DO UPDATE WHERE is checked while locking the target row.
const upsert = sql.slice(driverUpsert);
const conditional = upsert.indexOf("where public.drivers.approval_status not in ('aprovado','suspenso','bloqueado')");
const returning = upsert.indexOf("returning * into v_driver;");
const rejectConflict = upsert.indexOf("if not found then\n    raise exception 'driver_registration_closed' using errcode='42501';\n  end if;");
assert.ok(conditional > 0 && conditional < returning && rejectConflict > returning,
  "Concurrent approval must be protected at UPSERT conflict boundary, not only by the precheck");
console.log("[OK] Conflict UPSERT cannot demote a driver approved/blocked during registration");


for (const marker of [
  "auth.uid()::text || '/'",
  "'invalid_document_path'",
  "upper(nullif(left(trim(coalesce(_vehicle_plate,'')),10),''))",
  "on conflict(user_id) do update set",
  "documents_status='pending_review'",
  "subscription_status,is_online,updated_at",
  "return to_jsonb(v_driver);",
]) assert.ok(sql.includes(marker), "regression: canonical registration data/validation removed: " + marker);
assert.doesNotMatch(sql, /\b(?:DROP|TRUNCATE|DELETE)\s+(?:TABLE|FROM|SCHEMA)\b/i);
console.log("[OK] Original identity, document prefix, vehicle, subscription and registration UPSERT contract preserved");
console.log("[PASS] Driver registration guard review assertions passed — NOT applied, NOT a live E2E test.");
