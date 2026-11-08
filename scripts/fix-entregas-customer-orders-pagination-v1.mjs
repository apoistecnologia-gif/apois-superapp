// INV-013 — stable, owner-scoped cursor pagination for customer order history.
// Only writes the isolated .work/entregas source. No production data mutations.
import {readFileSync,writeFileSync} from "node:fs";
import {resolve} from "node:path";
const path=resolve(process.env.APOIS_ENTREGAS_WORKSPACE||".work/entregas","src/routes/pedidos.tsx");
const marker="APOIS_CUSTOMER_ORDERS_CURSOR_V1";
let s=readFileSync(path,"utf8");
if(s.includes(marker)){console.log("[OK] INV-013 already installed");process.exit(0);}
function one(a,b,label){
 const count=s.split(a).length-1;
 if(count!==1)throw Error("[FAIL] INV-013 "+label+": found "+count+" anchors");
 s=s.replace(a,b);
}
function section(start,end,newValue){
 const at=s.indexOf(start);
 if(at<0||s.indexOf(start,at+1)>=0)throw Error("[FAIL] INV-013 start anchor mismatch");
 const finish=s.indexOf(end,at+start.length);
 if(finish<0)throw Error("[FAIL] INV-013 end anchor mismatch");
 s=s.slice(0,at)+newValue+s.slice(finish+end.length);
}
one('import { useCallback, useEffect, useState } from "react";',
    'import { useCallback, useEffect, useRef, useState } from "react";',"import");
one('const dangerStatuses = new Set(["cancelled", "refunded"]);',
    'const dangerStatuses = new Set(["cancelled", "refunded"]);\n// '+marker+'\nconst ORDER_PAGE_SIZE=30;\ntype OrderCursor={created_at:string;id:string};\nconst sortRecentOrders=(a:any,b:any)=>String(b.created_at).localeCompare(String(a.created_at))||String(b.id).localeCompare(String(a.id));',"constants");
one('  const [loadError, setLoadError] = useState<string | null>(null);',
    '  const [loadError, setLoadError] = useState<string | null>(null);\n  const [hasOlderOrders,setHasOlderOrders]=useState(false);\n  const [olderLoading,setOlderLoading]=useState(false);\n  const [olderError,setOlderError]=useState<string|null>(null);\n  const cursorRef=useRef<OrderCursor|null>(null);\n  const ownerRef=useRef<string|null>(null);\n  const generation=useRef(0);',"state");
const newFetch=`  const fetchOrders=useCallback(async(showLoading=true)=>{
    const requestGeneration=++generation.current;
    if(showLoading){setLoading(true);setLoadError(null);setOlderError(null);}
    const {data:{user},error:userError}=await supabase.auth.getUser();
    if(requestGeneration!==generation.current)return;
    if(userError||!user){
      ownerRef.current=null;cursorRef.current=null;
      setOrders([]);setHasOlderOrders(false);
      setLoadError("Não foi possível identificar sua sessão. Tente novamente.");
      setLoading(false);return;
    }
    const ownerChanged=ownerRef.current!==user.id;
    if(ownerChanged){ownerRef.current=user.id;cursorRef.current=null;setOrders([]);setHasOlderOrders(false);}
    const {data,error}=await supabase
      .from("orders" as any)
      .select("*, merchants(name, logo_url)")
      .eq("customer_user_id",user.id)
      .order("created_at",{ascending:false})
      .order("id",{ascending:false})
      .limit(ORDER_PAGE_SIZE+1);
    if(requestGeneration!==generation.current||ownerRef.current!==user.id)return;
    if(error){
      console.error("Erro ao carregar pedidos reais:",error);
      if(showLoading||ownerChanged){
        setOrders([]);
        setLoadError("Não foi possível carregar seus pedidos agora.");
      }
      setLoading(false);return;
    }
    const rows=(data||[]).slice(0,ORDER_PAGE_SIZE);
    if(showLoading||ownerChanged){
      setOrders(rows);
      setHasOlderOrders((data||[]).length>ORDER_PAGE_SIZE);
      const last=rows[rows.length-1];
      cursorRef.current=last?{created_at:last.created_at,id:last.id}:null;
    }else{
      // Realtime refresh only updates the newest page; previously loaded history remains visible.
      setOrders(current=>{
        const byId=new Map(current.map(order=>[order.id,order]));
        for(const order of rows)byId.set(order.id,order);
        return [...byId.values()].sort(sortRecentOrders);
      });
    }
    setLoading(false);
  },[]);`;
