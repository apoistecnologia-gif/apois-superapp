import {readFileSync,writeFileSync} from "node:fs";
import {resolve} from "node:path";
const file=resolve(".work/entregas/src/routes/pedido/$orderId/avaliar.tsx");
let s=readFileSync(file,"utf8");
if(s.includes("APOIS_CUSTOMER_PRODUCT_REVIEW_V1"))process.exit(0);
function rep(a,b,name){if(!s.includes(a))throw Error("[FAIL] review patch "+name);s=s.replace(a,b)}
rep('  delivery_jobs: Array<{ courier_id: string | null }> | null;\n};',
'  delivery_jobs: { courier_id: string | null } | Array<{ courier_id: string | null }> | null;\n  order_items: Array<{ id:string; product_name:string; quantity:number }> | null;\n};',"order item type");
rep('  const [comment, setComment] = useState("");',
'  const [comment, setComment] = useState("");\n  // APOIS_CUSTOMER_PRODUCT_REVIEW_V1\n  const [productEnabled,setProductEnabled]=useState(false);\n  const [ratings,setRatings]=useState<Record<string,number>>({});\n  const [notes,setNotes]=useState<Record<string,string>>({});\n  const [productsSaved,setProductsSaved]=useState(false);\n  const [loadError,setLoadError]=useState<string|null>(null);',"state");
rep('.select("id,order_number,status,merchants(name,logo_url),delivery_jobs(courier_id)")',
'.select("id,order_number,status,merchants(name,logo_url),delivery_jobs(courier_id),order_items(id,product_name,quantity)")',"items");
rep('    const fetchOrder = async () => {\n      const {',
'    const fetchOrder = async () => {\n      try {\n      const {',"guard loading");
rep('      if (orderError || !orderData) {\n        if (orderError) console.error("Erro ao carregar pedido para avaliação:", orderError);\n        setOrder(null);',
'      if (orderError || !orderData) {\n        if (orderError) console.warn("Falha na consulta do pedido de avaliação:", orderError.code);\n        setLoadError("Não foi possível carregar o pedido. Volte a Meus Pedidos e tente novamente.");\n        setOrder(null);',"error message");
rep('      setOrder(orderData as ReviewOrder);\n',
'      setOrder(orderData as ReviewOrder);\n      const productResult = await (supabase as any).from("product_order_reviews")\n        .select("order_item_id,rating,comment").eq("order_id",orderId).eq("customer_user_id",user.id);\n      if (!disposed && !productResult.error) {\n        setProductEnabled(true);\n        const rows = productResult.data ?? [];\n        if (rows.length) {\n          setProductsSaved(true);\n          setRatings(Object.fromEntries(rows.map((r:any)=>[r.order_item_id,Number(r.rating)])));\n          setNotes(Object.fromEntries(rows.map((r:any)=>[r.order_item_id,r.comment ?? ""])));\n        }\n      }\n',"product read graceful optional");
rep('      setLoading(false);\n    };\n\n    void fetchOrder();',
'      setLoading(false);\n      } catch (error) {\n        console.warn("Erro controlado na avaliação:",error);\n        if (!disposed) { setLoadError("Não foi possível carregar a avaliação."); setLoading(false); }\n      }\n    };\n\n    void fetchOrder();',"fetch exceptions");
rep('    if (!order || submitting || alreadyReviewed) return;\n    if (!merchantRating) {',
'    if (!order || submitting || (alreadyReviewed && (!productEnabled || productsSaved))) return;\n    if (!alreadyReviewed && !merchantRating) {',"review guard");
rep('    if (hasCourier && !deliveryRating) {',
'    if (!alreadyReviewed && hasCourier && !deliveryRating) {',"delivery required");
rep('    setSubmitting(true);\n    const { error } = await (supabase as any).rpc("submit_order_review", {\n      _order_id: order.id,\n      _merchant_rating: merchantRating,\n      _courier_rating: hasCourier ? deliveryRating : null,\n      _comment: comment.trim() || null,\n    });',
'    const products = order.order_items ?? [];\n    if (productEnabled && products.some((item)=>!ratings[item.id])) {\n      toast.error("Dê uma nota para cada produto recebido."); return;\n    }\n    const productPayload=products.map((item)=>({order_item_id:item.id,rating:ratings[item.id],comment:(notes[item.id]??"").trim()||null}));\n    setSubmitting(true);\n    const name=alreadyReviewed?"submit_order_product_reviews":productEnabled&&products.length>0?"submit_order_review_with_products":"submit_order_review";\n    const payload=alreadyReviewed?{_order_id:order.id,_products:productPayload}:productEnabled&&products.length>0?{\n      _order_id:order.id,_merchant_rating:merchantRating,_courier_rating:hasCourier?deliveryRating:null,_comment:comment.trim()||null,_products:productPayload\n    }:{_order_id:order.id,_merchant_rating:merchantRating,_courier_rating:hasCourier?deliveryRating:null,_comment:comment.trim()||null};\n    const {error}=await (supabase as any).rpc(name,payload);',"atomic rpc mode");
rep('      setAlreadyReviewed(true);\n      toast.success("Obrigado pela sua avaliação!");',
'      setAlreadyReviewed(true);\n      if(productEnabled && products.length>0)setProductsSaved(true);\n      toast.success("Obrigado pela sua avaliação!");',"successful save");
rep('        <h2 className="mb-4 text-xl font-bold">Pedido não encontrado</h2>',
'        <h2 className="mb-4 text-xl font-bold">{loadError?"Avaliação indisponível":"Pedido não encontrado"}</h2>\n        {loadError?<p className="mb-4 text-center text-sm">{loadError}</p>:null}',"fallback");
const reviewCard=[
'          {(order.order_items ?? []).length>0 ? (',
'            <div data-apois-product-reviews className="space-y-4 rounded-2xl border border-zinc-900 bg-zinc-950 p-5">',
'              <h3 className="text-sm font-bold uppercase text-zinc-300">Produtos recebidos</h3>',
'              <p className="text-xs text-zinc-400">Avalie cada produto, de 1 a 5 estrelas.</p>',
'              {(order.order_items ?? []).map((item)=>(',
'                <div key={item.id} className="space-y-2 rounded-xl border border-zinc-800 p-3">',
'                  <p className="text-sm font-semibold">{item.quantity}x {item.product_name}</p>',
'                  <StarRating value={ratings[item.id] ?? 0} disabled={!productEnabled || productsSaved}',
'                    onChange={(value)=>setRatings((current)=>({...current,[item.id]:value}))}/>',
'                  <textarea aria-label={"Comentário sobre "+item.product_name} maxLength={500}',
'                    value={notes[item.id]??""} disabled={!productEnabled || productsSaved}',
'                    onChange={(event)=>setNotes((current)=>({...current,[item.id]:event.target.value}))}',
'                    placeholder="Comentário sobre o produto (opcional)"',
'                    className="min-h-16 w-full rounded-lg border border-zinc-700 bg-zinc-900 p-2 text-sm text-white" />',
'                </div>',
'              ))}',
'              {!productEnabled ? <p role="status" className="text-xs text-amber-300">',
'                Avaliação individual dos produtos aguardando ativação segura no servidor. A avaliação do estabelecimento e da entrega continua disponível.',
'              </p> : null}',
'              {productsSaved ? <p className="text-xs text-emerald-300">Produtos já avaliados.</p> : null}',
'            </div>',
'          ) : null}'
].join("\n");
const position='          <div className="space-y-4 rounded-2xl border border-zinc-900 bg-zinc-950 p-6">\n            <div className="mb-2 flex items-center gap-2">\n              <MessageSquare';
rep(position,reviewCard+"\n"+position,"product card");
rep('        {alreadyReviewed ? (\n          <button',
'        {alreadyReviewed && (!productEnabled || productsSaved || !(order.order_items??[]).length) ? (\n          <button',"footer state");
rep('disabled={submitting || !merchantRating || (hasCourier && !deliveryRating)}',
'disabled={submitting || (!alreadyReviewed && (!merchantRating || (hasCourier && !deliveryRating))) || (productEnabled && (order.order_items??[]).some((item)=>!ratings[item.id]))}',"submit disabled");
rep('{submitting ? "Enviando..." : "Enviar avaliação"}',
'{submitting ? "Enviando..." : alreadyReviewed ? "Avaliar produtos" : "Enviar avaliação"}',"submit text");
rep('  const hasCourier = Boolean(order?.delivery_jobs?.some((job) => Boolean(job.courier_id)));',
'  // The delivery_jobs.order_id UNIQUE constraint makes this a to-one relation.\n  // PostgREST may return an object, not an array; never call .some on the object.\n  const linkedJobs = order?.delivery_jobs;\n  const hasCourier = Array.isArray(linkedJobs)\n    ? linkedJobs.some((job) => Boolean(job?.courier_id))\n    : Boolean(linkedJobs?.courier_id);',"one-to-one delivery relation");
writeFileSync(file,s,"utf8");
console.log("[OK] Customer review isolated patch: guarded route, existing ratings preserved, staged product ratings");
