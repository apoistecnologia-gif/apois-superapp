/**
 * APOIS_CORRIDAS_ONLY_REMOVE_GENERATED_COURIER_NATIVE_V1
 * ONLY invoked after standard native installers finish and verify in a
 * *disposable generated* Android workspace. Does not edit source history,
 * manifests in Git, or Supabase. Fail-closed if Android structure drifts.
 */
import {existsSync,readFileSync,rmSync,writeFileSync,readdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {isCorridasOnly} from '../config/apois-launch-mode.mjs';
if (!isCorridasOnly()) {
 console.log('[OK] Full Partner mode: generated courier native sources preserved');
 process.exit(0);
}
const src=resolve('superapp/partner-shell/android/app/src/main');
const java=resolve(src,'java/br/com/apois/parceiro');
const mainPath=resolve(java,'MainActivity.java');
const manifestPath=resolve(src,'AndroidManifest.xml');
let main=readFileSync(mainPath,'utf8');
let manifest=readFileSync(manifestPath,'utf8');
const reg='registerPlugin(CourierLocationPlugin.class);';
if(main.split(reg).length!==2)throw Error('[FAIL] Native Courier registration changed; manual review required');
main=main.replace(/^[ \t]*registerPlugin\(CourierLocationPlugin\.class\);[ \t]*\r?\n/m,'');
const service=/<service\b[^>]*android:name="\.CourierLocationService"[^>]*\/>/g;
const occurrences=[...manifest.matchAll(service)];
if(occurrences.length!==1)throw Error('[FAIL] Android Courier service XML changed; manual review required');
manifest=manifest.replace(service,'');
for(const name of ['CourierLocationPlugin.java','CourierLocationService.java']){
 if(!existsSync(resolve(java,name)))throw Error('[FAIL] Courier generated class missing: '+name);
}
writeFileSync(mainPath,main,'utf8');
writeFileSync(manifestPath,manifest,'utf8');
for(const name of ['CourierLocationPlugin.java','CourierLocationService.java'])rmSync(resolve(java,name));
for(const name of readdirSync(java).filter(n=>n.endsWith('.java'))){
 const content=readFileSync(resolve(java,name),'utf8');
 if(content.includes('CourierLocationPlugin')||content.includes('CourierLocationService'))
  throw Error('[FAIL] Generated Java still depends on isolated Courier: '+name);
}
for(const deny of ['CourierLocationPlugin','CourierLocationService']){
 if(main.includes(deny)||manifest.includes(deny))throw Error('[FAIL] Native isolated identifier survived');
}
if(!main.includes('registerPlugin(DriverLocationPlugin.class)')||!manifest.includes('android:name=".DriverLocationService"'))
 throw Error('[FAIL] Native Motorista runtime lost while removing Courier');
console.log('[OK] Generated Android app contains only Driver native location service; source scripts intact.');
