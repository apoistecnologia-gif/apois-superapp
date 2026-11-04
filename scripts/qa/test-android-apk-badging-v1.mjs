import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { verifyApkBadging } from './verify-android-apk-badging-v1.mjs';
const manifest="package: name='br.com.apois.app' versionCode='1001' versionName='1.1.1' platformBuildVersionName='16'\nsdkVersion:'24'\ntargetSdkVersion:'36'\n";
assert.deepEqual(verifyApkBadging(manifest,'br.com.apois.app','1001','1.1.1'),{id:'br.com.apois.app',code:1001,name:'1.1.1'});
for(const args of [
 [manifest,'br.com.apois.parceiro','1001','1.1.1'],
 [manifest,'br.com.apois.app','1002','1.1.1'],
 [manifest,'br.com.apois.app','1001','1.1.2'],
 [manifest,'br.com.apois.app','001001','1.1.1'],
 [manifest,'br.com.apois.app','1001',''],
 ['', 'br.com.apois.app','1001','1.1.1'],
 [manifest+manifest,'br.com.apois.app','1001','1.1.1']
])assert.throws(()=>verifyApkBadging(...args),/\[FAIL\]/);
const yaml=readFileSync('codemagic.yaml','utf8');
assert.ok(yaml.includes('verify-android-apk-badging-v1.mjs "$APP_PACKAGE" "$APP_VERSION_CODE" "$APP_VERSION_NAME"'));
assert.ok(yaml.includes('verify-android-apk-badging-v1.mjs "$PARTNER_APP_PACKAGE" "$PARTNER_VERSION_CODE" "$PARTNER_VERSION_NAME"'));
assert.ok(!yaml.includes('publishing:'),'APK contract guard cannot enable Play Store publication');
console.log('[PASS] Signed Cliente and Parceiro APK package/version metadata checked before artifact');
