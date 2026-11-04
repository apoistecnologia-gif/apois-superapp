// Verify the signed Android APK manifest matches its intended applicationId/version.
// Input: aapt dump badging on stdin. No mutating operations.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
export function verifyApkBadging(source,id,code,name){
 const lines=String(source??'').split(/\r?\n/).filter(x=>/^package:\s/.test(x));
 if(lines.length!==1)throw Error('[FAIL] APK badging package declaration missing or duplicated');
 const m=lines[0].match(/^package:\s+name='([^']+)' versionCode='(\d+)' versionName='([^']*)'(?:\s|$)/);
 if(!m)throw Error('[FAIL] APK badging manifest format is not recognized');
 if(!/^[a-zA-Z][\w]*(?:\.[a-zA-Z][\w]*)+$/.test(id??''))throw Error('[FAIL] Expected applicationId invalid');
 if(!/^[1-9]\d*$/.test(String(code??''))||!String(name??''))throw Error('[FAIL] Expected Android version invalid');
 if(m[1]!==id||m[2]!==String(code)||m[3]!==name)throw Error('[FAIL] Signed APK manifest differs from intended package and version: '+m[1]+' / '+m[2]+' / '+m[3]);
 console.log('[PASS] Signed APK manifest '+m[1]+' '+m[2]+' '+m[3]);
 return {id:m[1],code:Number(m[2]),name:m[3]};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 verifyApkBadging(readFileSync(0,'utf8'),process.argv[2],process.argv[3],process.argv[4]);
}
