// APOIS Report 14 / INV-067. SQL CONTRACT + SYNTHETIC MODEL ONLY.
// No Supabase connection, real RLS sessions, tickets, drivers or evidence files.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
const migration = readFileSync(resolve(
  process.cwd(),
  "supabase/corridas-forward-migrations/20261109_report14_case_driver_participants_QA_NOT_APPLIED.sql",
), "utf8");
function between(from, to) {
  const start = migration.indexOf(from);
  const end = migration.indexOf(to, start + from.length);
  assert.ok(start >= 0 && end > start, "SQL function section missing " + from);
  return migration.slice(start, end);
}
const helper = between(
  "CREATE OR REPLACE FUNCTION public.apois_case_access(_ticket_id uuid)",
  "-- Preserve original permission",
);
const requester = between(
  "CREATE OR REPLACE FUNCTION public.apois_request_driver_statement(_ticket_id uuid)",
  "-- Existing ticket SELECT",
);
const grant = between(
  "CREATE FUNCTION public.apois_grant_case_driver_participant(",
  "-- A logged revocation",
);
const revoke = between(
  "CREATE FUNCTION public.apois_revoke_case_driver_participant(",
  "-- Default function EXECUTE",
);

test("INV-067: QA_NOT_APPLIED, fail closed, no auto backfill or destructive rollback", () => {
  assert.match(migration, /QA_NOT_APPLIED/);
  assert.match(migration, /REPORT14_NEEDS_REVIEW/);
  assert.match(migration, /position\('r\.driver_id' IN v_access\)/);
  assert.doesNotMatch(migration, /\bDROP TABLE\b/i);
  assert.doesNotMatch(migration, /\bUPDATE public\.apois_case_driver_participants\s+SET driver_user_id\s*=/i);
  assert.match(migration, /BEGIN;[\s\S]*COMMIT;\s*$/);
});

test("INV-067: participants are isolated by ticket/user with restrictive RLS", () => {
  assert.match(migration, /PRIMARY KEY \(ticket_id, driver_user_id\)/);
  assert.match(migration, /REFERENCES public\.passenger_support_tickets\(id\)/);
  assert.match(migration, /REFERENCES public\.drivers\(id\)/);
  assert.match(migration, /driver_user_id uuid NOT NULL REFERENCES public\.users\(id\)/);
  assert.match(migration, /ENABLE ROW LEVEL SECURITY/);
  assert.match(migration, /REVOKE ALL ON TABLE public\.apois_case_driver_participants FROM PUBLIC, anon, authenticated/);
  assert.doesNotMatch(migration, /CREATE POLICY[\s\S]*ON public\.apois_case_driver_participants/);
});

test("INV-067: access helper keeps staff, passenger, no-session and recorded invited driver", () => {
  for (const line of [
    "STABLE SECURITY DEFINER",
    "SET search_path TO ''",
    "IF (SELECT auth.uid()) IS NULL THEN RETURN 'none'; END IF;",
    "IF private.has_permission('support.read') THEN RETURN 'staff'; END IF;",
    "IF t.passenger_id=public.mobility_user_id() THEN RETURN 'passenger'; END IF;",
    "t.driver_response_requested_at IS NOT NULL",
    "p.ticket_id=t.id",
    "p.driver_user_id=public.mobility_user_id()",
    "p.revoked_at IS NULL",
  ]) assert.ok(helper.includes(line), "missing helper contract " + line);
  assert.doesNotMatch(helper, /JOIN public\.rides/);
  assert.doesNotMatch(helper, /r\.driver_id/);
});

test("INV-067: request snapshots A under case+ride locks, not admin requester", () => {
  assert.match(requester, /SELECT \* INTO v_case[\s\S]*FOR UPDATE/);
  assert.match(requester, /JOIN public\.drivers d ON d\.id=r\.driver_id/);
  assert.match(requester, /FOR SHARE OF r/);
  assert.match(requester, /INSERT INTO public\.apois_case_driver_participants/);
  assert.match(requester, /v_driver_id,v_driver_user_id,'statement_request'/);
  assert.match(requester, /driver_response_requested_by=\(SELECT auth\.uid\(\)\)/);
  assert.match(requester, /IF v_case\.driver_response_requested_at IS NOT NULL THEN RETURN; END IF/);
  assert.match(requester, /case_unavailable/);
  assert.match(requester, /private\.has_permission\('support\.read'\)/);
});

