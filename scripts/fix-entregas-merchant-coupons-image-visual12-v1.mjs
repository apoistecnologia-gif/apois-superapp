// RV12 CV-040/041/043: Merchant coupon visual truth and accessible image input.
import {readFileSync,writeFileSync} from "node:fs";
import {resolve} from "node:path";
import {fileURLToPath} from "node:url";
export const COUPON_MARK="APOIS_CV12_COUPON_STATES_V1";
export const IMAGE_MARK="APOIS_CV12_PRODUCT_IMAGE_KEYBOARD_V1";
function once(s,a,b,label){const n=s.split(a).length-1;if(n!==1)throw Error("[RV12 merchant] "+label+" "+n);return s.replace(a,b)}
export function patchCouponStates(s){
  if(s.includes(COUPON_MARK)){
    for(const v of ["couponListFailed","scheduled","usageState!==\"ready\""])if(!s.includes(v))throw Error("[RV12] coupon partial "+v);
    return s;
  }
  if(!s.includes("APOIS_COUPON_USE_READ_STATUS_V2")||!s.includes("usageState!==\"ready\""))
    throw Error("[RV12] coupon previous fail-closed protection missing");
  s=once(s,
    '  const [redemptions, setRedemptions] = useState<Redemption[]>([]);',
    '  const [redemptions, setRedemptions] = useState<Redemption[]>([]);\n  const [couponListFailed,setCouponListFailed] = useState(false); // '+COUPON_MARK,
    "coupon list failure state");
  s=once(s,'    setLoading(true);\n    setUsageState("loading");',
    '    setLoading(true);\n    setUsageState("loading");\n    setCouponListFailed(false);',"start list loading");
  s=once(s,'      toast.error("Não foi possível carregar os cupons.");',
    '      setCouponListFailed(true);\n      toast.error("Não foi possível carregar os cupons.");',"failed list query");
  s=once(s,'    const nextCoupons = (couponsResult.data ?? []) as Coupon[];',
    '    setCouponListFailed(false);\n    const nextCoupons = (couponsResult.data ?? []) as Coupon[];',"successful list query");
  s=once(s,'{usageState==="failed"&&!loading&&(' ,
    '{usageState==="failed"&&!loading&&!couponListFailed&&(' ,"single error alert for usage");
  s=once(s,
    '          ) : coupons.length === 0 ? (',
    '          ) : couponListFailed ? (\n            <div role="alert" className="space-y-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-xs text-amber-200"><p>Não foi possível consultar os cupons. A lista não foi confirmada como vazia.</p><button type="button" className="min-h-11 rounded-lg border border-amber-500/40 px-3 font-bold" onClick={() => void load()}>Tentar novamente</button></div>\n          ) : coupons.length === 0 ? (',
    "error differs from empty");
  s=once(s,
    '                const expired = coupon.ends_at ? new Date(coupon.ends_at) <= new Date() : false;',
    '                const expired = coupon.ends_at ? new Date(coupon.ends_at) <= new Date() : false;\n                const scheduled = coupon.starts_at ? new Date(coupon.starts_at) > new Date() : false;',
    "scheduled start date");
  s=once(s,
    'coupon.is_active && !expired ? "bg-emerald-500/10 text-emerald-300" : "bg-zinc-800 text-zinc-500"',
    'coupon.is_active && !expired && !scheduled ? "bg-emerald-500/10 text-emerald-300" : "bg-zinc-800 text-zinc-500"',
    "future badge color");
  s=once(s,
    '{expired ? "Expirado" : coupon.is_active ? "Ativo" : "Pausado"}',
    '{expired ? "Expirado" : !coupon.is_active ? "Pausado" : scheduled ? "Agendado" : "Ativo"}',
    "future badge label");
  return s;
}
export function patchProductImage(s){
  if(s.includes(IMAGE_MARK)){
    if(!s.includes('className="sr-only"')||!s.includes("focus-within:ring-2"))throw Error("[RV12] partial image input");
    return s;
  }
  s=once(s,
    'className="block rounded-2xl border border-dashed border-zinc-800 bg-black p-4 text-center text-xs font-bold text-zinc-400"',
    'data-apois-cv12="APOIS_CV12_PRODUCT_IMAGE_KEYBOARD_V1" className="block rounded-2xl border border-dashed border-zinc-800 bg-black p-4 text-center text-xs font-bold text-zinc-400 focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2 focus-within:ring-offset-black"',
    "focus ring on label");
  s=once(s,
    '                  {busy === "image" ? "Enviando imagem..." : "Trocar imagem"}\n                  <input',
    '                  {busy === "image" ? "Enviando imagem..." : "Trocar imagem"}\n                  <span className="mt-1 block text-[10px] font-medium text-zinc-500">Formatos aceitos: JPG, PNG e WebP.</span>\n                  <input',
    "accepted format guidance");
  s=once(s,
    '                    className="hidden"\n                    onChange={(event) => {',
    '                    className="sr-only"\n                    onChange={(event) => {',
    "focusable native file input");
  return s;
}
export function applyMerchantStates(root=process.cwd()){
  const work=resolve(root,process.env.APOIS_ENTREGAS_WORKSPACE||".work/entregas");
  const rows=[["src/components/MerchantCouponsPanel.tsx",patchCouponStates],["src/components/MerchantProductEditor.tsx",patchProductImage]].map(([rel,fn])=>{
    const path=resolve(work,rel),old=readFileSync(path,"utf8");return{rel,path,old,next:fn(old)};
  });
  for(const row of rows)if(row.old!==row.next)writeFileSync(row.path,row.next,"utf8");
  return rows.filter(row=>row.old!==row.next).map(row=>row.rel);
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===resolve(process.argv[1]))
  console.log("[OK] RV12 merchant coupon/image UI",applyMerchantStates().join(",")||"already applied");
