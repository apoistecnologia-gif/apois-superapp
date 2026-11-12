import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";

const root=resolve(process.env.APOIS_CORRIDAS_WORKSPACE||".work/corridas");
const home=readFileSync(resolve(root,"src/routes/_authenticated.inicio.tsx"),"utf8");
const profile=readFileSync(resolve(root,"src/routes/_authenticated.perfil.tsx"),"utf8");
const presence=readFileSync(resolve(root,"src/components/map/PassengerDemandSharing.tsx"),"utf8");
const sql=readFileSync(resolve("docs/QA218-MIGRACAO-ZONAS-PASSAGEIROS-OPTIN.sql"),"utf8");

test("QA219: map is unobstructed; no consent card, availability counter or nearby banner",()=>{
  assert.ok(home.includes("APOIS_PASSENGER_QA218_OPTIN_V1"));
  assert.ok(home.includes("<PassengerDemandSharing authUserId={demandUser?.id}"));
  assert.ok(home.includes("useNearbyPassengerDrivers("));
  assert.ok(home.includes("nearbyDrivers={nearby.points}"));
  assert.ok(home.includes("data-apois-qa217-route-distance"));
  assert.doesNotMatch(home,/data-apois-qa217-nearby-label|Motoristas próximos indisponíveis|Nenhum motorista próximo agora|Buscando motoristas próximos/);
  assert.ok(presence.includes("return null;"));
  assert.doesNotMatch(presence,/pointer-events-auto absolute left-3|role="status"|top-\[calc\(env\(safe-area-inset-top/);
});

test("QA219: foreground sharing default on, persistent opt-out in passenger profile",()=>{
 for(const x of [
   'return localStorage.getItem(preferenceKey(authUserId)) !== "0"',
   'setEnabled(authUserId ? readSharingPreference(authUserId) : false)',
   'role="switch" aria-checked={enabled}',
   'onClick={toggle}',
   'localStorage.setItem(preferenceKey(authUserId), next ? "1" : "0")',
   'apois_passenger_presence_ping',
   'apois_passenger_presence_stop',
   'document.visibilityState === "hidden"',
   'window.setInterval(send, 60_000)',
   'Number(latitude.toFixed(2))',
   'Number(longitude.toFixed(2))',
   'HAVING count',
   'return null;',
 ].filter(x=>x!=="HAVING count"))assert.ok(presence.includes(x),x);
 for(const x of [
  "APOIS_PASSENGER_QA219_PRIVACY_V1",
  '<PassengerDemandPrivacySettings authUserId={user?.id} />',
  "<PassengerAccountDeletion",
  "<PassengerProfilePhoto",
  "<PassengerCompletedRideCount",
 ])assert.ok(profile.includes(x),x);
});

test("QA219: server protocol keeps real anonymous cohorts with restricted storage",()=>{
 for(const x of [
   "ENABLE ROW LEVEL SECURITY",
   "REVOKE ALL ON TABLE public.apois_passenger_demand_presence",
   "HAVING count(DISTINCT p.passenger_id)>=5",
   "round(_lat::numeric,2)",
   "round(_lng::numeric,2)",
   "p.refreshed_at>now()-interval '2 minutes'",
   "SELECT cron.schedule",
   "apois_passenger_presence_stop_internal",
   "SECURITY INVOKER",
 ])assert.ok(sql.includes(x),x);
 assert.ok(!sql.includes("GRANT SELECT ON public.apois_passenger_demand_presence TO authenticated"));
});
