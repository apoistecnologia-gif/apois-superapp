import {existsSync, readFileSync, writeFileSync} from "node:fs";
import {resolve} from "node:path";

// Only the admin readiness panel: no payment, subscription or dispatch changes.
const path=resolve(process.env.APOIS_ENTREGAS_WORKSPACE || ".work/entregas", "src/components/AdminCourierOperationalGates.tsx");
if(!existsSync(path)) throw Error("[FAIL] AdminCourierOperationalGates source missing");
const before=readFileSync(path,"utf8");
let after=before;
const replacements=[["data-apois-courier-operations-readiness className=\"rounded-2xl border border-zinc-800 bg-zinc-950 p-4\"","data-apois-courier-operations-readiness data-apois-readiness-light-v1 className=\"rounded-2xl border border-[#E1E5EC] bg-white p-4 text-[#141B29] shadow-sm\""],["className=\"mt-1 text-xs text-zinc-400\"","className=\"mt-1 text-xs text-[#475467]\""],["className=\"rounded-xl border border-zinc-700 p-2 text-zinc-200 disabled:opacity-50\"","className=\"rounded-xl border border-[#D0D5DD] bg-[#F8FAFC] p-2 text-[#344054] hover:bg-[#FFF0F2] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#E90024] disabled:opacity-50\""],["className=\"mt-3 text-sm text-amber-200\"","className=\"mt-3 text-sm font-semibold text-[#92400E]\""],["className=\"mt-3 text-xs text-zinc-400\"","className=\"mt-3 text-xs text-[#475467]\""],["className=\"flex gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-amber-100\"","className=\"flex gap-3 rounded-xl border border-[#F2D391] bg-[#FFFAEB] p-3 text-[#7A4B00]\""],["className=\"text-xs text-zinc-400\"","className=\"text-xs text-[#475467]\""]];
for(const [oldValue,newValue] of replacements){
  if(after.includes(newValue))continue;
  if(!after.includes(oldValue))throw Error("[FAIL] Admin readiness visual source changed: "+oldValue.slice(0,82));
  after=after.split(oldValue).join(newValue);
}
for(const marker of ["supabase.from(\"platform_settings\")","supabase.from(\"merchants\")","supabase.from(\"merchant_subscriptions\")","paymentProviderBlockingOrders(","merchantSubscriptionDateWarnings(","onClick={() => void refresh()}","role=\"alert\"","data-apois-courier-operations-readiness","Novos pagamentos Pix não estão habilitados","Estabelecimentos com assinatura não comprovada no período atual"]){
  if(!before.includes(marker)||!after.includes(marker))throw Error("[FAIL] Admin readiness operational behavior changed: "+marker);
}
if(!after.includes("data-apois-readiness-light-v1") || !after.includes("text-[#7A4B00]"))
  throw Error("[FAIL] Admin readiness visual/alert contrast not applied");
if(after.includes('className="flex gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-amber-100"'))
  throw Error("[FAIL] Admin readiness legacy warning text remains");
if(before!==after)writeFileSync(path,after,"utf8");
console.log("[OK] Admin readiness: white card + readable amber warnings; all readonly operational gates preserved");
