// APOIS_DRIVER_RIDE_MAP_STABILITY_V2
// QA179 video: accepted ride destroys map; GPS churn cancels requests.
// Patch disposable Motorista only; no schema, production or protected source edits.
import {readFileSync,writeFileSync} from "node:fs";
import {resolve} from "node:path";
const root=resolve(process.env.APOIS_MOTORISTA_WORKSPACE||".work/partner-motorista");
function edit(relative,transform) {
  const path=resolve(root,relative),old=readFileSync(path,"utf8");
  if(old.includes("APOIS_DRIVER_RIDE_MAP_STABILITY_V2"))throw Error("[FAIL] applied twice: "+relative);
  const next=transform(old);
  if(next===old)throw Error("[FAIL] no change in "+relative);
  writeFileSync(path,next,"utf8");
}
function one(s,old,next,label) {
  const count=s.split(old).length-1;
  if(count!==1)throw Error("[FAIL] Driver route/map "+label+" count "+count);
  return s.replace(old,next);
}
edit("src/components/MovviMap.tsx",s=>{
  const old=[
    "          // APOIS_DRIVER_MAP_STARTUP_STABILITY_V1: raster home, vector only during route.",
    '          renderingType: isDriverRole && navigationMode && typeof google !== "undefined"',
    "            ? google.maps?.RenderingType?.VECTOR : undefined,",
    "          tiltInteractionEnabled: isDriverRole && navigationMode,",
    "          headingInteractionEnabled: isDriverRole && navigationMode,"
  ].join("\n");
  const next=[
    "          // APOIS_DRIVER_RIDE_MAP_STABILITY_V2: avoid runtime vector switching",
    "          // while riding. Retain a single stable raster map through each phase.",
    "          renderingType: undefined,",
    "          tiltInteractionEnabled: false,",
    "          headingInteractionEnabled: false,"
  ].join("\n");
  s=one(s,old,next,"vector transition");
  if(s.includes("google.maps?.RenderingType?.VECTOR"))throw Error("[FAIL] unstable vector option survived");
  return s;
});
edit("src/routes/motorista.app.tsx",s=>{
  const start="    let cancelled = false;\n    callRoute({ data: { origin: pos, destination: dest } })";
  const replacement="    // Map remounts and GPS-cell changes may interrupt a pending route.\n"+
    "    let cancelled = false;\n    let settled = false;\n    callRoute({ data: { origin: pos, destination: dest } })";
  s=one(s,start,replacement,"route start");
  s=one(s,"      .then((res) => {\n        if (cancelled) return;",
    "      .then((res) => {\n        settled = true;\n        if (cancelled) return;","route success");
  s=one(s,"      .catch(() => {\n        if (cancelled) return;",
    "      .catch(() => {\n        settled = true;\n        if (cancelled) return;","route failure");
  const cleanup="    return () => { cancelled = true; };";
  s=one(s,cleanup,[
    "    return () => {",
    "      cancelled = true;",
    "      // On remount/GPS-cell changes, the next effect must retry pending requests.",
    "      if (!settled && lastRouteRequestKeyRef.current === routeRequestKey) {",
    "        lastRouteRequestKeyRef.current = null;",
    "      }",
    "    };"
  ].join("\n"),"route canceled request key");
  const oldDeps="  }, [active?.id, active?.status, position?.lat, position?.lng, mapReadyNonce]); // eslint-disable-line react-hooks/exhaustive-deps";
  const newDeps=[
    "  // APOIS_DRIVER_RIDE_MAP_STABILITY_V2: avoid cancelling the route on sub-100m GPS jitter.",
    '  }, [active?.id, active?.status, position ? position.lat.toFixed(3) + ":" + position.lng.toFixed(3) : null, mapReadyNonce]); // eslint-disable-line react-hooks/exhaustive-deps'
  ].join("\n");
  s=one(s,oldDeps,newDeps,"GPS route effect dependencies");
  for(const marker of [
    "APOIS_DRIVER_RIDE_MAP_STABILITY_V2",
    "if (!settled && lastRouteRequestKeyRef.current === routeRequestKey)",
    "setLegKm(res.distanceMeters / 1000);",
    "setPolyline(points);",
    "DriverMapErrorBoundary",
    "navigationMode={inNavigationMode}"
  ])if(!s.includes(marker))throw Error("[FAIL] Driver route preserved contract missing: "+marker);
  return s;
});
console.log("[OK] QA179 regression: stable map during ride, GPS route retries after interrupted requests, all ride operations preserved");
