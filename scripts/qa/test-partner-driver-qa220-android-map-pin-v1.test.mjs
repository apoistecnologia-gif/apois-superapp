import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  marker,
  patchAndroidMap,
  patchDriverCamera,
  patchPinDigits,
  patchPinCss
} from "../fix-partner-driver-qa220-android-map-pin-v1.mjs";

const mapFixture = [
  '  const isDriverRole = APP_ROLE === "driver";',
  '  const styles = useMemo(() => isDriverRole ? getMapStyleForTheme("light") : getMapStyleForTheme(theme), [isDriverRole,theme]);',
  '  const useCloudVector = isDriverRole && cloudVectorConfig !== null;',
  '// APOIS_DRIVER_QA202_CLOUD_VECTOR_READINESS_V1',
  '// APOIS_DRIVER_VIDEO_20261112_ROTATION_V1',
  '  const stableMapOptions = {',
  '    mapId: useCloudVector ? cloudVectorConfig?.mapId : undefined,',
  '    renderingType: google.maps.RenderingType.RASTER,',
  '    styles: useCloudVector ? undefined : styles,',
  '  };',
  '  <GoogleMap options={stableMapOptions} onUnmount={handleUnmount} />'
].join("\n");

const cameraFixture = [
  '// APOIS_DRIVER_QA209_CAMERA_V1',
  '// APOIS_DRIVER_VIDEO_20261112_ROTATION_V1',
  '      if(immediate || movedMeters >= 12)map.panTo(center);',
  '  const routeOverviewEpochRef = useRef(0);',
  '  function recenter() {}',
  '  if (!position || !mapRef.current || !autoFollowRef.current) return;',
  '            autoFollowRef.current=false;',
  '            m.fitBounds(b,{top:155,right:32,bottom:220,left:32});',
  '            const epoch=++routeOverviewEpochRef.current;',
  '            window.setTimeout(() => {',
  '              if(routeOverviewEpochRef.current!==epoch || mapRef.current!==m) return;',
  '              if(activeRef.current?.id!==active.id || activeRef.current?.status!=="em_viagem") return;',
  '              autoFollowRef.current=true;',
  '              const latest=positionRef.current;',
  '              if(latest) applyNavigationCamera(m,latest,polyline,activeNavigationDestination,true);',
  '            }, 7000);',
  '  const callbacks = ["onClick={onShowRoute}","onClick={onRecenter}","onStart(pinCode)","onClick={handleComplete}","onClick={onAccept}","onClick={onReject}"];'
].join("\n");

const pinFixture = [
  'function ActiveRidePanel() {',
  '  // APOIS_DRIVER_QA209_REAL_PIN_V1',
  '  // pinDigitRefs.current[position]',
  '  // onStart(pinCode)',
  '  // text-[#111827]',
  '  return <input',
  '                        type="text"',
  '                        inputMode="numeric"',
  '                        value={pinCode[position] ?? ""}',
  '  />;',
  '}',
  'function ActionButton() {}'
].join("\n");

test("Android chooses stable raster without changing desktop vector/Map ID gate", () => {
  const result=patchAndroidMap(mapFixture);
  assert.ok(result.includes(marker));
  assert.ok(result.includes('/Android/i.test(navigator.userAgent)'));
  assert.ok(result.includes('cloudVectorConfig !== null && !stableAndroidMap'));
  assert.ok(result.includes('styles: useCloudVector ? undefined : styles'));
  assert.ok(result.includes('mapId: useCloudVector ? cloudVectorConfig?.mapId : undefined'));
  assert.ok(result.includes('featureType: "landscape.man_made"'));
  assert.ok(result.includes('getMapStyleForTheme(theme)'));
  assert.throws(() => patchAndroidMap(result),/applied twice/);
  assert.throws(() => patchAndroidMap(mapFixture.replace('options={stableMapOptions}', 'options={{}}')), /prerequisite/);
});

test("route overview remains explicit; no seven-second automatic camera snap", () => {
  const result=patchDriverCamera(cameraFixture);
  assert.ok(result.includes(marker));
  assert.ok(result.includes('m.fitBounds(b,{top:155,right:32,bottom:220,left:32});'),"Ver rota still works");
  assert.ok(result.includes('routeOverviewEpochRef.current += 1;'),"Seguir/recenter controls preserved");
  assert.ok(!result.includes('}, 7000);'));
  assert.ok(result.includes('map.panTo({lat: position.lat, lng: position.lng})'),"raster follows real GPS, not offset bearing");
  assert.ok(result.includes('onClick={onRecenter}'));
  assert.throws(() => patchDriverCamera(result),/applied twice/);
  assert.throws(() => patchDriverCamera(cameraFixture.replace('}, 7000);','}, 9000);')), /no surprise return/);
});

test("four real PIN inputs keep server validation and show black digits on pale backgrounds", () => {
  const result=patchPinDigits(pinFixture);
  const css=patchPinCss("/* styles */");
  assert.ok(result.includes('data-apois-qa220-pin-digit-v1="true"'));
  assert.equal((result.match(/data-apois-qa220-pin-digit-v1/g)||[]).length,1);
  assert.ok(result.includes('WebkitTextFillColor: "#111827"'));
  assert.ok(result.includes('value={pinCode[position] ?? ""}'));
  assert.ok(result.includes('onStart(pinCode)'));
  assert.ok(css.includes('color: #111827 !important'));
  assert.ok(css.includes('-webkit-text-fill-color: #111827 !important'));
  assert.ok(css.includes('background-color: #FFF1F2 !important'));
  assert.throws(() => patchPinDigits(result),/applied twice/);
  assert.throws(() => patchPinCss(css),/already applied/);
});

test("generated Motorista contains QA220 fixes after QA219 and all preceding transforms", () => {
  const root=resolve(process.env.APOIS_MOTORISTA_WORKSPACE || ".work/partner-motorista");
  const mapPath=resolve(root,"src/components/MovviMap.tsx");
  const routePath=resolve(root,"src/routes/motorista.app.tsx");
  const cssPath=resolve(root,"src/styles.css");
  // Standalone source tests can run without a workspace. The real CI build must
  // create .work first, then execute this assertion after QA220 transformation.
  if (!existsSync(mapPath) && !existsSync(routePath)) return;
  assert.ok(existsSync(mapPath) && existsSync(routePath) && existsSync(cssPath));
  const map=readFileSync(mapPath,"utf8");
  const route=readFileSync(routePath,"utf8");
  const css=readFileSync(cssPath,"utf8");
  for (const value of [marker,"!stableAndroidMap","landscape.man_made","options={stableMapOptions}"]) assert.ok(map.includes(value),value);
  for (const value of [marker,"map.panTo({lat: position.lat, lng: position.lng})", "onClick={onRecenter}", "onClick={onShowRoute}", "onStart(pinCode)", 'data-apois-qa220-pin-digit-v1="true"', "APOIS_DRIVER_QA219_STALE_TERMINAL_EVENT_GUARD_V1", "APOIS_DRIVER_QA219_ASYNC_RIDE_ACTION_SCOPE_V1"]) assert.ok(route.includes(value),value);
  assert.ok(!route.includes('}, 7000);'),"no auto-snap timer survives");
  assert.ok(css.includes(marker) && css.includes('-webkit-text-fill-color: #111827 !important'));
});
