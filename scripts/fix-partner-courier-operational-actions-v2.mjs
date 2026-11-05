// APOIS_COURIER_OPERATIONAL_ACTIONS_V2
// Convert the Courier QA-outline controls into finished, accessible navigation
// without touching live delivery RPCs, claim, online/offline, GPS or push.
import {readFileSync,writeFileSync} from "node:fs";
import {resolve} from "node:path";
const root=resolve(process.env.APOIS_ENTREGAS_WORKSPACE||".work/partner-entregador");
const routePath=resolve(root,"src/routes/courier.tsx");
const profilePath=resolve(root,"src/components/CourierPanels.tsx");
let route=readFileSync(routePath,"utf8");
let profile=readFileSync(profilePath,"utf8");
function exact(text,before,after,label) {
 const count=text.split(before).length-1;
 if(count!==1)throw Error("[FAIL] Courier operation V2 "+label+" anchors="+count);
 return text.replace(before,after);
}
if(route.includes("data-apois-courier-calls-card-v2")||profile.includes("data-apois-courier-profile-diagnostic-v2")){
 throw Error("[FAIL] Courier operational actions V2 already applied.");
}
const getButton=(text,marker,label)=>{
 const index=text.indexOf(marker);
 if(index<0||text.indexOf(marker,index+marker.length)>=0)throw Error("[FAIL] "+label+" marker absent/duplicate");
 const start=text.lastIndexOf("<button",index);
 const end=text.indexOf("</button>",index);
 if(start<0||end<index||end-start>800)throw Error("[FAIL] "+label+" block missing/too long");
 const content=text.slice(start,end+"</button>".length);
 if(!content.includes(label))throw Error("[FAIL] "+label+" title or button changed");
 return {start,end:end+"</button>".length,content};
};
// Keep the existing availableCallsOpen state and modal callback; only replace
// the isolated outline button with one properly styled native button/card.
const calls=getButton(route,"data-apois-available-calls-button-v1","Solicitações disponíveis");
if(!calls.content.includes("onClick={()=>setAvailableCallsOpen(true)}"))throw Error("[FAIL] Courier available calls handler not found");
const callCard=[
'        <button type="button" data-apois-available-calls-button-v1 data-apois-courier-calls-card-v2',
'          onClick={()=>setAvailableCallsOpen(true)}',
'          aria-label="Consultar solicitações de entrega disponíveis"',
'          className="group flex min-h-[86px] w-full items-center gap-3 rounded-[24px] border border-[#E4E7EC] bg-white px-4 py-3 text-left text-[#111827] shadow-[0_8px_24px_-13px_rgba(17,24,39,0.26)] transition-colors hover:border-[#EDB8C0] active:bg-[#FFF7F8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D71920]">',
'          <span aria-hidden="true" className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#FFF1F2] text-[#C81924]">',
'            <ClipboardList className="h-6 w-6" />',
'          </span>',
'          <span className="min-w-0 flex-1">',
'            <span className="block text-[15px] font-extrabold leading-5 text-[#111827]">Solicitações disponíveis</span>',
'            <span className="mt-1 block text-[12px] font-medium leading-4 text-[#5F6A79]">Consultar novas entregas na sua região</span>',
'          </span>',
'          <ChevronRight aria-hidden="true" className="h-5 w-5 shrink-0 text-[#C81924]" />',
'        </button>'
].join("\n");
route=route.slice(0,calls.start)+callCard+route.slice(calls.end);
// Earlier native/visual hardeners may reorder or extend the Lucide imports.
const lucidePattern = /^import\s*\{\s*([^}]*)\}\s*from\s*"lucide-react";/gm;
const lucideMatches = [...route.matchAll(lucidePattern)];
if(lucideMatches.length !== 1) throw Error("[FAIL] Courier icon import count="+lucideMatches.length);
const currentIcons = lucideMatches[0][1].split(",").map((value)=>value.trim()).filter(Boolean);
for(const icon of ["ChevronRight","ClipboardList"]) if(!currentIcons.includes(icon)) currentIcons.push(icon);
route=route.replace(lucideMatches[0][0], 'import { '+currentIcons.join(", ")+' } from "lucide-react";');

// Move the six-check diagnostic entry out of the home screen. Courier has
// bottom navigation tabs, not a hamburger; Perfil is the appropriate location.
const status=getButton(route,"data-apois-courier-status-check-v1","Teste de Status");
if(!status.content.includes("onClick={()=>setStatusCheckOpen(true)}"))throw Error("[FAIL] Courier diagnostic handler changed");
route=route.slice(0,status.start)+route.slice(status.end);
const modalPattern=/\{statusCheckOpen\s*&&\s*<ApoisStatusCheck role="entregador"[\s\S]*?onClose=\{\(\)=>setStatusCheckOpen\(false\)\}\s*\/>\}/g;
const modals=[...route.matchAll(modalPattern)];
if(modals.length!==1)throw Error("[FAIL] Courier six-check modal count="+modals.length);
const oldModal=modals[0][0];
if(!oldModal.includes("courierId={courier?.id??null}")||!oldModal.includes("documentsReady=")){
 throw Error("[FAIL] Courier original status modal properties changed");
}
route=route.replace(oldModal,"");
const profileModal=oldModal.replace('online={online}','online={Boolean(availability?.is_online)}');
if(profileModal===oldModal)throw Error("[FAIL] Courier status modal still refers to home-scoped online state");

