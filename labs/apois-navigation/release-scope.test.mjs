import assert from "node:assert/strict";
import test from "node:test";
import {allowedPath,assertLabScope,assertDisabledHost,assertPrivateManifest} from "./release-scope.mjs";
test("only experiment sources and dedicated workflows",()=>{
  assertLabScope(["labs/apois-navigation/README.md",".github/workflows/apois-navigation-lab-stage1.yml"]);
  for(const p of ["superapp/partner-shell/android/app/build.gradle","supabase/migrations/1.sql",
    "scripts/install-motorista-qa290-launcher.mjs",".github/workflows/release.yml","labs/apois-navigation-other/README.md",
    "labs/apois-navigation/../app.ts","labs/apois-navigation//a","labs/apois-navigation/test.apk",
    "labs/apois-navigation/debug.JKS","labs/apois-navigation/signing.pem"]){
    assert.equal(allowedPath(p),false,p);
    assert.throws(()=>assertLabScope([p]));
  }
});
test("production feature activation is rejected",()=>{
  const host="const EXPERIMENTAL_INTERNAL_NAVIGATION:boolean=false; enabled:EXPERIMENTAL_INTERNAL_NAVIGATION; if(!EXPERIMENTAL_INTERNAL_NAVIGATION)return ()=>{};";
  assertDisabledHost(host);
  assert.throws(()=>assertDisabledHost(host.replace("=false","=true")));
  assert.throws(()=>assertDisabledHost(host.replace("=false","=remoteFlag")));
});
test("native activities cannot be exported or gain permissions",()=>{
  const xml='<manifest><application><activity android:name="br.com.apois.navigation.lab.LabNavigationActivity" android:exported="false" /><activity android:name="br.com.apois.navigation.lab.ConfirmedLiveNavigationActivity" android:exported="false" /></application></manifest>';
  assertPrivateManifest(xml);
  assert.throws(()=>assertPrivateManifest(xml.replace('exported="false"','exported="true"')));
  assert.throws(()=>assertPrivateManifest(xml.replace("<application>","<uses-permission android:name=\"android.permission.ACCESS_FINE_LOCATION\"/><application>")));
  assert.throws(()=>assertPrivateManifest(xml.replace("</application>","<service android:name=\"new\"/></application>")));
});
