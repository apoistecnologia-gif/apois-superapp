// INV-024 — Every visible open/closed decision uses merchant_accepting_orders,
// never device-local time. Original schedules remain for informational UI only.
import {readFileSync,writeFileSync} from "node:fs";
import {resolve} from "node:path";
const root=resolve(process.env.APOIS_ENTREGAS_WORKSPACE||".work/entregas");
const marker="APOIS_MERCHANT_SERVER_STATUS_V3";
function patch(relative,callback){
 const path=resolve(root,relative);let s=readFileSync(path,"utf8");
 if(s.includes(marker)){console.log("[OK] already applied "+relative);return;}
 function one(a,b,label){const count=s.split(a).length-1;if(count!==1)throw Error("[FAIL] "+relative+" "+label+": "+count);s=s.replace(a,b);}
 callback(one);
 if(!s.includes(marker))throw Error("marker missing "+relative);
 writeFileSync(path,s,"utf8");
}
patch("src/lib/merchant-hours.ts",(one)=>{
 one('const from = (table: string) => (supabase.from as any)(table);',
 'const from = (table: string) => (supabase.from as any)(table);\n// '+marker+'\nexport async function fetchAuthoritativeMerchantStatuses(ids:string[]):Promise<Record<string,boolean>> {\n  if(!ids.length)return {};\n  const all:Record<string,boolean>={};\n  for(let start=0;start<ids.length;start+=200){\n    const {data,error}=await (supabase.rpc as any)("apois_visible_merchant_order_status",{p_merchant_ids:ids.slice(start,start+200)});\n    if(error)throw error;\n    for(const row of (Array.isArray(data)?data:[]))if(row?.merchant_id)all[String(row.merchant_id)]=row.accepting_orders===true;\n  }\n  return all;\n}',"server helper");
});
patch("src/routes/inicio.tsx",(one)=>{
 one('  calculateMerchantStatus,\n', '  fetchAuthoritativeMerchantStatuses,\n  // '+marker+'\n',"import");
 one('  const [merchants, setMerchants] = useState<any[]>([]);',
 '  const [merchants, setMerchants] = useState<any[]>([]);\n  const [authoritativeStatus,setAuthoritativeStatus]=useState<Record<string,boolean>>({});',"state");
 one('  const fetchData = useCallback(async () => {',
 '  useEffect(()=>{\n    let active=true;setAuthoritativeStatus({});\n    const ids=merchants.map(m=>String(m.id));\n    const refresh=()=>{if(!ids.length)return;void fetchAuthoritativeMerchantStatuses(ids).then(data=>{if(active)setAuthoritativeStatus(data);}).catch(()=>{if(active)setAuthoritativeStatus({});});};\n    refresh();\n    const visible=()=>{if(document.visibilityState==="visible")refresh();};\n    document.addEventListener("visibilitychange",visible);\n    return ()=>{active=false;document.removeEventListener("visibilitychange",visible);};\n  },[merchants]);\n\n  const fetchData = useCallback(async () => {',"fetch");
 one('const status = calculateMerchantStatus(mHours, undefined, mSpecialHours);',
 'const serverOpen=authoritativeStatus[merchant.id];\n                             const status={status:serverOpen===undefined?"unknown":serverOpen?"open":"closed",message:serverOpen===undefined?"Funcionamento indisponível":serverOpen?"Aberto agora":"Fechado agora"};',"display");
});
patch("src/routes/buscar.tsx",(one)=>{
 one('  calculateMerchantStatus,\n','  fetchAuthoritativeMerchantStatuses,\n  // '+marker+'\n',"import");
 one('  const [merchants, setMerchants] = useState<any[]>([]);',
 '  const [merchants, setMerchants] = useState<any[]>([]);\n  const [authoritativeStatus,setAuthoritativeStatus]=useState<Record<string,boolean>>({});',"state");
 one('  const merchantStatus = useCallback(\n    (merchantId: string) =>\n      calculateMerchantStatus(\n        merchantsHours.filter((hour) => hour.merchant_id === merchantId),\n        undefined,\n        merchantsSpecialHours.filter((hour) => hour.merchant_id === merchantId),\n      ),\n    [merchantsHours, merchantsSpecialHours],\n  );',
 '  useEffect(()=>{\n    let active=true;setAuthoritativeStatus({});\n    const ids=merchants.map(m=>String(m.id));\n    const refresh=()=>{if(!ids.length)return;void fetchAuthoritativeMerchantStatuses(ids).then(data=>{if(active)setAuthoritativeStatus(data);}).catch(()=>{if(active)setAuthoritativeStatus({});});};\n    refresh();\n    const visible=()=>{if(document.visibilityState==="visible")refresh();};\n    document.addEventListener("visibilitychange",visible);\n    return ()=>{active=false;document.removeEventListener("visibilitychange",visible);};\n  },[merchants]);\n  const merchantStatus=useCallback((merchantId:string)=>{\n    const value=authoritativeStatus[merchantId];\n    return {status:value===undefined?"unknown":value?"open":"closed",message:value===undefined?"Funcionamento indisponível":value?"Aberto agora":"Fechado agora"};\n  },[authoritativeStatus]);',"search status");
});
patch("src/routes/estabelecimento.$merchantId.tsx",(one)=>{
 one('  const [merchantHours, setMerchantHours] = useState<MerchantHours[]>([]);',
 '  const [merchantHours, setMerchantHours] = useState<MerchantHours[]>([]);\n  // '+marker+'\n  const [serverOpen,setServerOpen]=useState<boolean|null>(null);',"state");
 one('  const handleAddToCart = async (product: Product) => {\n    const status = calculateMerchantStatus(merchantHours, undefined, merchantSpecialHours);\n\n    if (status.status === "closed") {\n      toast.error("Este estabelecimento está fechado no momento.");\n      return;\n    }\n\n    if (status.status === "unknown") {\n      toast.error("Horário não disponível. Não é possível iniciar novo pedido.");\n      return;\n    }',
 '  const handleAddToCart = async (product: Product) => {\n    const {data:isOpen,error:statusError}=await (supabase.rpc as any)("merchant_accepting_orders",{p_merchant_id:merchantId});\n    if(statusError||isOpen!==true){\n      setServerOpen(statusError?null:false);\n      toast.error(statusError?"Não foi possível confirmar o funcionamento. Tente novamente.":"Este estabelecimento está fechado no momento.");\n      return;\n    }\n    setServerOpen(true);',"block cart");
 one('  const handleToggleFavorite = async () => {',
 '  useEffect(()=>{\n    let active=true;setServerOpen(null);\n    const load=()=>{void (supabase.rpc as any)("merchant_accepting_orders",{p_merchant_id:merchantId}).then((r:any)=>{if(active)setServerOpen(r.error?null:r.data===true);}).catch(()=>{if(active)setServerOpen(null);});};\n    load();\n    const visible=()=>{if(document.visibilityState==="visible")load();};\n    document.addEventListener("visibilitychange",visible);\n    return ()=>{active=false;document.removeEventListener("visibilitychange",visible);};\n  },[merchantId]);\n\n  const handleToggleFavorite = async () => {',"load status");
 one('const status = calculateMerchantStatus(\n                      merchantHours,\n                      undefined,\n                      merchantSpecialHours,\n                    );',
 'const status={status:serverOpen===null?"unknown":serverOpen?"open":"closed",message:serverOpen===null?"Funcionamento indisponível":serverOpen?"Aberto agora":"Fechado agora"};',"display");
});
console.log("[OK] INV-024: home, search and store use backend open/closed truth.");
