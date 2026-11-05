import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
const root=resolve(process.env.APOIS_MOTORISTA_WORKSPACE||".work/partner-motorista");
const src=readFileSync(resolve(root,"src/routes/motorista.app.tsx"),"utf8");
const marker="APOIS_DRIVER_ROUTE_FAIL_CLOSED_V1";
assert.ok(src.includes(marker),"Error fallback guard marker present");
assert.ok(!src.includes("setPolyline(fallback)"),"No fake line when Google route fails");
assert.ok(!src.includes("Math.round((km / 35) * 3600)"),"No invented 35km/h ETA");
for(const needle of ["setPolyline([]);","setRouteSteps([]);","setLegKm(null);","setEtaSeconds(null);","focusRoute([]);",'toast.warning("Rota indisponível. Use a navegação externa."']){
 assert.ok(src.includes(needle),"Missing route fail-closed action "+needle);
}
assert.ok(src.includes("callRoute({ data: { origin: pos, destination: dest } })"),"Google road routing still invoked");
console.log("[PASS] Route errors leave markers and external navigation, not fabricated routes.");
