import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
 configurePartnerQaGradle, certificateFingerprintFromKeytool, normalizeCertificateSha256
} from './configure-partner-qa-debug-signing-v1.mjs';

const fake='18c2ac94fa712886a9fbdce8508ced5586150fd1dc2a072b22ed8be10a6fd849';
const gradle="plugins { id 'com.android.application' }\nandroid { compileSdkVersion 36 }\n";
const patched=configurePartnerQaGradle(gradle);
assert.ok(patched.includes('signingConfig signingConfigs.apoisPartnerQaDebug'));
assert.ok(patched.includes('storeFile file(System.getenv("HOME") + "/.android/debug.keystore")'));
assert.equal(configurePartnerQaGradle(patched),patched,'Stable signing configuration must be idempotent');
assert.equal(normalizeCertificateSha256(fake.toUpperCase().match(/../g).join(':')),fake);
assert.equal(certificateFingerprintFromKeytool('Owner: QA\n  SHA256: '+fake.toUpperCase().match(/../g).join(':')+'\n'),fake);
assert.throws(()=>normalizeCertificateSha256('wrong'),/64 hex/);
assert.throws(()=>certificateFingerprintFromKeytool('SHA1: not SHA256'),/Could not read/);
assert.throws(()=>configurePartnerQaGradle('not a Gradle project'),/not a known Android/);
assert.throws(()=>configurePartnerQaGradle('// APOIS_PARTNER_PINNED_QA_DEBUG_SIGNING_V1\n'+gradle),/marker present/);

const yaml=readFileSync('.github/workflows/apois-partner-android.yml','utf8');
for(const marker of [
 "if: github.event_name == 'workflow_dispatch'",
 'APOIS_PARTNER_QA_DEBUG_KEYSTORE_BASE64',
 'APOIS_PARTNER_QA_CERT_SHA256',
 'node scripts/qa/configure-partner-qa-debug-signing-v1.mjs',
 'Partner APK signature mismatch: refusing incompatible update',
 'versionCode',
]) assert.ok(yaml.includes(marker),'Missing Partner QA signing guard: '+marker);
assert.ok(!yaml.includes('keytool -genkeypair'),'Workflow must never rotate debug certificate');
console.log('[PASS] Partner debug QA signing: pinned cert, no rotation, manual APK dispatch, Gradle override, idempotency');
