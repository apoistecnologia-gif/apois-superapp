// INV-031 — Canonical source generator for automatic, coupon-free store offers.
// Only edits .work/entregas. No server deployment or payments from this script.
import {readFileSync,writeFileSync,existsSync} from "node:fs";
import {resolve} from "node:path";
const root=resolve(process.env.APOIS_ENTREGAS_WORKSPACE||".work/entregas");
const helperPath=resolve(root,"src/lib/apois-promotions.ts");
const helper=String.raw\`import {supabase} from "@/integrations/supabase/client";
import type {CartItem} from "@/contexts/CartContext";

export type ApoisPromotion = {
  id:string; name:string; description:string|null;
  discount_type:"percent"|"fixed";
  discount_value:number|string;
  minimum_order:number|string;
  product_id:string|null; menu_category_id:string|null;
  starts_at:string; ends_at:string;
  remaining_uses:number|null;
};

export async function fetchAvailablePromotions(merchantId:string):Promise<ApoisPromotion[]> {
  if(!merchantId)return [];
  const {data,error}=await (supabase.rpc as any)("apois_available_merchant_promotions",{
    p_merchant_id:merchantId
  });
  if(error)throw error;
  return (Array.isArray(data)?data:[]) as ApoisPromotion[];
}

export function estimateAutomaticPromotion(
  promotions:ApoisPromotion[],
  items:CartItem[],
  subtotal:number,
  deliveryFee:number,
  serviceFee:number,
  explicitCoupon=false,
):{promotion:ApoisPromotion;discount:number}|null {
  if(explicitCoupon||!Number.isFinite(subtotal)||subtotal<=0)return null;
  let best:{promotion:ApoisPromotion;discount:number}|null=null;
  const maxDiscount=Math.max(0,Math.round((subtotal+deliveryFee+serviceFee-0.01)*100)/100);
  for(const promotion of [...promotions].sort((a,b)=>a.id.localeCompare(b.id))) {
    if(promotion.remaining_uses!==null&&Number(promotion.remaining_uses)<=0)continue;
    if(subtotal<Number(promotion.minimum_order))continue;
    const eligible=items.reduce((sum,item)=>{
      if(promotion.product_id&&promotion.product_id!==item.id)return sum;
      if(promotion.menu_category_id&&promotion.menu_category_id!==item.menuCategoryId)return sum;
      return sum+item.price*item.quantity;
    },0);
    if(eligible<=0)continue;
    const value=Number(promotion.discount_value);
    if(!Number.isFinite(value)||value<=0)continue;
    const raw=promotion.discount_type==="percent" ? eligible*value/100:Math.min(eligible,value);
    const discount=Math.max(0,Math.min(subtotal,maxDiscount,Math.round(raw*100)/100));
    if(discount>0&&(!best||discount>best.discount))best={promotion,discount};
  }
  return best;
}
\`;
if(existsSync(helperPath)){
 const s=readFileSync(helperPath,"utf8");
 if(s===helper){console.log("[OK] automatic promo helper already installed");}
 else throw Error("[FAIL] src/lib/apois-promotions.ts exists with different implementation");
}else{
 writeFileSync(helperPath,helper,"utf8");
 console.log("[OK] automatic promo helper installed");
}
