import {readFileSync,writeFileSync} from "node:fs";
import {resolve} from "node:path";
const root=resolve(".work/partner-motorista");
const file=(p)=>resolve(root,p);
function save(p,modify){
 const path=file(p),source=readFileSync(path,"utf8");
 const next=modify(source);
 if(next===source)throw Error("[FAIL] No change applied to "+p);
 writeFileSync(path,next,"utf8");
}
function one(s,a,b,label){
 const count=s.split(a).length-1;
 if(count!==1)throw Error("[FAIL] Motorista history/profile "+label+" count="+count);
 return s.replace(a,b);
}
// Keep real ride data, filters, summaries and ride detail routing unchanged.
// Repair unreadable DS components left after light-theme migration.
save("src/routes/motorista.corridas.tsx",source=>{
 let s=source;
 s=one(s,'<div className="flex min-h-dvh flex-col bg-background">',
   '<div data-apois-driver-history-legible-v2 className="flex min-h-dvh flex-col bg-[#F7F7F8] text-[#111827]">',"history root");
 const marker='function SummaryCard({';
 const start=s.indexOf(marker),end=s.indexOf('function FilterPill(',start);
 if(start<0||end<start)throw Error("[FAIL] History summary boundaries changed");
 let card=s.slice(start,end);
 card=one(card,'<DSCard className="flex min-w-0 flex-col gap-1.5 p-3 sm:p-4">',
   '<DSCard className="flex min-w-0 flex-col gap-1.5 rounded-2xl border border-[#D9DDE3] bg-white p-3 text-[#111827] shadow-sm sm:p-4">',"summary container");
 card=one(card,'"max-w-full break-words text-[clamp(14px,4.6vw,18px)] leading-tight"',
   '"max-w-full break-words text-[clamp(19px,5vw,24px)] font-black leading-tight text-[#111827]"',"summary amount");
 card=one(card,'tone === "primary" && "text-primary"',
   'tone === "primary" && "text-[#BA1524]"',"money accent");
 card=one(card,'<Label className="break-words">{label}</Label>',
   '<Label className="break-words font-semibold text-[#596372]">{label}</Label>',"summary label");
 s=s.slice(0,start)+card+s.slice(end);
 const rideStart=s.indexOf('function RideCard('),rideEnd=s.indexOf('export const Route',rideStart);
 if(rideStart<0||rideEnd<rideStart)throw Error("[FAIL] History ride card boundaries changed");
 let ride=s.slice(rideStart,rideEnd);
 ride=one(ride,'<DSCard className="press-scale flex min-w-0 flex-col gap-3 p-3 transition hover:-translate-y-[1px] sm:p-4">',
   '<DSCard className="press-scale flex min-w-0 flex-col gap-3 rounded-[22px] border border-[#D9DDE3] bg-white p-3 text-[#111827] shadow-sm transition hover:-translate-y-[1px] sm:p-4">',"ride card");
 ride=one(ride,'<Body className="min-w-0 break-words font-semibold">{passengerName}</Body>',
   '<Body className="min-w-0 break-words font-semibold text-[#111827]">{passengerName}</Body>',"passenger name");
 ride=one(ride,'<div className="flex min-w-0 flex-col gap-1.5 rounded-2xl bg-muted/40 p-2.5">',
   '<div className="flex min-w-0 flex-col gap-1.5 rounded-2xl bg-[#F1F3F5] p-2.5 text-[#26303C]">',"route details");
 s=s.slice(0,rideStart)+ride+s.slice(rideEnd);
 if(!s.includes("data-apois-driver-history-legible-v2"))throw Error("[FAIL] Missing history marker");
 return s;
});
// The public RPC can transiently fail even for the authenticated owner.
// ONLY own-profile preview may reuse already-loaded driver_get_profile data;
// never render sensitive CPF, documents, phone, address or income.
save("src/components/profile/DriverProfessionalProfileDialog.tsx",s=>{
 s=one(s,
 '  driverUserId,\n}: {\n  open: boolean;\n  onOpenChange: (v: boolean) => void;\n  driverUserId: string | null;\n}) {',
 '  driverUserId,\n  ownProfile,\n}: {\n  open: boolean;\n  onOpenChange: (v: boolean) => void;\n  driverUserId: string | null;\n  ownProfile?: unknown;\n}) {',"own profile snapshot prop");
 s=one(s,
 '  const { data, loading } = useDriverPublicProfile(open ? driverUserId : null);',
 `  const { data, loading } = useDriverPublicProfile(open ? driverUserId : null);
  // APOIS_DRIVER_SELF_PREVIEW_SAFE_V2: owned profile fallback, public fields only.
  const self = ownProfile && typeof ownProfile === "object" && !Array.isArray(ownProfile)
    ? ownProfile as Record<string, unknown> : null;
  const str=(key:string):string|null => typeof self?.[key] === "string" ? String(self[key]) : null;
  const num=(key:string):number|null => typeof self?.[key] === "number" && Number.isFinite(self[key]) ? Number(self[key]) : null;
  const snapshot = driverUserId && self ? {
    user_id:driverUserId,name:str("name"),photo_url:null,
    city:str("city"),state:str("state"),category:str("category"),
    vehicle_model:str("vehicle_model"),vehicle_color:str("vehicle_color"),
    vehicle_plate:str("vehicle_plate"),vehicle_year:num("vehicle_year"),
    average_rating:num("average_rating"),total_ratings:num("total_ratings"),
    completed_rides:num("completed_rides"),approval_status:str("approval_status"),
    is_online:typeof self.is_online === "boolean" ? self.is_online : null,
    member_since:str("created_at"),
  } : null;`,"fallback only public values");
 s=one(s,'<DriverProfessionalProfile profile={data} loading={loading} />',
   '<DriverProfessionalProfile profile={data ?? snapshot} loading={loading && !snapshot} />',"fallback rendered");
 return s;
});
save("src/routes/motorista.perfil.tsx",s=>{
 return one(s,'<DriverProfessionalProfileDialog open={publicProfileOpen} onOpenChange={setPublicProfileOpen} driverUserId={userId} />',
  '<DriverProfessionalProfileDialog open={publicProfileOpen} onOpenChange={setPublicProfileOpen} driverUserId={userId} ownProfile={driver} />',"own-profile controlled data");
});
console.log("[OK] Motorista QA: historical cards readable; own professional preview uses safe limited fallback.");
