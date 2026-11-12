// APOIS_NATIVE_GEOCODER_INSTALL_V1
// Install into the disposable Capacitor Android tree produced by 'cap add'.
// No changes to protected Corridas/Entregas sources or the Partner APK.
import {readFileSync,writeFileSync,mkdirSync} from "node:fs";
import {resolve,dirname} from "node:path";

const expectedPackage = "br.com.apois.app";
const root = resolve("superapp/shell/android/app/src/main/java/br/com/apois/app");
const activityPath = resolve(root, "MainActivity.java");
const nativePath = resolve(root, "APOISNativeGeocoderPlugin.java");
const template = readFileSync("scripts/android/APOISNativeGeocoderPlugin.java","utf8");
if (!template.startsWith("package " + expectedPackage + ";")) throw Error("[FAIL] Java native geocoder package changed");
if (!template.includes('@CapacitorPlugin(name = "APOISNativeGeocoder")') ||
    !template.includes('Geocoder.getFromLocation') &&
    !template.includes('geocoder.getFromLocation')) throw Error("[FAIL] Android native geocoder is invalid");
mkdirSync(dirname(nativePath),{recursive:true});
const source = readFileSync(activityPath,"utf8");
if (!source.includes("package " + expectedPackage + ";") || !source.includes("extends BridgeActivity"))
  throw Error("[FAIL] Generated APOIS Cliente MainActivity changed");
// The existing native WebView overscroll hardener customizes MainActivity.
// Register the geocoder before super.onCreate, preserving ALL existing hooks.
const onCreate = "        super.onCreate(savedInstanceState);";
const original = /public class MainActivity extends BridgeActivity\\s*\\{\\s*\\}/;
let updated = source;
if (!updated.includes("APOIS_NATIVE_GEOCODER_INSTALL_V1")) {
  if (source.includes(onCreate)) {
    if (source.split(onCreate).length !== 2) throw Error("[FAIL] Ambiguous MainActivity onCreate");
    updated = source.replace(onCreate,
      "        // APOIS_NATIVE_GEOCODER_INSTALL_V1\\n" +
      "        registerPlugin(APOISNativeGeocoderPlugin.class);\\n" + onCreate);
  } else if (original.test(source)) {
    updated = source.replace(original, `public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(android.os.Bundle savedInstanceState) {
        // APOIS_NATIVE_GEOCODER_INSTALL_V1
        registerPlugin(APOISNativeGeocoderPlugin.class);
        super.onCreate(savedInstanceState);
    }
}`);
  } else {
    throw Error("[FAIL] Refusing to overwrite customized MainActivity");
  }
}
if (!updated.includes("registerPlugin(APOISNativeGeocoderPlugin.class);"))
  throw Error("[FAIL] Native plugin registration missing");
writeFileSync(activityPath,updated,"utf8");
writeFileSync(nativePath,template,"utf8");
console.log("[OK] APOIS Cliente Android OS geocoder registered in generated Capacitor shell.");
