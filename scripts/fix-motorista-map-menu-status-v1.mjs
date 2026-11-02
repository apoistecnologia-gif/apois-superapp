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
// The upstream mobile-ui hardener removes DriverSideMenu and its trigger.
// Reintroduce the existing audited component after that hardener; do not create a clone.
const sideMenuImport='import { DriverSideMenu } from "@/components/DriverSideMenu";';
if(!app.includes(sideMenuImport)){
  const pos='import { DriverActiveRideRecovery } from "@/components/DriverActiveRideRecovery";';
  if(!app.includes(pos))throw Error("[FAIL] Missing ride recovery import for side-menu insertion");
  app=app.replace(pos,pos+'\nimport { Menu } from "lucide-react";\n'+sideMenuImport);
}
const menuState='  const [showStatusCheck,setShowStatusCheck]=useState(false);';
if(app.split(menuState).length!==2)throw Error("[FAIL] Status check state not found for menu placement");
app=app.replace(menuState,menuState+'\n  const [sideMenuOpen,setSideMenuOpen]=useState(false);');
const driverNameAnchor='<div className="min-w-0 flex-1 leading-tight">';
if(app.split(driverNameAnchor).length!==2)throw Error("[FAIL] Driver top bar greeting not found");
app=app.replace(driverNameAnchor,
  '<button type="button" onClick={()=>setSideMenuOpen(true)} aria-label="Abrir menu lateral" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#E51B23]"><Menu className="h-5 w-5" aria-hidden="true"/></button>\n          '+driverNameAnchor);
const gpsAnchor='      {/* (status de GPS é mostrado dentro do painel inferior) */}';
if(app.split(gpsAnchor).length!==2)throw Error("[FAIL] Driver side menu render position missing");
app=app.replace(gpsAnchor,
  '      <DriverSideMenu open={sideMenuOpen} onOpenChange={setSideMenuOpen} onLogout={handleLogout} />\n'+gpsAnchor);
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
