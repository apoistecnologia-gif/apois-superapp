import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
for(const [path,module] of [
 ['.github/workflows/apois-client-android.yml','verify-client-static-assets-v1.mjs'],
 ['.github/workflows/apois-partner-android.yml','verify-partner-static-assets-v1.mjs']
]){
 const s=readFileSync(path,'utf8');
 for(const item of [
  "unzip -q \"$APK\" 'assets/public/*'",
  'test -s "$TEMP_APK_ASSETS/assets/public/index.html"',
  module+' "$TEMP_APK_ASSETS/assets/public"',
  "trap 'rm -rf \"$TEMP_APK_ASSETS\"' EXIT",
  "if: github.event_name == 'workflow_dispatch'",
  'verify-android-apk-badging-v1.mjs'
 ])assert.ok(s.includes(item),'Missing fail-closed final APK package check '+path+' : '+item);
 const pkg=s.indexOf('verify-android-apk-badging-v1.mjs');
 const assets=s.indexOf(module+' "$TEMP_APK_ASSETS/assets/public"');
 const copy=s.indexOf('cp "$APK" build/');
 assert.ok(pkg>=0&&pkg<assets&&assets<copy,'Must verify signature + badging + APK web graph before upload: '+path);
 assert.ok(!s.includes('keytool -genkeypair'),'QA workflow cannot silently rotate signing keystore');
}
console.log('[PASS] Signed Cliente and Parceiro APK asset graph required after Capacitor packaging, before publication as artifact');
