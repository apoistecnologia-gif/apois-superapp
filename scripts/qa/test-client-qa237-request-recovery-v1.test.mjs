// QA237: verifies the exact generated passenger page and its existing safety gates.
import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
const home=readFileSync(resolve(".work/corridas/src/routes/_authenticated.inicio.tsx"),"utf8");
const checkout=readFileSync(resolve(".work/corridas/src/hooks/use-checkout-preparation.tsx"),"utf8");
const route=readFileSync(resolve(".work/corridas/src/hooks/use-route.tsx"),"utf8");
const price=readFileSync(resolve(".work/corridas/src/hooks/use-pricing.tsx"),"utf8");
test("visible request disabled reason for stale, payment, category, debt and insufficient funds",()=>{
 for(const s of [
  "APOIS_CLIENT_QA237_REQUEST_RECOVERY_V1",
  'data-apois-qa237-request-gate="true"',
  'role="status"',
  'qa237BlockMessage',
  'route_missing','route_outdated','pricing_invalid',
  'payment_method_missing','category_missing','passenger_debt_block',
  'insufficient_balance','user_not_authenticated',
 ])assert.ok(home.includes(s),"reason "+s);
});
test("retry is only an explicit safe re-calculation, no old quote submission",()=>{
 for(const s of [
  "qa237RetryRoute",
  "qa237RetryPricing",
  'data-apois-qa237-retry="true"',
  "Atualizar percurso e valor",
  'if(qa237RouteProblem)await qa237RetryRoute();',
  'else if(qa237PricingProblem)await qa237RetryPricing();',
  'disabled={qa237Retrying}'
 ])assert.ok(home.includes(s),"retry "+s);
 assert.ok(home.includes('disabled={!checkout.readiness || !!routeError}'),"request gate cannot be bypassed");
 assert.ok(home.includes("if (!checkout.readiness) return;"),"click handler also enforces readiness");
 assert.ok(checkout.includes('blockingReasons.length === 0'),"checkout never ignores blockers");
 assert.ok(checkout.includes('route_outdated'),"stale route blocks submission");
 assert.ok(checkout.includes('pricing_invalid'),"unpriced route blocks submission");
 assert.ok(route.includes("routeRequestSnapshotRef"),"previous stable GPS route policy");
 assert.ok(price.includes("latestRequestKeyRef"),"pricing request ownership remains enforced");
});
test("no accidental backend writes in QA237 UI installer",()=>{
 const patch=readFileSync(resolve("scripts/fix-corridas-client-qa237-request-recovery-v1.mjs"),"utf8");
 for(const disallowed of ["supabase.rpc(","supabase.from(","alter table","create table","send-ride-push","refund("])
   assert.ok(!patch.includes(disallowed),"installer may not add backend operations: "+disallowed);
});
