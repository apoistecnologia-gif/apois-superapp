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
 const begin=src.indexOf("export function CourierCompletionSheet(");
 const end=src.indexOf("export function CourierSupportSheet(",begin);
 if(begin<0 || end<0)throw Error("[FAIL] Courier completion boundaries not recognized");
 let panel=src.slice(begin,end);
 if(!panel.includes('data-apois-completion-light-v1')){
  const root=/<section\\s+role="status"\\s+aria-live="polite"\\s+className="[^"]+"/;
  if(!root.test(panel))throw Error("[FAIL] Courier completion root not recognized");
  panel=panel.replace(root, '<section role="status" aria-live="polite" data-apois-completion-light-v1 className="relative -mt-2 overflow-hidden rounded-[1.5rem] border border-[#F2CDD2] bg-white px-4 pb-4 pt-3 text-center text-[#111827] shadow-[0_10px_30px_rgba(17,24,39,0.08)]"');
 }
 const earnings=/<div className="[^"]*max-w-xs[^"]*justify-between[^"]*">/;
 if(!earnings.test(panel))throw Error("[FAIL] Courier completed earnings card missing");
 panel=panel.replace(earnings,'<div className="mx-auto mt-4 flex max-w-xs items-center justify-between rounded-xl border border-[#F2CDD2] bg-[#FFF5F6] p-3 text-left">');
 const onDone='onClick={onDone}';
 const at=panel.indexOf(onDone);
 if(at<0 || panel.indexOf(onDone,at+1)>=0)throw Error("[FAIL] Courier completion action not unique");
 const after=panel.slice(at);
 const css=/className="[^"]+"/;
 if(!css.test(after))throw Error("[FAIL] Courier completion action CSS missing");
 panel=panel.slice(0,at)+after.replace(css,'className="mt-4 h-12 w-full rounded-xl bg-[#E90024] font-black uppercase text-white shadow-md"');
 src=src.slice(0,begin)+panel+src.slice(end);
 return src;
},'data-apois-completion-light-v1');

patch("src/system-theme.css",(input)=>{
 const marker="/* APOIS_COURIER_COMPLETION_LIGHT_V1 */";
 if(input.includes(marker))return input;
 return input+"\n"+marker+"\n"+
  '.apois-system-theme [data-apois-completion-light-v1] { background:#FFF!important;color:#111827!important; }\n'+
  '.apois-system-theme [data-apois-completion-light-v1] [data-apois-courier-complete-title] { color:#111827!important; }\n';
},'APOIS_COURIER_COMPLETION_LIGHT_V1');
