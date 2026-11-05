// APOIS_ENTREGAS_REAL_CATALOG_V1
// Customer app only: never delete production customer addresses, products or merchants.
// Remove visibility of identified QA fixtures and require explicit real-address selection.
import {readFileSync,writeFileSync} from "node:fs";
import {resolve} from "node:path";
const root=resolve(process.env.APOIS_ENTREGAS_WORKSPACE||".work/entregas");
const src=(path)=>resolve(root,path);
const read=(path)=>readFileSync(src(path),"utf8");
const save=(path,content)=>writeFileSync(src(path),content,"utf8");
const importAddr='import { isCustomerHomologationAddress } from "@/lib/customer-public-visibility";';
function replaceOnce(source,before,after,label) {
 const count=source.split(before).length-1;
 if(count!==1)throw Error("[FAIL] Entregas live customer "+label+" anchor count "+count);
 return source.replace(before,after);
}
const policy=readFileSync(resolve("scripts/qa/entregas-customer-public-visibility-v1.ts"),"utf8");
if(!policy.includes("APOIS_ENTREGAS_REAL_CATALOG_V1"))throw Error("[FAIL] QA visibility source missing");
save("src/lib/customer-public-visibility.ts",policy);

// The shared catalog is used by home, global search and public merchant details.
{
 const p="src/lib/catalog.ts";let s=read(p);
 s=replaceOnce(s,'import { supabase } from "@/integrations/supabase/client";',
   'import { supabase } from "@/integrations/supabase/client";\nimport { isCustomerHomologationMerchant } from "./customer-public-visibility";',
   "catalog import");
 s=replaceOnce(s,'  if (error) throw error;\n  return data;\n};\n\nexport const fetchMerchantById',
   '  if (error) throw error;\n  return (data ?? []).filter((merchant) => !isCustomerHomologationMerchant(merchant));\n};\n\nexport const fetchMerchantById',
   "filter QA from public catalog");
 s=replaceOnce(s,'  if (error) throw error;\n  return data;\n};\n\nexport const fetchMenuCategoriesByMerchant',
   '  if (error) throw error;\n  return isCustomerHomologationMerchant(data) ? null : data;\n};\n\nexport const fetchMenuCategoriesByMerchant',
   "filter QA from public merchant detail");
 if(!s.includes('eq("is_active", true)')||!s.includes('fetchMerchantCategories'))throw Error("[FAIL] Public catalog contract drift");
 save(p,s);
}
// Home: never present a test address as a delivery address or load merchant data using it.
{
 const p="src/routes/inicio.tsx";let s=read(p);
 s=replaceOnce(s,'import { fetchMerchantCategories, fetchMerchants } from "@/lib/catalog";',
  'import { fetchMerchantCategories, fetchMerchants } from "@/lib/catalog";\n'+importAddr,"home import");
 s=replaceOnce(s,'  const [defaultAddress, setDefaultAddress] = useState<any>(null);',
  '  const [defaultAddress, setDefaultAddress] = useState<any>(null);\n  const [needsRealAddress, setNeedsRealAddress] = useState(false);',
  "home address status");
 s=replaceOnce(s,'      setProfile(profileData);\n      setDefaultAddress(addrData);',
  '      setProfile(profileData);\n      const publicAddress = isCustomerHomologationAddress(addrData) ? null : addrData;\n      setNeedsRealAddress(Boolean(addrData && !publicAddress));\n      setDefaultAddress(publicAddress);',
  "home test address state");
 s=replaceOnce(s,'      if (addrData) {\n        const mers = await fetchMerchants((addrData as any).city, (addrData as any).state);',
  '      if (publicAddress) {\n        const mers = await fetchMerchants((publicAddress as any).city, (publicAddress as any).state);',
  "home fetch only with real address");
 s=replaceOnce(s,'                "Definir endereço de entrega"\n              )}',
  '                needsRealAddress ? "Selecione um endereço real" : "Definir endereço de entrega"\n              )}',
  "home label");
 s=replaceOnce(s,'                  Informe um endereço de entrega para ver os estabelecimentos disponíveis na sua região.',
  '                  {needsRealAddress ? "O endereço anterior era de homologação. Escolha um endereço verdadeiro para consultar estabelecimentos." : "Informe um endereço de entrega para ver os estabelecimentos disponíveis na sua região."}',
  "home informative empty state");
 if(!s.includes('fetchMerchantCategories()')||!s.includes('<AppBottomNav activeTab="inicio"'))throw Error("[FAIL] Home operation lost");
 save(p,s);
}
// Customer search: same location rule; existing product search and categories stay intact.
{
 const p="src/routes/buscar.tsx";let s=read(p);
 s=replaceOnce(s,'import { fetchMerchantCategories, fetchMerchants } from "@/lib/catalog";',
   'import { fetchMerchantCategories, fetchMerchants } from "@/lib/catalog";\n'+importAddr,"search import");
 s=replaceOnce(s,'  const [defaultAddress, setDefaultAddress] = useState<any>(null);',
   '  const [defaultAddress, setDefaultAddress] = useState<any>(null);\n  const [needsRealAddress, setNeedsRealAddress] = useState(false);',
   "search QA state");
 s=replaceOnce(s,'      setDefaultAddress(addrData);',
   '      const publicAddress = isCustomerHomologationAddress(addrData) ? null : addrData;\n      setNeedsRealAddress(Boolean(addrData && !publicAddress));\n      setDefaultAddress(publicAddress);',
   "search discard default QA");
 s=replaceOnce(s,'      if (!addrData) {',
   '      if (!publicAddress) {',
   "search early return if QA");
 s=replaceOnce(s,'      const mers = await fetchMerchants((addrData as any).city, (addrData as any).state);',
   '      const mers = await fetchMerchants((publicAddress as any).city, (publicAddress as any).state);',
   "search real merchant locality");
 s=replaceOnce(s,'                  : "Informe seu endereço"}',
   '                  : needsRealAddress ? "Selecione um endereço real" : "Informe seu endereço"}',
   "search header label");
 const marker='        <form onSubmit={handleSearch} className="group relative">';
 const notice=[
 '        {needsRealAddress ? (',
 '          <div data-apois-entregas-real-address-v1="true" role="alert" className="rounded-2xl border border-[#FECACA] bg-[#FFF1F2] px-4 py-3 text-[#991B1B]">',
 '            <p className="text-sm font-semibold">O endereço de teste não pode ser usado para entrega. Selecione um endereço verdadeiro para consultar estabelecimentos.</p>',
 '            <button type="button" onClick={() => navigate({ to: "/enderecos" })} className="mt-2 min-h-11 rounded-xl bg-[#E51B23] px-4 text-sm font-bold text-white">Selecionar endereço</button>',
 '          </div>',
 '        ) : null}',
 ''
 ].join("\n");
 s=replaceOnce(s,marker,notice+"\n"+marker,"search recovery UI");
 if(!s.includes('filteredMerchants')||!s.includes('matchingProducts'))throw Error("[FAIL] Search results lost");
 save(p,s);
}
// Saved addresses: do not delete QA fixtures, just prevent choosing them for delivery.
{
 const p="src/routes/enderecos.tsx";let s=read(p);
 s=replaceOnce(s,'import { supabase } from "@/integrations/supabase/client";',
   'import { supabase } from "@/integrations/supabase/client";\n'+importAddr,"address list import");
 s=replaceOnce(s,'      const next = (data ?? []) as CustomerAddress[];',
   '      const next = ((data ?? []) as CustomerAddress[]).filter((address) => !isCustomerHomologationAddress(address));',
   "visible saved addresses");
 if(!s.includes('"set_default_customer_address"')||!s.includes('handleConfirmAddress'))throw Error("[FAIL] Saved address selection must remain");
 save(p,s);
}
// Checkout: always reject a test cart, and never quote/order with QA delivery point.
{
 const p="src/routes/checkout.tsx";let s=read(p);
 const marker='import { supabase } from "@/integrations/supabase/client";';
 s=replaceOnce(s,marker,marker+'\nimport { isCustomerHomologationAddress, isCustomerHomologationMerchant } from "@/lib/customer-public-visibility";',"checkout import");
 s=replaceOnce(s,'      if (!disposed && data) setAddress(data as LocalAddressSnapshot);',
   '      if (!disposed) setAddress(data && !isCustomerHomologationAddress(data) ? data as LocalAddressSnapshot : null);',
   "checkout QA address blocked");
 s=replaceOnce(s,'      if (userError || !user)\n        throw new Error("Sua sessão expirou. Entre novamente para finalizar o pedido.");',
   '      if (userError || !user)\n        throw new Error("Sua sessão expirou. Entre novamente para finalizar o pedido.");\n      if (isCustomerHomologationMerchant(merchant)) throw new Error("Este estabelecimento era de homologação e não está disponível para pedidos reais.");\n      if (fulfillmentType === "delivery" && isCustomerHomologationAddress(address)) throw new Error("Selecione um endereço real antes de fazer o pedido.");',
   "checkout no fake cart or address");
 if(!s.includes('"get_order_payment_provider"')||!s.includes('"preview_delivery_quote"'))throw Error("[FAIL] Checkout operation lost");
 save(p,s);
}
console.log("[OK] APOIS Cliente Entregas: QA customer listings + addresses hidden; real account address confirmation, marketplace search, pickup/delivery, checkout and history preserved.");
