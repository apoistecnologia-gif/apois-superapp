// RV11 CV-032/033/034/035/039 — presentational changes, Entregas .work only.
import { readFileSync,writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
export const ADDRESS_MARK="APOIS_CV11_ADDRESS_CARD_V1";
export const CATALOG_MARK="APOIS_CV11_CATALOG_V1";
function once(s,a,b,name){const n=s.split(a).length-1;if(n!==1)throw Error("[RV11] "+name+": "+n+" anchors");return s.replace(a,b)}
export function patchAddressCard(s){
 if(s.includes(ADDRESS_MARK)){
  for(const v of ['role="group"','aria-pressed={selected}','data-apois-cv11-address-street'])if(!s.includes(v))throw Error("[RV11] partial address card "+v);
  return s;
 }
 s=once(s,
'                  role="button"\n                  tabIndex={0}\n                  onClick={() => setSelectedAddressId(address.id)}\n                  onKeyDown={(event) => {\n                    if (event.key === "Enter" || event.key === " ") setSelectedAddressId(address.id);\n                  }}',
'                  role="group"\n                  aria-label={"Endereço " + address.label}\n                  data-apois-cv11="APOIS_CV11_ADDRESS_CARD_V1"',
"old card keyboard selector");
 s=once(s,
'                  <div className="flex gap-3">\n                    <div className="grid h-11',
'                  <button type="button" onClick={() => setSelectedAddressId(address.id)}\n                    aria-pressed={selected}\n                    aria-label={"Selecionar " + address.label + ": " + address.street + ", " + address.number + ", " + address.neighborhood + ", " + address.city + "/" + address.state}\n                    className="flex min-h-11 w-full gap-3 text-left focus-visible:rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">\n                    <div className="grid h-11',
"native selection separate from Edit/Delete");
 s=once(s,
'                    </div>\n                  </div>\n\n                  {!located ? (',
'                    </div>\n                  </button>\n\n                  {!located ? (',
"native button closes before nested buttons");
 // CV-038 in RV11 is theme risk; CV-039: remove only the two visible truncations.
 // Full text remains within normal card flow. Await real narrow-screen measurement.
 s=once(s,'<p className="mt-2 truncate text-sm font-semibold">',
'<p data-apois-cv11-address-street className="mt-2 break-words text-sm font-semibold">',"full street");
 s=once(s,'<p className="truncate text-xs text-zinc-500">',
'<p className="break-words text-xs text-zinc-500">',"full city");
 return s;
}
export function patchNewNickname(s){
 if(s.includes("APOIS_CV11_NEW_NICKNAME_V1"))return s;
 return once(s,
 '                  onClick={() => setFormData((previous) => ({ ...previous, label: value }))}',
 '                  onClick={() => setFormData((previous) => ({ ...previous, label: value }))}\n                  aria-pressed={formData.label === value}\n                  data-apois-cv11="APOIS_CV11_NEW_NICKNAME_V1"',
 "new nickname active");
}
export function patchEditNickname(s){
 if(s.includes("APOIS_CV11_EDIT_NICKNAME_V1"))return s;
 return once(s,
 '                  onClick={() => setFormData((prev) => ({ ...prev, label: opt }))}',
 '                  onClick={() => setFormData((prev) => ({ ...prev, label: opt }))}\n                  aria-pressed={formData.label === opt}\n                  data-apois-cv11="APOIS_CV11_EDIT_NICKNAME_V1"',
 "edit nickname active");
}
export function patchCatalog(s){
 if(s.includes(CATALOG_MARK)){
  for(const v of ['aria-pressed={activeCategory === "all"}','aria-pressed={activeCategory === cat.id}','Adicionar ou personalizar'])if(!s.includes(v))throw Error("[RV11] incomplete catalog "+v);
  return s;
 }
 s=once(s,'onClick={() => setActiveCategory("all")}',
 'onClick={() => setActiveCategory("all")}\n            aria-pressed={activeCategory === "all"}',"all active");
 s=once(s,'onClick={() => setActiveCategory(cat.id)}',
 'onClick={() => setActiveCategory(cat.id)}\n              aria-pressed={activeCategory === cat.id}',"category active");
 s=once(s,
 'onClick={() => !isCustomizing && handleAddToCart(product)}\n                       disabled={isCustomizing}',
 'onClick={() => !isCustomizing && handleAddToCart(product)}\n                       disabled={isCustomizing}\n                       aria-label={isCustomizing ? "Preparando " + product.name : "Adicionar ou personalizar " + product.name}\n                       data-apois-cv11="APOIS_CV11_CATALOG_V1"',
 "product-specific action");
 return s;
}
const specs=[
["src/routes/enderecos.tsx",patchAddressCard],
["src/routes/enderecos/novo.tsx",patchNewNickname],
["src/routes/enderecos/editar/$addressId.tsx",patchEditNickname],
["src/routes/estabelecimento.$merchantId.tsx",patchCatalog]
];
export function applyVisual11AddressCatalog(root=process.cwd()){
 const dir=resolve(root,process.env.APOIS_ENTREGAS_WORKSPACE||".work/entregas");
 const result=specs.map(([rel,fn])=>{
  const path=resolve(dir,rel),old=readFileSync(path,"utf8"),updated=fn(old);
  return {rel,path,old,updated};
 });
 for(const row of result)if(row.old!==row.updated)writeFileSync(row.path,row.updated,"utf8");
 return result.filter(x=>x.old!==x.updated).map(x=>x.rel);
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===resolve(process.argv[1])){
 console.log("[OK] RV11 address/catalog",applyVisual11AddressCatalog().join(",")||"already applied");
}
