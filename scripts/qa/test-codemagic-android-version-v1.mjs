import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { computeVersion, persistCodemagicVersion } from './stamp-codemagic-android-version-v1.mjs';

assert.deepEqual(computeVersion('client','1'),{code:1001,name:'1.1.1',prefix:'APP'});
assert.deepEqual(computeVersion('partner','99'),{code:1099,name:'1.1.99',prefix:'PARTNER'});
assert.ok(computeVersion('client','101').code>computeVersion('client','100').code);
assert.ok(computeVersion('client','1').code>64,'Existing customer test APK was versionCode 64');
assert.ok(computeVersion('partner','1').code>28,'Existing partner test APK was versionCode 28');
for(const input of ['',0,'0','-1','1.4','NaN','99999999999999999']){
 assert.throws(()=>computeVersion('client',input),/\[FAIL\]/);
}
assert.throws(()=>computeVersion('other','1'),/Unknown/);
assert.throws(()=>computeVersion('client','2100000000'),/exceeds/);
assert.throws(()=>persistCodemagicVersion('client','1',''),/CM_ENV/);
const root=mkdtempSync(resolve(tmpdir(),'apois-codemagic-version-'));
try{
 const env=resolve(root,'vars');
 persistCodemagicVersion('client','10',env);
 persistCodemagicVersion('partner','11',env);
 const actual=readFileSync(env,'utf8');
 assert.ok(actual.includes('APP_VERSION_CODE=1010\nAPP_VERSION_NAME=1.1.10\n'));
 assert.ok(actual.includes('PARTNER_VERSION_CODE=1011\nPARTNER_VERSION_NAME=1.1.11\n'));
}finally{rmSync(root,{recursive:true,force:true});}
const yaml=readFileSync('codemagic.yaml','utf8');
for(const check of [
 'node scripts/qa/stamp-codemagic-android-version-v1.mjs client',
 'node scripts/qa/stamp-codemagic-android-version-v1.mjs partner',
 'APP_VERSION_CODE',
 'PARTNER_VERSION_CODE',
 'EXPECTED_SIGNING_SHA1',
 'CM_KEYSTORE_PATH'
])assert.ok(yaml.includes(check),'Codemagic pinned signing/version script missing: '+check);
assert.ok(!yaml.includes('publishing:'),'Do not enable Android publication from QA fix');
console.log('[PASS] Codemagic: increasing versionCode above previous QA, persisted CM_ENV, signed APK checks preserved, no publication');
