import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";

const root=resolve(process.env.APOIS_CORRIDAS_WORKSPACE||".work/corridas");
const home=readFileSync(resolve(root,"src/routes/_authenticated.inicio.tsx"),"utf8");
const consent=readFileSync(resolve(root,"src/components/map/PassengerDemandSharing.tsx"),"utf8");
const sql=readFileSync(resolve("docs/QA218-MIGRACAO-ZONAS-PASSAGEIROS-OPTIN.sql"),"utf8");
test("QA218 Passenger: consent off by default and explicitly controlled per account",()=>{
 for(const s of [
   "const [enabled, setEnabled] = useState(false)",
   'authUserId ? "apois:passenger:demand-consent:" + authUserId',
   'role="switch" aria-checked={enabled}',
   "onClick={toggle}",
   'apois_passenger_presence_ping',
   'apois_passenger_presence_stop',
   'document.visibilityState === "hidden"',
   'window.setInterval(send, 60_000)',
   'Number(latitude.toFixed(2))',
   "Nenhum"
 ].filter(s=>s!=="Nenhum"))
   assert.ok(consent.includes(s),s);
 assert.ok(home.includes("APOIS_PASSENGER_QA218_OPTIN_V1"));
 assert.ok(home.includes("showControl={!hasDestination}"));
 assert.ok(home.includes("useNearbyPassengerDrivers("));
 assert.ok(home.includes("data-apois-qa217-route-distance"));
});
test("QA218 server protocol: no precise passenger read, only cohorts 5+, short TTL",()=>{
 for(const s of [
  "ENABLE ROW LEVEL SECURITY",
  "REVOKE ALL ON TABLE public.apois_passenger_demand_presence",
  "HAVING count(DISTINCT p.passenger_id)>=5",
  "round(_lat::numeric,2)",
  "round(_lng::numeric,2)",
  "p.refreshed_at>now()-interval '2 minutes'",
  "SELECT cron.schedule",
  "apois_passenger_presence_stop_internal",
  "SECURITY INVOKER",
 ])assert.ok(sql.includes(s),s);
 assert.ok(!/GRANT SELECT ON public\.apois_passenger_demand_presence TO authenticated/.test(sql));
});