// Original profile branch returns early, so mount the same modal INSIDE it,
// keeping the status test available and overlayed over the Profile screen.
const routeProfileStart=route.indexOf("if (profileOpen) {");
const profileNav=route.indexOf('<CourierBottomNav',routeProfileStart);
const profileCall=route.indexOf('<CourierProfilePanel',routeProfileStart);
if(routeProfileStart<0||profileNav<profileCall||profileCall<routeProfileStart){
 throw Error("[FAIL] Courier profile route boundaries changed");
}
const originalProfileRegion=route.slice(profileCall,profileNav);
if(!originalProfileRegion.includes('onSwitchProfile={() => void switchPartnerProfile()}') ||
   !originalProfileRegion.includes('onClose={() => setProfileOpen(false)}')){
 throw Error("[FAIL] Courier profile switch/close contract missing");
}
const newRegion=exact(originalProfileRegion,
  '          onClose={() => setProfileOpen(false)}',
  '          onOpenStatusCheck={() => setStatusCheckOpen(true)}\n          onClose={() => setProfileOpen(false)}',
  "add diagnostic action to original profile");
route=route.slice(0,profileCall)+newRegion+"        "+profileModal+"\n        "+route.slice(profileNav);
// Clear the status modal on leave; do not affect authentication or backend.
route=exact(route,
  '  const [statusCheckOpen,setStatusCheckOpen]=useState(false);',
  '  const [statusCheckOpen,setStatusCheckOpen]=useState(false);\n  useEffect(() => { if (!profileOpen) setStatusCheckOpen(false); }, [profileOpen]);',
  "clear modal on profile exit");

// The existing profile is a separately generated light visual. Add a real
// accessible action row to that panel, without replacing the profile content.
const profileStart=profile.indexOf("export function CourierProfilePanel(");
if(profileStart<0)throw Error("[FAIL] CourierProfilePanel missing");
const before=profile.slice(0,profileStart),part=profile.slice(profileStart);
let updated=exact(part,
  '  courier, user, documents, availability, wallet, onFinance, onLogout, onSwitchProfile, switchingProfile, onClose,',
  '  courier, user, documents, availability, wallet, onFinance, onLogout, onSwitchProfile, switchingProfile, onOpenStatusCheck, onClose,',
  "profile parameter");
updated=exact(updated,
  '  onFinance: () => void; onLogout: () => void; onSwitchProfile: () => void; switchingProfile: boolean; onClose: () => void;',
  '  onFinance: () => void; onLogout: () => void; onSwitchProfile: () => void; switchingProfile: boolean;\n  onOpenStatusCheck: () => void; onClose: () => void;',
  "profile parameter type");
const beforeWallet='        <button type="button" onClick={onFinance}\n          className="flex w-full items-center justify-between rounded-2xl border border-[#E6E8EC] bg-white p-4 text-left">';
const diag=[
'        <button type="button" data-apois-courier-profile-diagnostic-v2',
'          onClick={onOpenStatusCheck}',
'          className="flex min-h-[76px] w-full items-center gap-3 rounded-2xl border border-[#E6E8EC] bg-white p-4 text-left shadow-sm transition-colors active:bg-[#FFF7F8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D71920]">',
'          <span aria-hidden="true" className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#FFF1F2] text-[#C81924]">',
'            <ShieldCheck className="h-5 w-5" />',
'          </span>',
'          <span className="min-w-0 flex-1">',
'            <span className="block text-sm font-extrabold text-[#111827]">Diagnóstico do aplicativo</span>',
'            <span className="mt-1 block text-xs font-medium leading-5 text-[#5F6A79]">Conexão, GPS e cadastro · 6 verificações</span>',
'          </span>',
'          <ChevronRight aria-hidden="true" className="h-5 w-5 shrink-0 text-[#C81924]" />',
'        </button>',
''
].join("\n");
updated=exact(updated,beforeWallet,diag+beforeWallet,"add profile diagnostic above finance");
profile=before+updated;

if(route.includes("data-apois-courier-status-check-v1") ||
   !route.includes("data-apois-courier-calls-card-v2") ||
   !route.includes('onClick={()=>setAvailableCallsOpen(true)}') ||
   !route.includes('<ApoisAvailableCalls role="entregador"') ||
   !route.includes('onAccepted={()=>{setAvailableCallsOpen(false);if(courier?.id)void loadCourierOperations(courier.id);}}') ||
   !route.includes("onOpenStatusCheck={() => setStatusCheckOpen(true)}") ||
   !route.includes('role="entregador" online={Boolean(availability?.is_online)}') ||
   !profile.includes("data-apois-courier-profile-diagnostic-v2")){
 throw Error("[FAIL] Courier operational controls/mounted RPC modals regression");
}
writeFileSync(routePath,route,"utf8");
writeFileSync(profilePath,profile,"utf8");
console.log("[OK] Entregador: proper available-call action card on home, six-check diagnostics under Perfil, original RPCs/modal callbacks, ONLINE switch and delivery lifecycle preserved.");
