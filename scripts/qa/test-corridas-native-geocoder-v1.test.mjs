import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";

const root = resolve(process.env.APOIS_CORRIDAS_WORKSPACE || ".work/corridas");
const hook = readFileSync(resolve(root, "src/hooks/use-pickup-address.tsx"), "utf8");
const native = readFileSync("scripts/android/APOISNativeGeocoderPlugin.java", "utf8");
const installer = readFileSync("scripts/install-apois-client-native-geocoder.mjs", "utf8");

test("QA215 GPS anti-jitter/retry and original backend lookup remain intact",()=>{
  for(const token of [
    "APOIS_PASSENGER_QA215_PICKUP_BACKOFF_V1",
    "APOIS_NATIVE_GEOCODER_RECOVERY_V1",
    'action: "reverse_geocode"',
    '"google-maps-address"',
    "const refreshAddress = useCallback(async (force = true) => {",
    "void refreshAddress(false);",
    "elapsed < 20000",
    "lastGeocodeRef.current = null;",
    "geocodeBusyRef.current = false;",
    "runningCell.current = false;",
  ])assert.ok(hook.includes(token),token);
  assert.equal((hook.match(/action: "reverse_geocode"/g)||[]).length,1);
});
test("Native geocoder is only invoked on device after first provider failure",()=>{
  for(const token of [
    'import { Capacitor, registerPlugin } from "@capacitor/core";',
    'registerPlugin<APOISNativeGeocoder>("APOISNativeGeocoder")',
    "if (Capacitor.isNativePlatform() && location &&",
    "apoisNativeGeocoder.reverse({ lat: location.latitude, lng: location.longitude })",
    "setPickupLabel(verifiedAddress);",
    "setPickupShortLabel(shortLabel);",
    "setStatus(\"success\");",
    "if (!nativeRecovered) {",
    'setStatus(addressKnownRef.current ? "success" : "error");',
  ])assert.ok(hook.includes(token),token);
  const invoke=hook.indexOf('action: "reverse_geocode"');
  const plugin=hook.indexOf("apoisNativeGeocoder.reverse(");
  assert.ok(invoke>=0 && plugin>invoke);
  assert.equal((hook.match(/registerPlugin<APOISNativeGeocoder>/g)||[]).length,1);
});
test("No added paid Google APIs, fabricated labels or GPS coordinate rewrites",()=>{
  for(const token of ["@CapacitorPlugin(name = \"APOISNativeGeocoder\")",
    "android.location.Geocoder", "Geocoder.isPresent()",
    "getFromLocation(latitude, longitude, 1", "call.resolve(output)",
    'output.put("approximate", street.isEmpty())'
  ])assert.ok(native.includes(token),token);
  assert.ok(!native.includes("maps.googleapis.com"));
  assert.ok(!native.includes("http://") && !native.includes("https://"));
  assert.ok(!native.includes("getLatitude()") && !native.includes("getLongitude()"));
  assert.ok(installer.includes("registerPlugin(APOISNativeGeocoderPlugin.class)"));
  assert.ok(installer.includes("super.onCreate(savedInstanceState)"));
});