section('  const fetchOrders = useCallback(async (showLoading = true) => {',
        '  }, []);',newFetch);
const olderHandler=`
  const loadOlderOrders=async()=>{
    if(olderLoading||!hasOlderOrders||!cursorRef.current)return;
    const cursor=cursorRef.current;
    const requestGeneration=generation.current;
    setOlderLoading(true);setOlderError(null);
    try{
      const {data:{user},error:userError}=await supabase.auth.getUser();
      if(userError||!user||ownerRef.current!==user.id)
        throw new Error("Sua sessão mudou. Reabra o histórico de pedidos.");
      // Both cursor fields are server-sourced. Validate before embedding in PostgREST filter.
      if(!/^\d{4}-\d{2}-\d{2}T[\d:.+-]+Z?$/.test(cursor.created_at)||
         !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(cursor.id))
        throw new Error("Não foi possível continuar este histórico.");
      const filter="created_at.lt."+cursor.created_at+
                   ",and(created_at.eq."+cursor.created_at+",id.lt."+cursor.id+")";
      const {data,error}=await supabase
        .from("orders" as any)
        .select("*, merchants(name, logo_url)")
        .eq("customer_user_id",user.id)
        .or(filter)
        .order("created_at",{ascending:false})
        .order("id",{ascending:false})
        .limit(ORDER_PAGE_SIZE+1);
      if(requestGeneration!==generation.current||ownerRef.current!==user.id)return;
      if(error)throw error;
      const page=(data||[]).slice(0,ORDER_PAGE_SIZE);
      setOrders(current=>{
        const byId=new Map(current.map(order=>[order.id,order]));
        for(const order of page)byId.set(order.id,order);
        return [...byId.values()].sort(sortRecentOrders);
      });
      setHasOlderOrders((data||[]).length>ORDER_PAGE_SIZE);
      const last=page[page.length-1];
      cursorRef.current=last?{created_at:last.created_at,id:last.id}:null;
    }catch(error){
      console.error("Erro ao carregar página de pedidos:",error);
      setOlderError("Não foi possível carregar pedidos anteriores. Tente novamente.");
    }finally{
      setOlderLoading(false);
    }
  };

`;
one('  useEffect(() => {\n    void fetchOrders();',
    olderHandler+'  useEffect(() => {\n    void fetchOrders();',"load more");
one('          () => {\n            void fetchOrders(false);\n          },',
    '          (payload) => {\n            // Keep a loaded historical order current even when it is older than page one.\n            if(payload.eventType==="UPDATE" && payload.new && "id" in payload.new){\n              setOrders(current=>current.map(order=>order.id===payload.new.id?{...order,...payload.new}:order));\n            }\n            void fetchOrders(false);\n          },',"realtime");
one('        ) : orders.length > 0 ? (\n          orders.map((order) => (',
    '        ) : orders.length > 0 ? (\n          <>\n          {orders.map((order) => (',"list jsx open");
const listClose=`          ))}
          {hasOlderOrders&&(
            <button
              type="button"
              onClick={()=>void loadOlderOrders()}
              disabled={olderLoading}
              className="mx-auto flex min-h-11 items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-zinc-950 px-5 py-3 text-sm font-bold text-white disabled:opacity-50"
            >
              {olderLoading?<Loader2 className="h-4 w-4 animate-spin"/>:null}
              Carregar pedidos anteriores
            </button>
          )}
          {olderError&&<p role="alert" className="text-center text-xs text-amber-300">{olderError}</p>}
          </>
        ) : (`;
one('          ))\n        ) : (',listClose,"list jsx close");
if(!s.includes(marker))throw Error("[FAIL] INV-013 marker not written");
writeFileSync(path,s,"utf8");
console.log("[OK] INV-013: cursor paginated customer orders, owner scoped, realtime list preserved.");
