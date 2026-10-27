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
 s=s.slice(0,mainStart)+s.slice(mainStart,mainEnd+1).replace("<main","<main data-apois-courier-map-home")+s.slice(mainEnd+1);
 const oldStatus='        <CourierStatusCard\n          online={online}\n          busy={busy === "online"}\n          activeJob={activeJob}\n          onToggle={toggleOnline}\n        />';
 if(!s.includes(oldStatus))throw Error("[FAIL] status courier nao localizado");
 s=s.replace(oldStatus,"");
 const insert='      </main>\n\n      <CourierSupportSheet';
 if(!s.includes(insert))throw Error("[FAIL] final da home courier nao localizado");
 s=s.replace(insert,'        <div data-apois-courier-inline-status className="mx-auto w-full max-w-lg py-3">\n          <CourierStatusCard online={online} busy={busy === "online"} activeJob={activeJob} onToggle={toggleOnline} />\n        </div>\n      </main>\n\n      <CourierSupportSheet');
 // Remove redundant online waiting card: live map plus the single availability control already explain the state.
 const waiting='              <CourierWaitingSheet\n                metrics={metrics}\n                wallet={wallet}\n                onRefresh={() => courier?.id && void loadCourierOperations(courier.id)}\n              />';
 if(!s.includes(waiting))throw Error("[FAIL] waiting sheet not found");
 s=s.replace(waiting,'              <p className="px-3 py-2 text-center text-xs font-medium text-slate-600">Aguardando novas solicitações de entrega</p>');

 return s;
});
patch("src/components/CourierRouteMap.tsx",s=>{
 const old="colorScheme={ColorScheme.DARK}";
 if(!s.includes(old))throw Error("[FAIL] cor do mapa nao localizada");
 s=s.replaceAll(old,"colorScheme={ColorScheme.LIGHT}");
 const oldHeight='className="relative h-[18rem] min-h-[30vh] max-h-[22rem] w-full bg-zinc-900"';
 if(!s.includes(oldHeight))throw Error("[FAIL] mapa home compacto nao localizado");
 s=s.replace(oldHeight,'className="relative h-[48dvh] min-h-[320px] max-h-[590px] w-full bg-[#F3F4F6]"');
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
  ".apois-system-theme [data-apois-courier-inline-status] > section { background:#FFFFFF!important; color:#111827!important; border:1px solid #E4E7EC!important; box-shadow:0 8px 24px rgba(17,24,39,.10)!important; padding:12px 14px!important; border-radius:24px!important; }",
  ".apois-system-theme [data-apois-courier-inline-status] p { color:#374151!important; }",
  ".apois-system-theme [data-apois-courier-inline-status] p span { color:#D71920!important; }",
  ".apois-system-theme [data-apois-courier-map-home] { padding-bottom:calc(120px + env(safe-area-inset-bottom))!important; }",
  ".apois-system-theme [data-apois-courier-map-home] > section:first-child { border:0!important; border-radius:20px!important; overflow:hidden; background:#FFF!important; box-shadow:0 6px 22px rgba(17,24,39,.08)!important; }",
  ".apois-system-theme [data-apois-courier-map-home] > section:first-child > div:first-child { background:#FFF!important; border-bottom:1px solid #E5E7EB!important; }",

].join("\n")+"\n";
writeFileSync(cssPath,css,"utf8");
console.log("[OK] Entregador: mapa claro alto, painel disponibilidade flutuante e rota de duas etapas preservada.");