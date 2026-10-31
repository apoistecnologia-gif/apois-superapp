import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
const root=resolve(process.env.APOIS_ENTREGAS_WORKSPACE||".work/partner-entregador");
function edit(file,fn){const p=resolve(root,file),a=readFileSync(p,"utf8"),b=fn(a);if(a!==b)writeFileSync(p,b);}
function once(s,a,b,label){if(s.includes(b))return s;if(s.split(a).length!==2)throw Error("[FAIL] Courier home repair: "+label);return s.replace(a,b);}
edit("src/routes/courier.tsx",s=>{
 s=once(s,"{online && !activeJob && !completedJob ? (","{!activeJob && !completedJob ? (","offline availability visibility");
 return s;
});
for(const file of ["src/routes/courier.tsx","src/components/CourierPremiumViews.tsx","src/components/CourierPanels.tsx"]){
 edit(file,s=>{
  if(s.includes("src={logoAsset.url}")){
   if(!s.includes('import { APOIS_PARTNER_LOGO_DATA_URL } from "@/assets/apoisPartnerLogoData";'))
    s='import { APOIS_PARTNER_LOGO_DATA_URL } from "@/assets/apoisPartnerLogoData";\n'+s;
   s=s.replaceAll("src={logoAsset.url}","src={APOIS_PARTNER_LOGO_DATA_URL}");

   if(!s.includes("logoAsset."))s=s.replace('import logoAsset from "@/assets/logo.png.asset.json";\n',"");
  }
  if(s.includes("src={APOIS_PARTNER_LOGO_DATA_URL}")) s=s.replaceAll('alt="APOIS ENTREGA"','alt="APOIS"');
  return s;
 });
}
edit("src/components/CourierRouteMap.tsx",s=>once(s,
 'aria-label="Recentralizar mapa"\n      className="absolute right-3 top-3 z-20 grid h-11 w-11 place-items-center rounded-full border border-accent/40 bg-black/90 text-white shadow-xl backdrop-blur active:scale-95"',
 'aria-label="Recentralizar mapa"\n      data-apois-courier-recenter\n      className="absolute right-3 top-3 z-20 grid h-11 w-11 place-items-center rounded-full border border-[#D0D5DD] bg-white text-[#111827] shadow-md active:scale-95"',
 "recenter light control"));
edit("src/components/CourierPremiumViews.tsx",s=>{
 const a=s.indexOf("export function CourierStatusCard("),b=s.indexOf("export function CourierWaitingSheet(",a);
 if(a<0||b<a)throw Error("[FAIL] Status component boundary");
 let c=s.slice(a,b);
 if(!c.includes("data-apois-courier-availability")){
  c=once(c,"<section","<section data-apois-courier-availability","availability hook");
  c=once(c,'type="button"','data-apois-courier-availability-toggle\n          type="button"',"toggle hook");
 }
 return s.slice(0,a)+c+s.slice(b);
});
edit("src/system-theme.css",s=>{
 const marker="/* APOIS_COURIER_HOME_REPAIR_V1 */";
 if(s.includes(marker))return s;
 return s+"\n"+marker+"\n"+
 ".apois-system-theme [data-apois-courier-recenter]{background:#FFFFFF!important;color:#111827!important;border-color:#D0D5DD!important}\n"+
 ".apois-system-theme [data-apois-courier-availability]{background:#FFFFFF!important;background-image:none!important;color:#111827!important}\n"+
 ".apois-system-theme [data-apois-courier-availability-toggle]{background:#E4E7EC!important;border-color:#667085!important;min-width:60px;min-height:44px}\n"+
 ".apois-system-theme [data-apois-courier-availability-toggle][aria-pressed=true]{background:#D71920!important;border-color:#D71920!important}\n"+
 ".apois-system-theme [data-apois-courier-availability-toggle]>span{background:#FFFFFF!important;color:#111827!important;border:1px solid #667085}\n"+
 ".apois-system-theme [data-apois-courier-availability-toggle]:focus-visible,.apois-system-theme [data-apois-courier-recenter]:focus-visible{outline:3px solid #111827;outline-offset:3px}\n";
});
console.log("[OK] Courier home: offline switch restored, official brand, legible map control; callbacks unchanged");
