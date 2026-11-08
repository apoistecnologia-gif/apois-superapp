// INV-033 — Atualizar a linha existente com catálogo recém-selecionado.
// Apenas exibição da sacola; o backend continua autoridade do preço do pedido.
// Não altera coupons/promotions nem reprecifica automaticamente sacolas antigas.
import {readFileSync,writeFileSync} from "node:fs";
import {resolve} from "node:path";
const path=resolve(".work/entregas/src/contexts/CartContext.tsx");
let src=readFileSync(path,"utf8");
const MARK="APOIS_CART_CURRENT_CATALOG_LINE_V2";
if(src.includes(MARK)){console.log("[OK] cart price patch already applied");process.exit(0);}
function one(a,b,label){let n=src.split(a).length-1;if(n!==1)throw Error("[FAIL] cart "+label+" "+n);src=src.replace(a,b);}
one('import React, { createContext, useCallback, useContext, useEffect, useState } from "react";',
'import React, { createContext, useCallback, useContext, useEffect, useState } from "react";\nimport { toast } from "sonner";',"sonner");
one(`    setMerchant(merchantData);
    setItems((prev) => {`,
`    // ${MARK}: notify about a catalog change; never claim payment confirmation.
    const previous=items.find(item=>item.lineId===lineId&&item.merchantId===merchantData.id);
    if(previous && (previous.price!==finalUnitPrice || previous.basePrice!==basePrice)){
      toast.info("O preço do item foi atualizado no catálogo. Confira o total antes de confirmar.");
    }
    setMerchant(merchantData);
    setItems((prev) => {`,"price notice");
one(`      if (existingItem) {
        return sameMerchantItems.map((item) =>
          item.lineId === lineId ? { ...item, quantity: item.quantity + 1 } : item,
        );
      }`,
`      if (existingItem) {
        return sameMerchantItems.map((item) =>
          item.lineId === lineId
            ? { ...item, ...newItem, lineId, basePrice, price: finalUnitPrice,
                selectedOptions, quantity: item.quantity + 1 }
            : item,
        );
      }`,"merge refreshed line");
for(const marker of [MARK,'price: finalUnitPrice,','selectedOptions, quantity: item.quantity + 1'])if(!src.includes(marker))throw Error("Cart patch incomplete "+marker);
writeFileSync(path,src,"utf8");
console.log("[OK] INV-033: item selecionado reflete valor atual do catálogo na sacola; preço backend preservado.");
