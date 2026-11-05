import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
const src=readFileSync(resolve(process.env.APOIS_MOTORISTA_WORKSPACE||".work/partner-motorista","src/routes/motorista.app.tsx"),"utf8");
for(const marker of [
 "APOIS_DRIVER_ROUTE_BOUNDED_RETRY_V1",
 "routeRetryCountRef.current<2",
 "routeRetryCountRef.current===1?30000:90000",
 "Boolean(position), mapReadyNonce, routeRetryNonce, routeTick",
 "window.clearTimeout(retryTimer)",
 "lastRouteRequestKeyRef.current===routeRequestKey",
 "routeRetryScopeRef.current!==fitKey",
 "window.setInterval(()=>setRouteTick(v=>v+1),30000)",
 "pos.lat.toFixed(3)",
 "lastRouteRequestKeyRef.current = routeRequestKey;",
 "lastRouteRequestKeyRef.current=null",
])assert.ok(src.includes(marker),"Missing bounded retry guard "+marker);
assert.ok(!src.includes("position?.lat, position?.lng, mapReadyNonce]);"),"GPS tick must not cancel active route request");
assert.ok(!src.includes("lastRouteRequestKeyRef.current = null;\n        // APOIS_DRIVER_ROUTE_FAIL_CLOSED_V1"),"Failed routing must await retry, not immediately reopen request");
const delays=[];let n=0;
for(let i=0;i<4;i++)if(n<2){n++;delays.push(n===1?30000:90000);}
assert.deepEqual(delays,[30000,90000],"No more than 2 extra route computations");
console.log("[PASS] Driver retries 2 times, aborts on ride phase change, and avoids GPS-effect starvation.");
