import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const workflow=readFileSync('.github/workflows/apois-client-android.yml','utf8');
for(const marker of [
 "if: github.event_name == 'workflow_dispatch'",
 'Require original Cliente QA signing BEFORE module compilation',
 'APOIS_CLIENT_QA_DEBUG_KEYSTORE_BASE64',
 'Original Client QA signing identity missing.',
 '97eaf64ee20ef16b2765a6dff5e96a25dbad4da12ccb6e5c2cd48d4c9c2f61f4',
 'QA certificate changed or cache lost; do not rotate signature automatically',
 'apksigner',
 'verify-android-apk-badging-v1.mjs'
])assert.ok(workflow.includes(marker),'Client QA signing safety gate missing: '+marker);
assert.ok(!workflow.includes('keytool -genkeypair'),'Client QA may NEVER silently create a new signing key');
assert.ok(!workflow.includes('actions/cache/save@v4'),'No cache writes before an original key is proven');
assert.ok(workflow.indexOf('Require original Cliente QA signing BEFORE module compilation')<
 workflow.indexOf('Build Corridas + Entregas + shell Cliente'),
 'Stop immediately rather than burn Android build minutes without original certificate');
assert.equal(workflow.split('Restore encrypted QA signing from Actions cache').length-1,1);
console.log('[PASS] Client QA: original signing identity required early, no automatic rotation, pin and APK validation preserved');
