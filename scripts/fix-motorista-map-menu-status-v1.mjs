import {readFileSync,writeFileSync} from "node:fs";
import {resolve} from "node:path";
const appPath=resolve(".work/partner-motorista/src/routes/motorista.app.tsx");
const statusPath=resolve(".work/partner-motorista/src/components/ApoisStatusCheck.tsx");
let app=readFileSync(appPath,"utf8");
let status=readFileSync(statusPath,"utf8");
function swap(source,from,to,what){
 const count=source.split(from).length-1;
 if(count!==1)throw Error("[FAIL] Motorista Map/Status V1 "+what+" anchor count "+count);
 return source.replace(from,to);
}
// The original app ALREADY HAS a complete DriverSideMenu. Restore that rather
// than inventing another menu and reserve the map for live driving.
app=swap(app,'import { ApoisDriverBottomNav } from "@/components/ApoisDriverBottomNav";',
'import { DriverActiveRideRecovery } from "@/components/DriverActiveRideRecovery";',
"preserve active ride recovery while removing bottom nav");
app=swap(app,'      <ApoisDriverBottomNav hidden={!!ratingRide} />',
'      <DriverActiveRideRecovery />',"remove redundant bottom navigation");
const reserveMatches=[...app.matchAll(/const navReserve = "[^"]+";/g)];
if(reserveMatches.length!==1)throw Error("[FAIL] Motorista map reserve changed; expected one idle navReserve");
app=app.replace(reserveMatches[0][0], 'const navReserve = "env(safe-area-inset-bottom)";');
// Real diagnosis should be able to complete even when Supabase networking stalls.
if(!status.includes('export function ApoisStatusCheck'))throw Error("[FAIL] Status component changed");
status=swap(status,'  const test=useCallback(async()=>{',
'  // APOIS_MOTORISTA_DIAGNOSTICO_FINITO_V1\n  const test=useCallback(async()=>{',
"diagnostic marker");
status=swap(status,'    const {data:userData,error:authError}=await supabase.auth.getUser();',
'    const {data:userData,error:authError}=await Promise.race([\n      supabase.auth.getUser(),\n      new Promise<never>((_,reject)=>setTimeout(()=>reject(new Error("auth_timeout")),9000))\n    ]);',
"auth deadline");
status=swap(status,'        const {data,error}=await (supabase as any).rpc(name);',
'        const {data,error}=await Promise.race([\n          (supabase as any).rpc(name),\n          new Promise<never>((_,reject)=>setTimeout(()=>reject(new Error("server_timeout")),9000))\n        ]);',
"RPC deadline");
status=swap(status,'    const internet=navigator.onLine;',
'    try {\n    const internet=navigator.onLine;',
"diagnostic safety try");
status=swap(status,'    setResults(output);setTested(true);setBusy(false);',
'    setResults(output);setTested(true);\n    } catch {\n      setResults([{label:"Verificação de conexão",status:"warn",detail:"O servidor não respondeu a tempo. Verifique sua rede e tente novamente."}]);\n      setTested(true);\n    } finally {\n      setBusy(false);\n    }',
"diagnostic guaranteed completion");
if(!app.includes("DriverSideMenu")||!app.includes("DriverActiveRideRecovery")||app.includes("<ApoisDriverBottomNav"))throw Error("[FAIL] Navigation correction contract");
if(!status.includes("APOIS_MOTORISTA_DIAGNOSTICO_FINITO_V1")||!status.includes("finally"))throw Error("[FAIL] Status correction contract");
writeFileSync(appPath,app,"utf8");writeFileSync(statusPath,status,"utf8");
console.log("[OK] Motorista QA: original side menu, more map space, finite 6-check status panel; no Android build.");
