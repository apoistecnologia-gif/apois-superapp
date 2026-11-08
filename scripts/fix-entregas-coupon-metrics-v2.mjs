// INV-032 — Merchant Coupons: failed redemption query is not zero usage.
// Work against .work only; preserve server-side ON DELETE RESTRICT.
import {readFileSync,writeFileSync} from "node:fs";
import {resolve} from "node:path";
const path=resolve(".work/entregas/src/components/MerchantCouponsPanel.tsx");
let src=readFileSync(path,"utf8");
const MARKER="APOIS_COUPON_USE_READ_STATUS_V2";
if(src.includes(MARKER)){console.log("[OK] coupons guarded");process.exit(0);}
function once(a,b,label){const hits=src.split(a).length-1;if(hits!==1)throw Error("[FAIL] coupon "+label+": "+hits);src=src.replace(a,b);}
once('  const [redemptions, setRedemptions] = useState<Redemption[]>([]);',
`  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  // ${MARKER}: 'failed' must never be rendered as a verified zero.
  const [usageState,setUsageState]=useState<"loading"|"ready"|"failed">("loading");`,"state");
once('  const load = useCallback(async () => {\n    setLoading(true);',
'  const load = useCallback(async () => {\n    setLoading(true);\n    setUsageState("loading");',"start");
once('      setCoupons([]);\n      setRedemptions([]);',
'      setCoupons([]);\n      setRedemptions([]);\n      setUsageState("failed");',"coupon query fail");
once('    if (nextCoupons.length === 0) {\n      setRedemptions([]);',
'    if (nextCoupons.length === 0) {\n      setRedemptions([]);\n      setUsageState("ready");',"no coupons");
once('      console.warn("Não foi possível carregar os usos dos cupons:", redemptionResult.error.code);\n      setRedemptions([]);',
'      console.warn("Não foi possível carregar os usos dos cupons:", redemptionResult.error.code);\n      setRedemptions([]);\n      setUsageState("failed");',"redemption fail");
once('      setRedemptions((redemptionResult.data ?? []) as Redemption[]);',
'      setRedemptions((redemptionResult.data ?? []) as Redemption[]);\n      setUsageState("ready");',"redemption success");
once('  const totalUses = redemptions.length;',
'  const totalUses = usageState === "ready" ? redemptions.length : "Indisponível";',"metric");
once('  const deleteCoupon = async (coupon: Coupon) => {',
`  const deleteCoupon = async (coupon: Coupon) => {
    if(usageState!=="ready"){
      toast.error("Não foi possível consultar os usos. Atualize os dados antes de excluir.");
      return;
    }`,"delete handler");
once('<MetricCard label="Usos registrados" value={totalUses} />',
'<MetricCard label="Usos registrados" value={totalUses} />',"metric line");
once(`          {loading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-zinc-500">`,
`          {usageState==="failed"&&!loading&&(
            <div role="alert" className="mb-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-100">
              Usos dos cupons indisponíveis. A exclusão fica bloqueada até confirmar o histórico.
              <button type="button" className="ml-2 font-bold underline" onClick={()=>void load()}>Tentar novamente</button>
            </div>
          )}
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-zinc-500">`,"retry state");
once('                        Uso: {uses}', '                        Uso: {usageState==="ready" ? uses : "Indisponível"}',"each count");
once('disabled={uses > 0 || busy === `delete:${coupon.id}`}',
'disabled={usageState!=="ready" || uses > 0 || busy === `delete:${coupon.id}`}',"delete UI");
if(!src.includes(MARKER)||!src.includes('usageState!=="ready"'))throw Error("incomplete coupon patch");
writeFileSync(path,src,"utf8");
console.log("[OK] INV-032: no false zero; deletion gated on verified usage.");
