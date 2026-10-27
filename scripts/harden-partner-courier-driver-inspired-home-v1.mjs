import {readFileSync,writeFileSync} from "node:fs";
import {resolve} from "node:path";
const root=resolve(process.env.APOIS_ENTREGAS_WORKSPACE||".work/partner-entregador");
function patch(file,transform){const p=resolve(root,file);const before=readFileSync(p,"utf8");const after=transform(before);if(after===before)throw Error("[FAIL] UX Parceiro sem alteracao: "+file);writeFileSync(p,after,"utf8");}
patch("src/routes/courier.tsx",s=>{
 const statusPos=s.indexOf("<CourierStatusCard");
 if(statusPos<0)throw Error("[FAIL] status card nao encontrado");
 const mainStart=s.lastIndexOf("<main",statusPos);
 if(mainStart<0)throw Error("[FAIL] main da home nao encontrado");
 const mainEnd=s.indexOf(">",mainStart);
 if(mainEnd<0)throw Error("[FAIL] fim da tag main nao encontrado");
 s=s.slice(0,mainStart)+'<main data-apois-courier-map-home className="mx-auto w-full max-w-lg space-y-2 overflow-x-hidden px-2 py-2 pb-[calc(7rem+env(safe-area-inset-bottom))]">'+s.slice(mainEnd+1);
 const oldStatus='        <CourierStatusCard\n          online={online}\n          busy={busy === "online"}\n          activeJob={activeJob}\n          onToggle={toggleOnline}\n        />';
 if(!s.includes(oldStatus))throw Error("[FAIL] status courier nao localizado");
 s=s.replace(oldStatus,"");
 const insert='      </main>\n\n      <CourierSupportSheet';
 if(!s.includes(insert))throw Error("[FAIL] final da home courier nao localizado");
 s=s.replace(insert,'      </main>\n      <div data-apois-courier-floating-status className="mx-auto w-full max-w-lg px-3">\n        <CourierStatusCard online={online} busy={busy === "online"} activeJob={activeJob} onToggle={toggleOnline} />\n      </div>\n\n      <CourierSupportSheet');
 return s;
});
patch("src/components/CourierRouteMap.tsx",s=>{
 const old="colorScheme={ColorScheme.DARK}";
 if(!s.includes(old))throw Error("[FAIL] cor do mapa nao localizada");
 s=s.replaceAll(old,"colorScheme={ColorScheme.LIGHT}");
 const oldHeight='className="relative h-[18rem] min-h-[30vh] max-h-[22rem] w-full bg-zinc-900"';
 if(!s.includes(oldHeight))throw Error("[FAIL] mapa home compacto nao localizado");
 s=s.replace(oldHeight,'className="relative h-[55dvh] min-h-[390px] max-h-[720px] w-full bg-[#F3F4F6]"');
 s=s.replace('className={`relative w-full bg-zinc-900 ${expanded ? "h-[36rem] min-h-[72vh] max-h-[44rem]" : "h-[29rem] min-h-[62vh] max-h-[36rem]"}`}','className={`relative w-full bg-[#F3F4F6] ${expanded ? "h-[65dvh] min-h-[430px]" : "h-[58dvh] min-h-[390px]"}`}' );
 return s;
});
const cssPath=resolve(root,"src/system-theme.css");
let css=readFileSync(cssPath,"utf8");
const marker="/* APOIS_COURIER_DRIVER_INSPIRED_HOME_V1 */";
if(css.includes(marker))throw Error("[FAIL] home V1 ja aplicada");
css+="\n"+marker+"\n"+[
  ".apois-system-theme [data-apois-courier-map-home] { position:relative; max-width:none; padding-top:0; }",
  ".apois-system-theme [data-apois-courier-map-home] > section:first-child { border-radius:22px; margin:0; box-shadow:0 12px 32px rgba(17,24,39,.10); }",
  ".apois-system-theme [data-apois-courier-floating-status] { position:fixed; z-index:39; left:50%; transform:translateX(-50%); bottom:calc(96px + env(safe-area-inset-bottom)); pointer-events:none; }",
  ".apois-system-theme [data-apois-courier-floating-status] > * { pointer-events:auto; box-shadow:0 12px 38px rgba(17,24,39,.16); border-radius:24px; }",
  ".apois-system-theme [data-apois-courier-map-home] [class*=\"rounded-[1.9rem]\"] { border-radius:22px; }",
  ".apois-system-theme [data-apois-courier-map-home] [class*=\"bg-black/70\"] { background:rgba(255,255,255,.98)!important; }",
  ".apois-system-theme [data-apois-courier-map-home] [class*=\"text-zinc-500\"] { color:#576273!important; }",
  "@media(max-height:700px){.apois-system-theme [data-apois-courier-floating-status] { bottom:calc(84px + env(safe-area-inset-bottom)); }}",
].join("\n")+"\n";
writeFileSync(cssPath,css,"utf8");
console.log("[OK] Entregador: mapa claro alto, painel disponibilidade flutuante e rota de duas etapas preservada.");