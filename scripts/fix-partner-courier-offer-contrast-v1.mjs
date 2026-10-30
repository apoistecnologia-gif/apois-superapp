import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root=resolve(process.env.APOIS_ENTREGAS_WORKSPACE||".work/partner-entregador");
function edit(relative, callback, checks) {
 const path=resolve(root,relative);
 if(!existsSync(path)) throw new Error("[FAIL] Missing courier source: "+relative);
 const before=readFileSync(path,"utf8"), after=callback(before);
 for(const check of checks){if(!after.includes(check))throw new Error("[FAIL] Courier contrast gate: "+check);}
 if(after!==before)writeFileSync(path,after,"utf8");
 console.log("[OK] Courier contrast and copy: "+relative);
}
function replace(source,old,newLabel,label) {
 if(source.includes(newLabel))return source;
 if(!source.includes(old))throw new Error("[FAIL] Courier UI source changed: "+label);
 return source.replace(old,newLabel);
}
edit("src/components/CourierOfferOverlay.tsx",(input)=>{
 let src=input;
 src=replace(src,
  ': "border-accent/35 bg-white text-accent-foreground"',
  ': "border-accent/35 bg-[#F9FAFB] text-[#991B1B]"',
  'visible countdown');
 src=replace(src,
  '<p className="truncate text-lg font-black">',
  '<p className="line-clamp-2 break-words text-lg font-black">',
  'readable merchant name');
 return src;
},['text-[#991B1B]','line-clamp-2 break-words text-lg font-black']);
edit("src/components/CourierPremiumViews.tsx",(input)=>{
 let src=input;
 src=replace(src,
  '    <section className="relative -mt-7 overflow-hidden rounded-t-[2rem] rounded-b-[1.8rem] border border-primary/35',
  '    <section data-apois-courier-active-sheet className="relative -mt-7 overflow-hidden rounded-t-[2rem] rounded-b-[1.8rem] border border-primary/35',
  'identify dark delivery sheet');
 src=replace(src,
  '<p className="mt-1 text-xl font-black">Pedido #{job.orders?.order_number ?? "—"}</p>',
  '<p data-apois-courier-title className="mt-1 text-xl font-black text-white">Pedido #{job.orders?.order_number ?? "—"}</p>',
  'readable order number');
 src=replace(src,
  '<p className="font-black">Confirme o PIN do cliente</p>',
  '<p data-apois-courier-pin-title className="font-black text-white">Confirme o PIN do cliente</p>',
  'readable PIN instructions');
 src=replace(src,
  'label: "Pedido coletado", icon: PackageCheck',
  'label: "Confirmar coleta", icon: PackageCheck',
  'imperative action');
 src=replace(src,
  'placeholder="0000"',
  'placeholder="••••"',
  'PIN is placeholder, not actual code');
 src=replace(src,
  '{online\n                ? "Disponível para receber entregas"\n                : "Ative quando quiser começar sua jornada"}',
  '{online\n                ? activeJob ? "Entrega em andamento" : "Disponível para receber entregas"\n                : "Ative quando quiser começar sua jornada"}',
  'accurate online availability copy');
 src=replace(src,
  '<p className="truncate text-sm font-bold">{pickup.name || "Estabelecimento"}</p>',
  '<p className="line-clamp-2 break-words text-sm font-bold">{pickup.name || "Estabelecimento"}</p>',
  'pickup name');
 src=replace(src,
  '<p className="truncate text-xs text-zinc-500">{pickup.address_line || pickup.street}</p>',
  '<p className="line-clamp-2 break-words text-xs text-zinc-500">{pickup.address_line || pickup.street}</p>',
  'pickup address');
 return src;
},['data-apois-courier-active-sheet','data-apois-courier-pin-title','Confirmar coleta','Entrega em andamento']);
edit("src/components/CourierCompletionSupport.tsx",(input)=>{
 return replace(input,
   '<h2 className="mt-1 text-2xl font-black">Tudo certo!</h2>',
   '<h2 data-apois-courier-complete-title className="mt-1 text-2xl font-black text-white">Tudo certo!</h2>',
   'completion title');
},['data-apois-courier-complete-title']);
edit("src/system-theme.css",(input)=>{
 const marker="/* APOIS_COURIER_ACTIVE_CONTRAST_V1 */";
 if(input.includes(marker))return input;
 return input+"\n"+marker+"\n"+
 '.apois-system-theme [data-apois-courier-active-sheet] [data-apois-courier-title],\n'+
 '.apois-system-theme [data-apois-courier-active-sheet] [data-apois-courier-pin-title],\n'+
 '.apois-system-theme [data-apois-courier-complete-title] { color:#FFFFFF!important; }\n';
},['APOIS_COURIER_ACTIVE_CONTRAST_V1']);
