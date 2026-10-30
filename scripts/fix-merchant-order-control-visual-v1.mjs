import {existsSync,readFileSync,writeFileSync} from "node:fs";
import {resolve} from "node:path";
const file=resolve(".work/entregas/src/components/MerchantOrderControlCenter.tsx");
if(!existsSync(file))throw Error("[FAIL] merchant order panel missing");
const before=readFileSync(file,"utf8");let s=before;
for(const [a,b] of [["className=\"fixed bottom-5 left-5 z-[990] text-white\"","data-apois-merchant-orders-light-v1 className=\"fixed bottom-[max(12px,env(safe-area-inset-bottom))] left-3 right-3 z-[990] text-[#111827] sm:right-auto\""],["className=\"mb-3 max-h-[72dvh] w-[min(420px,calc(100vw-2.5rem))] overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-950 shadow-2xl\"","className=\"mb-3 max-h-[72dvh] w-full overflow-hidden rounded-2xl border border-[#E0E4EA] bg-white shadow-xl sm:w-[420px]\""],["className=\"flex items-center justify-between border-b border-zinc-900 px-4 py-3\"","className=\"flex items-center justify-between border-b border-[#E5E7EB] px-4 py-3\""],["className=\"rounded-full bg-zinc-900 p-2 text-zinc-400\"","className=\"rounded-full bg-[#F3F4F6] p-2 text-[#475467]\""],["className=\"rounded-2xl border border-zinc-800 bg-black p-4\"","className=\"rounded-xl border border-[#E5E7EB] bg-[#F8FAFC] p-4\""],["className=\"mt-3 rounded-xl border border-amber-500/20 bg-amber-500/10 p-2 text-xs font-bold text-amber-300\"","className=\"mt-3 rounded-xl border border-[#F4CF80] bg-[#FFF7E6] p-2 text-xs font-bold text-[#8A5C0A]\""],["className=\"w-full bg-[#F6BE1C] font-black text-black hover:bg-[#F6BE1C]/90\"","className=\"w-full bg-[#E51B23] font-black text-white hover:bg-[#C9141B]\""],["className=\"rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs font-bold text-emerald-300\"","className=\"rounded-xl border border-[#BAE6D5] bg-[#ECFDF5] p-3 text-xs font-bold text-[#07644A]\""],["className=\"w-full border-red-500/20 text-red-400\"","className=\"w-full border-[#F2C5CC] text-[#B91C32]\""],["className=\"rounded-2xl border border-dashed border-zinc-800 p-6 text-center text-sm text-zinc-500\"","className=\"rounded-2xl border border-dashed border-[#DDE1E7] p-6 text-center text-sm text-[#596374]\""],["className=\"flex min-h-12 items-center gap-2 rounded-full border border-primary/40 bg-black px-4 py-3 text-sm font-black text-white shadow-2xl\"","className=\"flex min-h-12 items-center gap-2 rounded-full border border-[#F2C5CC] bg-white px-4 py-3 text-sm font-black text-[#111827] shadow-lg\""],["className=\"grid h-6 min-w-6 place-items-center rounded-full bg-primary px-1.5 text-xs text-black\"","className=\"grid h-6 min-w-6 place-items-center rounded-full bg-[#E51B23] px-1.5 text-xs text-white\""]]){
 if(s.includes(b))continue;
 if(!s.includes(a))throw Error("[FAIL] merchant order control visual source changed: "+a.slice(0,75));
 s=s.replace(a,b);
}
// The preceding mobile hardeners may alter CTA widths. Locate only the
// "Solicitar entregador" action, preserving requestCourier and all order logic.
const label='Solicitar entregador · Pedido #';
const labelAt=s.indexOf(label);
if(labelAt<0 || s.indexOf(label,labelAt+1)>=0)
  throw Error("[FAIL] Merchant courier CTA label not uniquely found");
const buttonAt=Math.max(s.lastIndexOf('<button',labelAt),s.lastIndexOf('<Button',labelAt));
if(buttonAt<0 || labelAt-buttonAt>1500 || !s.slice(buttonAt,labelAt).includes('requestCourier('))
  throw Error("[FAIL] Merchant courier request CTA not uniquely found: buttonAt="+buttonAt+" labelAt="+labelAt+" handler="+s.slice(Math.max(0,buttonAt),labelAt).includes("requestCourier("));
const classAt=s.indexOf('className="',buttonAt);
if(classAt<0 || classAt>labelAt)throw Error("[FAIL] Merchant CTA class not found");
const oldClassEnd=s.indexOf('"',classAt+11);
if(oldClassEnd<0 || oldClassEnd>labelAt)throw Error("[FAIL] Merchant CTA class malformed");
const safeClass="mb-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-[#C9141B] bg-[#E51B23] px-3 py-3 text-xs font-black uppercase text-white shadow-lg disabled:opacity-60 sm:w-[420px]";
s=s.slice(0,classAt)+'className="'+safeClass+'"'+s.slice(oldClassEnd+1);
if(!s.includes("data-apois-merchant-orders-light-v1")||s.includes('className="fixed bottom-5 left-5 z-[990] text-white"'))throw Error("[FAIL] merchant visual safety gate");
if(s!==before)writeFileSync(file,s,"utf8");
console.log("[OK] merchant floating order center: light APOIS, mobile safe-area, no business changes");