test("INV-067: ticket policy matches helper; event and bucket layers still rely on it", () => {
  assert.match(migration, /DROP POLICY "apois case ticket linked driver read"/);
  assert.match(migration, /CREATE POLICY "apois case ticket linked driver read"[\s\S]*USING \(public\.apois_case_access\(id\) = 'driver'\)/);
  assert.doesNotMatch(migration, /CREATE POLICY "apois case ticket linked driver read"[\s\S]*USING \([^\n]*ride\.driver_id/);
  assert.doesNotMatch(migration, /DROP POLICY "apois case events read authorized"/);
  assert.doesNotMatch(migration, /DROP POLICY "apois case evidence metadata read authorized"/);
  assert.doesNotMatch(migration, /DROP POLICY "apois case read only authorized"/);
  assert.doesNotMatch(migration, /DROP POLICY "apois case upload authorized"/);
  assert.match(migration, /visible_to_parties/);
});

test("INV-067: staff deliberate grants are audited, bounded and role restricted", () => {
  for (const frag of [
    "private.has_permission('support.read')",
    "v_case.driver_response_requested_at IS NULL",
    "length(v_reason) NOT BETWEEN 16 AND 500",
    "SELECT d.user_id INTO v_user_id",
    "WHERE d.id=_driver_id",
    "'staff_grant'",
    "ON CONFLICT (ticket_id,driver_user_id) DO UPDATE",
    "'internal_note'",
    "FALSE",
  ]) assert.ok(grant.includes(frag), "missing staff grant safeguard " + frag);
  assert.match(migration, /REVOKE ALL ON FUNCTION[\s\S]*public\.apois_grant_case_driver_participant\(uuid,uuid,text\)[\s\S]*FROM PUBLIC,anon/);
});

test("INV-067: revocation is audited, requires active invite and valid reason", () => {
  assert.match(revoke, /private\.has_permission\('support\.read'\)/);
  assert.match(revoke, /length\(v_reason\) NOT BETWEEN 16 AND 500/);
  assert.match(revoke, /WHERE ticket_id=_ticket_id AND driver_user_id=_driver_user_id[\s\S]*AND revoked_at IS NULL/);
  assert.match(revoke, /GET DIAGNOSTICS v_changed=ROW_COUNT/);
  assert.match(revoke, /'internal_note'/);
  assert.match(revoke, /FALSE/);
});

function access(ticket, identity) {
  if (!identity.authenticated) return "none";
  if (identity.staff) return "staff";
  if (identity.userId === ticket.passengerUserId) return "passenger";
  if (ticket.requested && ticket.rideId && ticket.participants.some(
    (p) => p.userId === identity.userId && !p.revoked,
  )) return "driver";
  return "none";
}
const caseA = () => ({
  rideId: "ride1", passengerUserId: "passenger", operationalDriver: "A",
  requested: true, participants: [{ userId: "A", revoked: false }],
});
const me = (userId, staff = false) => ({ userId, staff, authenticated: true });

test("INV-067: A->B operational reassignment does not transfer case to B", () => {
  const ticket = caseA();
  assert.equal(access(ticket, me("A")), "driver");
  assert.equal(access(ticket, me("B")), "none");
  ticket.operationalDriver = "B";
  assert.equal(access(ticket, me("A")), "driver");
  assert.equal(access(ticket, me("B")), "none");
  assert.equal(access(ticket, me("passenger")), "passenger");
  assert.equal(access(ticket, me("staff", true)), "staff");
  assert.equal(access(ticket, me("thirdParty")), "none");
  assert.equal(access(ticket, { authenticated: false }), "none");
});

test("INV-067: B can join only explicitly; revoking A prevents further reads", () => {
  const ticket = caseA();
  ticket.operationalDriver = "B";
  ticket.participants.push({ userId: "B", revoked: false });
  assert.equal(access(ticket, me("A")), "driver");
  assert.equal(access(ticket, me("B")), "driver");
  ticket.participants[0].revoked = true;
  assert.equal(access(ticket, me("A")), "none");
  assert.equal(access(ticket, me("B")), "driver");
});

test("INV-067: legacy requested ticket is fail-closed for all drivers", () => {
  const ticket = caseA();
  ticket.participants = [];
  assert.equal(access(ticket, me("A")), "none");
  ticket.operationalDriver = "B";
  assert.equal(access(ticket, me("B")), "none");
  assert.equal(access(ticket, me("passenger")), "passenger");
  assert.equal(access(ticket, me("staff", true)), "staff");
});

test("INV-067: no request means no driver access, even with stray participant", () => {
  const ticket = caseA();
  ticket.requested = false;
  assert.equal(access(ticket, me("A")), "none");
});

test("INV-067: events keep internal notes staff-only; same helper gates files and reply", () => {
  const ticket = caseA();
  const eventCanRead = (who, visible) =>
    access(ticket, who) === "staff" || (visible && ["passenger", "driver"].includes(access(ticket, who)));
  const contentCanRead = (who) => ["staff", "passenger", "driver"].includes(access(ticket, who));
  assert.equal(eventCanRead(me("A"), true), true);
  assert.equal(eventCanRead(me("A"), false), false);
  assert.equal(eventCanRead(me("staff", true), false), true);
  ticket.operationalDriver = "B";
  assert.equal(eventCanRead(me("B"), true), false);
  assert.equal(contentCanRead(me("B")), false);
  assert.equal(contentCanRead(me("A")), true);
  assert.match(migration, /Existing apois_case_reply, apois_case_register_evidence/);
});
