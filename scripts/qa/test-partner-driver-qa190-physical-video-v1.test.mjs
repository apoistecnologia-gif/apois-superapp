import test from "node:test";import assert from "node:assert/strict";
import {readFileSync} from "node:fs";import {resolve} from "node:path";
const root=resolve(process.env.APOIS_MOTORISTA_WORKSPACE||".work/partner-motorista");
const s=readFileSync(resolve(root,"src/routes/motorista.app.tsx"),"utf8");
test("QA190 offer exposes map and keeps all information/actions inside scroll",()=>{
 const a=s.indexOf("function IncomingOffer("),b=s.indexOf("\nfunction InfoCard(",a);
 assert.ok(a>0&&b>a);
 const x=s.slice(a,b);
 for(const c of ['min(68dvh, 540px)','overflow-y-auto','sticky bottom-0','onClick={onReject}','onClick={onAccept}','ride.destination_name','ride.origin_name','estimated_price'])assert.ok(x.includes(c),c);
 assert.ok(!x.includes('min(94dvh, 680px)'));
});
test("QA190 route camera settles after polylines without fabricating GPS or changing renderer",()=>{
 for(const x of ['APOIS_DRIVER_QA190_PHYSICAL_VIDEO_V1','APOIS_DRIVER_RIDE_MAP_STABILITY_V2','applyNavigationCamera(map, latest, points, dest, true)','mapRef.current !== map || !autoFollowRef.current','activeRef.current?.status !== active.status','220);'])assert.ok(s.includes(x),x);
});
test("QA190 overview returns to navigation after 7s, Seguir remains immediate",()=>{
 for(const x of ['const routeOverviewEpochRef = useRef(0);','routeOverviewEpochRef.current += 1;','routeOverviewEpochRef.current!==epoch','7000);','autoFollowRef.current=true;', 'onRecenter={recenter}','onShowRoute={() =>'])assert.ok(s.includes(x),x);
 for(const x of ['onStart(pinCode)','onClick={onAccept}','onClick={onReject}','onClick={handleComplete}','Nome indisponível'])assert.ok(s.includes(x),x);
});
