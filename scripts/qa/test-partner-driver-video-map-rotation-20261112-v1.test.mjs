// QA physical clip 1001992704.mp4 — camera orientation, no APK.
import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
const root=resolve(process.env.APOIS_MOTORISTA_WORKSPACE||".work/partner-motorista");
const map=readFileSync(resolve(root,"src/components/MovviMap.tsx"),"utf8");
const app=readFileSync(resolve(root,"src/routes/motorista.app.tsx"),"utf8");
function section(begin,end) {
 const a=app.indexOf(begin),b=a<0?-1:app.indexOf(end,a+begin.length);
 assert.ok(a>=0&&b>a,begin+" / "+end);
 return app.slice(a,b);
}
test("Vector Map ID remains approved-only, Google decides hardware support, no premature WebGL context",()=>{
 for(const token of ["APOIS_DRIVER_VIDEO_20261112_ROTATION_V1",
 'VITE_APOIS_PARTNER_CLOUD_STYLE_VERIFIED !== "true"',
 'VITE_APOIS_PARTNER_VECTOR_MAP_ID',
 'mapId: useCloudVector ? cloudVectorConfig?.mapId : undefined',
 'google.maps.RenderingType.VECTOR : google.maps.RenderingType.RASTER',
 'styles: useCloudVector ? undefined : styles',
 'options={stableMapOptions}'])
 assert.ok(map.includes(token),token);
 assert.ok(!map.includes("WEBGL_lose_context"));
 assert.ok(!map.includes("canvas.getContext("));
 assert.ok(map.includes("if (!useCloudVector) map.setOptions({ styles, backgroundColor: bgColor });"), "cloud Map ID must not receive JSON style in onLoad");
 assert.ok(!map.includes("      map.setOptions({ styles, backgroundColor: bgColor });\n"), "unguarded map initialization");
});
test("Actual GPS movement heading used before next route curve, parked fallback remains route bearing",()=>{
 const cam=section("function applyNavigationCamera(","type RequestRemovalReason");
 for(const token of [
 'movementBearing=previous && movedMeters >= 12',
 'gpsCourse=normalizeHeading(position.heading)',
 'const movingCourse=movementBearing != null ? (gpsCourse ?? movementBearing) : null;',
 '(movingCourse ?? routeBearing ?? gpsCourse)',
 'heading:heading ?? 0',
 'tilt:nearDestination ? 0 : 25',
 'if (!immediate && previous && (movedMeters < 12 || now-previous.at < 1800)) return;',
 'if (!immediate && previous && movedMeters > 700',
 ])
 assert.ok(cam.includes(token),token);
});
test("Pickup→destination transition clears old heading but keeps one stable Google Map",()=>{
 assert.ok(app.includes('navigationModeKeyRef.current = navKey;\n    // New pickup/destination phase must not inherit the old camera bearing.\n    driverCameraHistory.delete(map);'));
 assert.ok(app.includes('if (mapRef.current === m) return;'));
 const cam=section("function applyNavigationCamera(","type RequestRemovalReason");
 assert.ok(cam.includes("driverCameraHistory.set(map"));
 assert.ok(app.includes("driverCameraHistory.delete(map)"));
 assert.ok(app.includes("onRecenter={recenter}"));
});
test("If Google falls back to raster, code never promises map rotation or hides the problem",()=>{
 const cam=section("function applyNavigationCamera(","type RequestRemovalReason");
 assert.ok(cam.includes('const actualRenderer=map.getRenderingType?.();'));
 assert.ok(cam.includes('actualRenderer === google.maps.RenderingType.VECTOR'));
 assert.ok(cam.includes('actualRenderer === google.maps.RenderingType.RASTER'));
 assert.ok(cam.includes('driverRasterWarningHistory.has(map)'));
 assert.ok(cam.includes("map.panTo(center)"));
 assert.ok(!cam.includes('map.setRenderingType('));
});
test("Motorista APIs, accepted trip status, preferences and security PIN are unchanged",()=>{
 for(const token of [
 "APOIS_DRIVER_QA209_CAMERA_V1",
 "APOIS_DRIVER_PDF_20261112_V1",
 "data-apois-offer-expandable-v1",
 "data-apois-trip-one-metrics-v1",
 "data-apois-waiting-summary-v1",
 "onClick={onShowRoute}",
 "onClick={onRecenter}",
 "onClick={onAccept}",
 "onClick={onReject}",
 "onStart(pinCode)",
 "onClick={handleComplete}",
 "routeRequestEpochRef.current",
 "apois_driver_assigned_passenger",
 ])assert.ok(app.includes(token),token);
});
