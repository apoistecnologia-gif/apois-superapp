import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";import {resolve} from "node:path";
const root=resolve(process.env.APOIS_MOTORISTA_WORKSPACE||".work/partner-motorista");
const map=readFileSync(resolve(root,"src/components/MovviMap.tsx"),"utf8");
const ride=readFileSync(resolve(root,"src/routes/motorista.app.tsx"),"utf8");
const sql=readFileSync(resolve(process.cwd(),"supabase/corridas-forward-migrations/20261111_apois_assigned_passenger_account_identity.sql"),"utf8");
test("QA192 initial map selects vector once only on capable device, fallback remains",()=>{
 for(const x of ["APOIS_DRIVER_QA192_VECTOR_PASSENGER_V1","driverVectorCapable] = useState(() => {","failIfMajorPerformanceCaveat: true","google.maps.RenderingType.VECTOR","forceRasterAfterFailure",
 "setForceRasterAfterFailure(true)","key={mapAttempt}","tilesloaded","DriverMapErrorBoundary"])
 assert.ok(map.includes(x)||ride.includes(x),x);
 assert.ok(!map.includes("renderingType: isDriverRole && navigationMode"));
 assert.ok(!map.includes("renderingType: undefined"));
});
test("QA192 navigation only changes camera on actual route; no source-lock or dispatcher changes",()=>{
 for(const x of ["APOIS_DRIVER_FORWARD_CAMERA_V1","routeHeadingFrom(position, route, destination)","navMap.setHeading?.(heading)","navMap.setTilt?.(40)","APOIS_DRIVER_RIDE_MAP_STABILITY_V2","onStart(pinCode)","callRoute({ data: { origin: pos, destination: dest } })"])assert.ok(ride.includes(x),x);
});
test("QA192 assigned passenger SQL does not expose generic RLS or wrong auth ID",()=>{
 for(const x of ["CREATE OR REPLACE FUNCTION public.apois_driver_assigned_passenger(p_ride_id uuid)",
 "SET search_path = ''","SECURITY DEFINER","(SELECT auth.uid()) IS NOT NULL",
 "d.user_id = (SELECT public.mobility_user_id())",
 "COALESCE(r.accepted_driver_id, r.driver_id)",
 "u.id = r.passenger_id","r.status IN ('motorista_a_caminho','motorista_chegou','em_viagem')",
 "u.deleted_at IS NULL","REVOKE ALL ON FUNCTION","TO authenticated"])
 assert.ok(sql.includes(x),x);
 assert.ok(!sql.includes("d.user_id = auth.uid()"));
 assert.ok(!sql.includes("ALTER TABLE"));
 assert.ok(ride.includes('rpc("apois_driver_assigned_passenger"'));
 assert.ok(ride.includes('supabase.from("users")'));
});
