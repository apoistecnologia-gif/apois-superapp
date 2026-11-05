// RT-02: never draw a straight line and invent a driving ETA on route failure.
// Execute only after previous voice/route and ride-visual transformations in Motorista .work.
import {readFileSync,writeFileSync} from "node:fs";
import {resolve} from "node:path";
const p=resolve(process.env.APOIS_MOTORISTA_WORKSPACE||".work/partner-motorista","src/routes/motorista.app.tsx");
let s=readFileSync(p,"utf8");
if(s.includes("APOIS_DRIVER_ROUTE_FAIL_CLOSED_V1"))throw Error("[FAIL] Route fail-closed patch duplicated");
const original=`        const fallback = [pos, dest];
        setPolyline(fallback);
        setRouteSteps([]);
        setRouteStepsPhase(null);
        const km = haversineKm(pos, dest);
        // Straight-line distance is not a verified road route.
        setLegKm(null); setEtaSeconds(null);
        focusRoute(fallback);`;
const replacement=`        // APOIS_DRIVER_ROUTE_FAIL_CLOSED_V1: road geometry and ETA are unknown.
        // Keep both markers visible, but never portray an air-line as a drivable road.
        setPolyline([]);
        setRouteSteps([]);
        setRouteStepsPhase(null);
        setLegKm(null);
        setEtaSeconds(null);
        focusRoute([]);`;
const n=s.split(original).length-1;
if(n!==1)throw Error("[FAIL] Route fallback anchor occurrences="+n);
s=s.replace(original,replacement);
if(s.includes("setPolyline(fallback)")||s.includes("Math.round((km / 35) * 3600)"))throw Error("[FAIL] Fabricated route geometry/ETA remains");
if(!s.includes("toast.warning(\"Rota indisponível. Use a navegação externa.\""))throw Error("[FAIL] External navigation warning is missing");
writeFileSync(p,s,"utf8");
console.log("[OK] Motorista: failed road route no longer masquerades as straight drivable line or estimated road ETA.");
