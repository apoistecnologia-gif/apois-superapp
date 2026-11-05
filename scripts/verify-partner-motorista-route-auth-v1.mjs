import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
const root=resolve(process.env.APOIS_MOTORISTA_WORKSPACE||".work/partner-motorista");
const s=readFileSync(resolve(root,"src/lib/driverRoutes.mobile.ts"),"utf8");
for(const key of [
"APOIS_DRIVER_ROUTE_AUTH_V1",
"supabase.auth.getSession()",
"supabase.auth.refreshSession()",
"headers: { Authorization: \"Bearer \" + jwt }",
"if (isHttp401(call.error))",
"if (isHttp401(error))",
"call = await invokeRoute(refreshed.session.access_token);",
"passenger-routes-compute",
"if (!origin || !destination)",
"Number.isFinite(distanceMeters)",
"Number.isFinite(durationSeconds)",
"Array.isArray(result.steps)",
"return {",
"encodedPolyline: result.encodedPolyline",
])assert.ok(s.includes(key),"Driver route authorization / geometry contract missing "+key);
const count=(term)=>s.split(term).length-1;
assert.equal(count("supabase.auth.refreshSession()"),1,"Only one retry per failing route invocation");
assert.equal(count('supabase.functions.invoke<DriverRouteResponse>('),1,"Keep the original Edge Function as only route provider");
assert.equal(count('"passenger-routes-compute"'),1,"No alternative unverified provider");
assert.ok(!s.includes("service_role")&&!s.includes("Bearer anon"),"No privilege bypass");
assert.ok(!s.includes("for (let attempt")&&!s.includes("while ("),"No unbounded retries");
console.log("[OK] Motorista route: scoped auth JWT, one bounded 401 retry, original provider/geometry validation.");
