// INV-033 — reconcile persisted cart against current catalog before new checkout.
// Applied only to isolated .work/entregas; server continues final authority.
import {readFileSync,writeFileSync} from "node:fs";
import {resolve} from "node:path";
const root=resolve(process.env.APOIS_ENTREGAS_WORKSPACE||".work/entregas");
const marker="APOIS_CART_PERSISTED_REVALIDATION_V3";
function patch(file,fn){
 const path=resolve(root,file);let s=readFileSync(path,"utf8");
 if(s.includes(marker)){console.log("[OK] already installed: "+file);return;}
 function one(a,b,label){const n=s.split(a).length-1;if(n!==1)throw Error("[FAIL] "+file+" "+label+": "+n);s=s.replace(a,b);}
 fn(one);
 if(!s.includes(marker))throw Error("marker missing "+file);
 writeFileSync(path,s,"utf8");
}
patch("src/contexts/CartContext.tsx",one=>{
 one('import { toast } from "sonner";',
     'import { toast } from "sonner";\nimport {supabase} from "@/integrations/supabase/client";\n// '+marker,"import");
 one('import React, { createContext, useCallback, useContext, useEffect, useState } from "react";',
     'import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";',"ref");
 one('  selectedOptions: CartSelectedOption[];\n};',
     '  selectedOptions: CartSelectedOption[];\n  isUnavailable?: boolean;\n};',"item availability");
 one('  clearCart: () => void;\n  totalItems: number;',
     '  clearCart: () => void;\n  refreshCartCatalog: () => Promise<boolean>;\n  totalItems: number;',"provider api");
 one('  const [isHydrated, setIsHydrated] = useState(false);',
     '  const [isHydrated, setIsHydrated] = useState(false);\n  const catalogRequest=useRef(0);',"request state");
 one('...newItem, lineId, basePrice, price: finalUnitPrice,',
     '...newItem, isUnavailable: false, lineId, basePrice, price: finalUnitPrice,',"readd clears unavailable");
 one('  const totalItems = items.reduce((acc, item) => acc + item.quantity, 0);',
 '  const refreshCartCatalog=async ():Promise<boolean>=>{\n' +
 '    const snapshot=items.filter(item=>item.merchantId===merchant?.id);\n' +
 '    if(!isHydrated||!snapshot.length)return false;\n' +
 '    const sequence=++catalogRequest.current;\n' +
 '    const ids=[...new Set(snapshot.map(item=>item.id))];\n' +
 '    try{\n' +
 '      const {data:products,error:productError}=await (supabase.from as any)("products").select("id,name,price,is_available,menu_category_id").in("id",ids);\n' +
 '      if(productError)throw productError;\n' +
 '      const optionIds=[...new Set(snapshot.flatMap(item=>item.selectedOptions.map(opt=>opt.optionId)))];\n' +
 '      let options:any[]=[];\n' +
 '      if(optionIds.length){\n' +
 '        const result=await (supabase.from as any)("product_options").select("id,name,price_delta,is_available,option_group_id").in("id",optionIds);\n' +
 '        if(result.error)throw result.error;\n' +
 '        options=result.data||[];\n' +
 '      }\n' +
 '      const groupIds=[...new Set(options.map(opt=>opt.option_group_id))];\n' +
 '      let groups:any[]=[];\n' +
 '      if(groupIds.length){\n' +
 '        const result=await (supabase.from as any)("product_option_groups").select("id,name,product_id,is_active").in("id",groupIds);\n' +
 '        if(result.error)throw result.error;\n' +
 '        groups=result.data||[];\n' +
 '      }\n' +
 '      if(sequence!==catalogRequest.current)return false;\n' +
 '      const productsById=new Map<string,any>((products||[]).map((p:any)=>[p.id,p]));\n' +
 '      const optionsById=new Map<string,any>(options.map((p:any)=>[p.id,p]));\n' +
 '      const groupsById=new Map<string,any>(groups.map((p:any)=>[p.id,p]));\n' +
 '      let changed=false,unavailable=false;\n' +
 '      const refreshed=new Map(snapshot.map(item=>{\n' +
 '        const product=productsById.get(item.id);\n' +
 '        const invalidProduct=!product||product.is_available!==true||!Number.isFinite(Number(product.price))||Number(product.price)<0;\n' +
 '        const newOptions=item.selectedOptions.map(opt=>{\n' +
 '          const live=optionsById.get(opt.optionId);\n' +
 '          const group=live?groupsById.get(live.option_group_id):null;\n' +
 '          if(!live||live.is_available!==true||!Number.isFinite(Number(live.price_delta))||!group||group.is_active!==true||group.product_id!==item.id)return null;\n' +
 '          return {...opt,optionName:String(live.name),priceDelta:Number(live.price_delta),groupName:String(group.name)};\n' +
 '        });\n' +
 '        const invalidOptions=newOptions.some(opt=>opt===null);\n' +
 '        const missing=invalidProduct||invalidOptions;\n' +
 '        const base=invalidProduct?item.basePrice:Number(product.price);\n' +
 '        const adjusted=newOptions.filter((opt):opt is CartSelectedOption=>opt!==null);\n' +
 '        const price=missing?item.price:base+adjusted.reduce((a,o)=>a+o.priceDelta,0);\n' +
 '        if(missing)unavailable=true;\n' +
 '        if(Math.abs(price-Number(item.price))>0.001||Boolean(item.isUnavailable)!==missing||(product?.menu_category_id??null)!==(item.menuCategoryId??null))changed=true;\n' +
 '        return [item.lineId,{...item,basePrice:base,price,isUnavailable:missing,\n' +
 '          menuCategoryId:product?.menu_category_id??item.menuCategoryId,\n' +
 '          name:product?.name??item.name,selectedOptions:missing?item.selectedOptions:adjusted}] as const;\n' +
 '      }));\n' +
 '      setItems(current=>current.map(item=>{const next=refreshed.get(item.lineId);return next&&next.merchantId===item.merchantId?{...next,quantity:item.quantity}:item;}));\n' +
 '      if(unavailable)toast.error("Há itens indisponíveis ou personalizações alteradas. Remova esses itens da sacola.");\n' +
 '      else if(changed)toast.info("Sacola atualizada com preços e opções do catálogo. Confira o novo total.");\n' +
 '      return !unavailable&&!changed;\n' +
 '    }catch{\n' +
 '      if(sequence===catalogRequest.current)toast.error("Não foi possível validar a sacola. Tente novamente com conexão ativa.");\n' +
 '      return false;\n' +
 '    }\n' +
 '  };\n' +
 '  useEffect(()=>{if(isHydrated)void refreshCartCatalog();},[isHydrated]);\n\n' +
 '  const totalItems = items.reduce((acc, item) => acc + item.quantity, 0);',"refresh implementation");
 one('        clearCart,\n        totalItems,',
     '        clearCart,\n        refreshCartCatalog,\n        totalItems,',"provider value");
});
patch("src/routes/sacola.tsx",one=>{
 one('import { useCart } from "@/contexts/CartContext";',
     'import { useCart } from "@/contexts/CartContext";\nimport { toast } from "sonner";\n// '+marker,"import");
 one('  const { items, merchant, updateQuantity, removeItem, totalPrice } = useCart();',
     '  const { items, merchant, updateQuantity, removeItem, totalPrice, refreshCartCatalog } = useCart();',"state");
 one('    void fetchDefaultAddress();',
     '    void fetchDefaultAddress();\n    void refreshCartCatalog();',"refresh on entry");
 one('    if (items.length === 0) {',
     '    if(items.some(item=>item.isUnavailable)){toast.error("Remova os produtos indisponíveis antes de finalizar.");return;}\n    if (items.length === 0) {',"blocked checkout");
 one('<h3 className="text-[15px] font-bold text-white">{item.name}</h3>',
     '<h3 className="text-[15px] font-bold text-white">{item.name}</h3>\n                  {item.isUnavailable && <p role="alert" className="text-xs font-bold text-red-400">Item indisponível ou personalização inválida. Remova para continuar.</p>}',"item label");
});
patch("src/routes/checkout.tsx",one=>{
 one('  const { items, merchant, totalPrice, clearCart, isHydrated } = useCart();',
     '  const { items, merchant, totalPrice, clearCart, isHydrated, refreshCartCatalog } = useCart();',"checkout revalidator");
 one('  const subtotal = totalPrice;',
     '  // '+marker+'\n  const hasUnavailableItems=items.some(item=>item.isUnavailable);\n  const subtotal = totalPrice;',"state");
 one('      if (items.length === 0) throw new Error("Sua sacola está vazia.");',
     '      if (items.length === 0) throw new Error("Sua sacola está vazia.");\n      if(hasUnavailableItems)throw new Error("Remova os itens indisponíveis antes de finalizar.");\n      if(!(await refreshCartCatalog()))throw new Error("Não foi possível validar a sacola atual. Confira os itens e tente novamente.");',"server boundary");
 one('            isProcessing || minimumOrderMissing > 0 || deliveryQuoteLoading || !deliveryEligible',
     '            isProcessing || hasUnavailableItems || minimumOrderMissing > 0 || deliveryQuoteLoading || !deliveryEligible',"disable");
});
console.log("[OK] INV-033: persisted cart checked against latest products/options, invalid checkout blocked.");
