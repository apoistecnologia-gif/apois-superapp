import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
const root=resolve(process.env.APOIS_ENTREGAS_WORKSPACE||".work/partner-entregador");
function patch(file, transform, required) {
 const path=resolve(root,file);
 if(!existsSync(path)) throw Error("[FAIL] Missing completion source "+file);
 const before=readFileSync(path,"utf8");
 const after=transform(before);
 if(!after.includes(required))throw Error("[FAIL] Completion visual gate: "+required);
 if(after!==before)writeFileSync(path,after,"utf8");
 console.log("[OK] Completion white red APOIS: "+file);
}
function replace(src,old,now,label) {
 if(src.includes(now)) return src;
 if(!src.includes(old)) throw Error("[FAIL] Unexpected completion UI: "+label);
 return src.replace(old,now);
}
patch("src/components/CourierCompletionSupport.tsx",(input)=>{
 let src=input;
 src=replace(src,
 'className="relative -mt-8 overflow-hidden rounded-t-[2rem] rounded-b-[1.8rem] border border-accent/35 bg-[radial-gradient(circle_at_top,rgba(200,138,8,0.2),transparent_42%),linear-gradient(180deg,#10100d,#070707)] px-5 pb-5 pt-3 text-center shadow-[0_-18px_45px_rgba(0,0,0,0.65)]"',
 'data-apois-completion-light-v1 className="relative -mt-2 overflow-hidden rounded-[1.5rem] border border-[#F2CDD2] bg-white px-4 pb-4 pt-3 text-center text-[#111827] shadow-[0_10px_30px_rgba(17,24,39,0.08)]"',
 'light completion sheet');
 src=replace(src,
  'className="mx-auto mt-5 flex max-w-xs items-center justify-between rounded-2xl border border-accent/20 bg-black/65 p-4 text-left"',
  'className="mx-auto mt-4 flex max-w-xs items-center justify-between rounded-xl border border-[#F2CDD2] bg-[#FFF5F6] p-3 text-left"',
  'light earnings card');
 src=replace(src,
  'className="mt-5 h-14 w-full rounded-2xl bg-gradient-to-r from-primary to-accent font-black uppercase tracking-[0.05em] text-white shadow-[0_10px_30px_rgba(200,138,8,0.18)]"',
  'className="mt-4 h-12 w-full rounded-xl bg-[#E90024] font-black uppercase text-white shadow-md"',
  'small red completion button');
 return src;
},'data-apois-completion-light-v1');

patch("src/system-theme.css",(input)=>{
 const marker="/* APOIS_COURIER_COMPLETION_LIGHT_V1 */";
 if(input.includes(marker))return input;
 return input+"\n"+marker+"\n"+
  '.apois-system-theme [data-apois-completion-light-v1] { background:#FFF!important;color:#111827!important; }\n'+
  '.apois-system-theme [data-apois-completion-light-v1] [data-apois-courier-complete-title] { color:#111827!important; }\n';
},'APOIS_COURIER_COMPLETION_LIGHT_V1');
