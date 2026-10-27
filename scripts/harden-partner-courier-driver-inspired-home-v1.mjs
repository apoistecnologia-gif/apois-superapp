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
  ".apois-system-theme [data-apois-courier-floating-status] { position:fixed; z-index:60; left:50%; transform:translateX(-50%); bottom:calc(188px + env(safe-area-inset-bottom)); pointer-events:none; }",
  ".apois-system-theme [data-apois-courier-floating-status] > * { pointer-events:auto; box-shadow:0 12px 38px rgba(17,24,39,.16); border-radius:24px; }",
  ".apois-system-theme [data-apois-courier-map-home] [class*=\"rounded-[1.9rem]\"] { border-radius:22px; }",
  ".apois-system-theme [data-apois-courier-map-home] [class*=\"bg-black/70\"] { background:rgba(255,255,255,.98)!important; }",
  ".apois-system-theme [data-apois-courier-map-home] [class*=\"text-zinc-500\"] { color:#576273!important; }",
  ".apois-system-theme [data-apois-courier-floating-status] > section { background:#FFFFFF!important; color:#111827!important; border:1px solid #E4E7EC!important; box-shadow:0 8px 32px rgba(17,24,39,.20)!important; padding:12px 14px!important; border-radius:24px!important; }",
  ".apois-system-theme [data-apois-courier-floating-status] p { color:#344054!important; }",
  ".apois-system-theme [data-apois-courier-floating-status] p[class*=\"text-lg\"] { font-size:16px!important; color:#111827!important; line-height:1.25!important; }",
  ".apois-system-theme [data-apois-courier-floating-status] p span[class*=\"text-primary\"] { color:#E51B23!important; }",
  ".apois-system-theme [data-apois-courier-floating-status] button { min-width:66px; }",
  ".apois-system-theme [data-apois-courier-map-home] { padding-bottom:260px!important; }",
  ".apois-system-theme [data-apois-courier-map-home] > section:first-child { border:0!important; border-radius:20px!important; overflow:hidden; background:#FFFFFF!important; box-shadow:0 6px 22px rgba(17,24,39,.08)!important; }",
  ".apois-system-theme [data-apois-courier-map-home] > section:first-child > div:first-child { background:#FFFFFF!important; color:#111827!important; border-bottom:1px solid #E5E7EB!important; }",
  ".apois-system-theme [data-apois-courier-map-home] > section:first-child > div:first-child p:first-child { color:#C9141B!important; }",
  ".apois-system-theme [data-apois-courier-map-home] button[aria-label=\"Recentralizar mapa\"] { background:#FFFFFF!important; color:#E51B23!important; border:1px solid #E5E7EB!important; box-shadow:0 6px 16px rgba(17,24,39,.12)!important; }",
  ".apois-system-theme [data-apois-courier-map-home] button[aria-label=\"Recentralizar mapa\"] svg { color:#E51B23!important; }",
  ".apois-system-theme [data-apois-courier-floating-status] { max-width:520px!important; }",
  ".apois-system-theme [data-apois-courier-floating-status] > section [class*=\"bg-[linear-gradient\"] { background:#FFFFFF!important; }",


  "@media(max-height:700px){.apois-system-theme [data-apois-courier-floating-status] { bottom:calc(160px + env(safe-area-inset-bottom)); }}",
].join("\n")+"\n";
writeFileSync(cssPath,css,"utf8");
console.log("[OK] Entregador: mapa claro alto, painel disponibilidade flutuante e rota de duas etapas preservada.");