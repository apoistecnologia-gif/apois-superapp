// INV-031 — client-side automatic promotion UI; canonical .work-only patch.
import {readFileSync,writeFileSync} from "node:fs";
import {resolve} from "node:path";
const root=resolve(process.env.APOIS_ENTREGAS_WORKSPACE||".work/entregas");
const marker="APOIS_AUTO_PROMOTIONS_CLIENT_V3";
function edit(file,fn){
 const path=resolve(root,file);let src=readFileSync(path,"utf8");
 if(src.includes(marker)){console.log("[OK] already patched "+file);return;}
 function one(a,b,id){
  const n=src.split(a).length-1;
  if(n!==1)throw Error("[FAIL] "+file+" "+id+": "+n);
  src=src.replace(a,b);
 }
 fn(one);
 if(!src.includes(marker))throw Error("missing marker "+file);
 writeFileSync(path,src,"utf8");
}
edit("src/contexts/CartContext.tsx",one=>{
 one("  merchantId: string;\n  selectedOptions: CartSelectedOption[];",
     "  merchantId: string;\n  menuCategoryId?: string | null; // "+marker+"\n  selectedOptions: CartSelectedOption[];","cart category");
});
edit("src/routes/estabelecimento.$merchantId.tsx",one=>{
 one('import { supabase } from "@/integrations/supabase/client";',
     'import { supabase } from "@/integrations/supabase/client";\nimport {fetchAvailablePromotions,type ApoisPromotion} from "@/lib/apois-promotions";\n// '+marker,"imports");
 one('  const [products, setProducts] = useState<Product[]>([]);',
     '  const [products, setProducts] = useState<Product[]>([]);\n  const [autoPromotions,setAutoPromotions] = useState<ApoisPromotion[]>([]);',"state");
 one('  const handleAddToCart = async (product: Product) => {',
     '  useEffect(()=>{\n    let cancelled=false;\n    setAutoPromotions([]);\n    if(merchantId)void fetchAvailablePromotions(merchantId).then(result=>{if(!cancelled)setAutoPromotions(result);}).catch(()=>{if(!cancelled)setAutoPromotions([]);});\n    return ()=>{cancelled=true;};\n  },[merchantId]);\n\n  const handleAddToCart = async (product: Product) => {',"promotion load");
 one('        merchantId: merchantId,\n        selectedOptions,',
     '        merchantId: merchantId,\n        menuCategoryId: product.menu_category_id,\n        selectedOptions,',"cart metadata");
 one('                    {product.description && (',
     '                    {autoPromotions.filter(p => (!p.product_id || p.product_id === product.id) && (!p.menu_category_id || p.menu_category_id === product.menu_category_id)).slice(0,1).map(p => (\n                      <p key={p.id} className="mt-1 rounded-lg bg-amber-500/10 px-2 py-1 text-[11px] font-bold text-amber-300">\n                        Oferta automática: {p.discount_type === "percent" ? Number(p.discount_value).toLocaleString("pt-BR")+"%" : "R$ "+Number(p.discount_value).toFixed(2).replace(".",",")}\n                        {Number(p.minimum_order)>0 ? " · pedido mínimo R$ "+Number(p.minimum_order).toFixed(2).replace(".",",") : ""}\n                      </p>\n                    ))}\n                    {product.description && (',"badge");
});
edit("src/routes/checkout.tsx",one=>{
 one('import { toast } from "sonner";',
     'import { toast } from "sonner";\nimport {fetchAvailablePromotions,estimateAutomaticPromotion,type ApoisPromotion} from "@/lib/apois-promotions";\n// '+marker,"imports");
 one('  const [appliedCoupon, setAppliedCoupon] = useState<CouponPreview | null>(null);',
     '  const [appliedCoupon, setAppliedCoupon] = useState<CouponPreview | null>(null);\n  const [automaticPromotions,setAutomaticPromotions]=useState<ApoisPromotion[]>([]);\n  const [serverPriceReview,setServerPriceReview]=useState<{orderId:string;amount:number;fingerprint:string}|null>(null);',"state");
 one('  const subtotal = totalPrice;',
     '  useEffect(()=>{\n    let cancelled=false;setAutomaticPromotions([]);\n    if(merchant?.id)void fetchAvailablePromotions(merchant.id).then(result=>{if(!cancelled)setAutomaticPromotions(result);}).catch(()=>{if(!cancelled)setAutomaticPromotions([]);});\n    return ()=>{cancelled=true;};\n  },[merchant?.id]);\n\n  const subtotal = totalPrice;',"fetch");
 one('  const discount = Number(appliedCoupon?.discount_amount ?? 0);',
     '  const automaticQuote=estimateAutomaticPromotion(automaticPromotions,items,subtotal,deliveryFee,serviceFee,Boolean(appliedCoupon));\n  const discount=appliedCoupon ? Number(appliedCoupon.discount_amount) : (automaticQuote?.discount ?? 0);',"estimate");
 one('      const orderId = orderResponse?.orderId;\n      if (!orderId) throw new Error("O backend não retornou o identificador do pedido.");',
     '      const orderId = orderResponse?.orderId;\n      if (!orderId) throw new Error("O backend não retornou o identificador do pedido.");\n      const backendTotal=Number(orderResponse?.total);\n      if(!Number.isFinite(backendTotal)||backendTotal<0.01)throw new Error("O total do pedido não foi validado no servidor.");\n      if(Math.abs(backendTotal-total)>0.009 && !(serverPriceReview?.orderId===orderId && serverPriceReview.fingerprint===fingerprint && Math.abs(serverPriceReview.amount-backendTotal)<0.009)) {\n        setServerPriceReview({orderId,amount:backendTotal,fingerprint});\n        toast.error("O valor oficial do pedido mudou. Confirme o total antes de gerar o PIX.");\n        return;\n      }\n      setServerPriceReview(null);',"server verification");
 one('              <span>Desconto</span>',
     '              <span>{appliedCoupon ? "Desconto do cupom" : "Promoção automática: "+(automaticQuote?.promotion.name||"APOIS")}</span>',"label");
 one('        {checkoutError && (',
     '        {serverPriceReview && (\n          <div role="alert" className="mb-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-200">\n            O servidor confirmou o novo total de R$ {serverPriceReview.amount.toFixed(2).replace(".",",")}. Confira antes de continuar. Nenhuma cobrança foi realizada.\n          </div>\n        )}\n        {checkoutError && (',"review alert");
 one('            "Finalizar Pedido"\n          )}',
     '            serverPriceReview ? "Confirmar novo valor e gerar PIX" : "Finalizar Pedido"\n          )}',"review CTA");
});
console.log("[OK] INV-031 promos automaticas no cliente com valor oficial e confirmacao de aumento.");
