// Codemagic: different workflows share project BUILD_NUMBER history.
// Always stamp an increasing Android code BEFORE regenerating Android Gradle.
// CM_ENV carries the values across separately executed Codemagic steps.
// This script does NOT sign, upload or publish any APK.
import { appendFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const OFFSET=1000;
const MAX_ANDROID_VERSION_CODE=2100000000;
export function computeVersion(target, rawBuildNumber) {
 if (!['client','partner'].includes(target)) throw Error('[FAIL] Unknown Codemagic Android target');
 const raw=String(rawBuildNumber??'');
 if(!/^[1-9]\d*$/.test(raw))throw Error('[FAIL] PROJECT_BUILD_NUMBER must be a positive integer');
 const buildNumber=Number(raw);
 if(!Number.isSafeInteger(buildNumber))throw Error('[FAIL] PROJECT_BUILD_NUMBER too large');
 const code=OFFSET+buildNumber;
 if(code>MAX_ANDROID_VERSION_CODE)throw Error('[FAIL] Android versionCode exceeds Play limit');
 const prefix=target==='client'?'APP':'PARTNER';
 return { code, name:'1.1.'+buildNumber, prefix };
}
export function persistCodemagicVersion(target,rawBuildNumber,cmEnvFile){
 if(!cmEnvFile)throw Error('[FAIL] CM_ENV is required; cannot export Android versions to following steps');
 const {code,name,prefix}=computeVersion(target,rawBuildNumber);
 appendFileSync(cmEnvFile,prefix+'_VERSION_CODE='+code+'\n'+prefix+'_VERSION_NAME='+name+'\n',{encoding:'utf8'});
 console.log('[PASS] Codemagic '+target+' versionCode='+code+' versionName='+name+' saved to CM_ENV');
 return {code,name,prefix};
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 persistCodemagicVersion(process.argv[2],process.env.PROJECT_BUILD_NUMBER,process.env.CM_ENV);
}
