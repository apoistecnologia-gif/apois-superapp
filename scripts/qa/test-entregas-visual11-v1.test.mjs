import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";
import {
 patchNew,patchEdit,patchRegister,patchProfile,
} from "../fix-entregas-labels-visual11-v1.mjs";
import {
 patchAddressCard,patchNewNickname,patchEditNickname,patchCatalog,
} from "../fix-entregas-address-catalog-visual11-v1.mjs";
import {patchAutocompleteVisual11} from "../fix-entregas-autocomplete-visual11-v1.mjs";

const root=process.cwd();
const work=resolve(root,process.env.APOIS_ENTREGAS_WORKSPACE||".work/entregas");
const read=rel=>readFileSync(resolve(work,rel),"utf8");

test("CV-031 / VIS-032: form labels identify exactly the existing fields, names and errors preserved",()=>{
 const newForm=read("src/routes/enderecos/novo.tsx");
 const edit=read("src/routes/enderecos/editar/$addressId.tsx");
 const registration=read("src/routes/register.tsx");
 const profile=read("src/routes/perfil/dados-pessoais.tsx");
 for(const [s,patch,marker] of [
  [newForm,patchNew,"APOIS_CV11_NEW_FIELDS_V1"],
  [edit,patchEdit,"APOIS_CV11_EDIT_FIELDS_V1"],
  [registration,patchRegister,"APOIS_CV11_REGISTER_FIELDS_V1"],
  [profile,patchProfile,"APOIS_CV11_PROFILE_FIELDS_V1"],
 ]){assert.ok(s.includes(marker));assert.equal(patch(s),s,"idempotent "+marker)}
 for(const name of ["postal_code","street","number","complement","neighborhood","city","state","reference"]){
  assert.ok(newForm.includes('name="'+name+'"'),"new form preserved "+name);
  assert.ok(edit.includes('htmlFor="apois-address-edit-'+name+'"'));
  assert.ok(edit.includes('id="apois-address-edit-'+name+'"'));
 }
 for(const name of ["fullName","phone","cpf","birthDate","email","password","confirmPassword"]){
  const id="apois-register-"+name;
  assert.ok(registration.includes('id="'+id+'"'));
  assert.ok(registration.includes('aria-invalid={Boolean(fieldError("'+name+'"))}'));
  assert.ok(registration.includes(id+"-error"));
 }
 for(const name of ["full_name","phone","cpf","birth_date","email"]){
  assert.ok(profile.includes('id="apois-profile-'+name+'"'));
 }
 assert.ok(profile.includes('htmlFor={fieldId}'));
 assert.ok(newForm.includes('htmlFor={fieldId}')&&newForm.includes('id={fieldId}'));
});

test("CV-032 / VIS-033: keyboard on address select does not select from nested Edit/Delete",()=>{
 const card=read("src/routes/enderecos.tsx");
 assert.ok(card.includes("APOIS_CV11_ADDRESS_CARD_V1"));
 assert.equal(patchAddressCard(card),card);
 assert.match(card,/role="group"/);
 assert.match(card,/role="button" tabIndex=\{0\}/);
 assert.match(card,/aria-pressed=\{selected\}/);
 const pattern=/onKeyDown=\{\(event\) => \{ if \(event.target !== event.currentTarget\) return; if \(event.key === "Enter" \|\| event.key === " "\) \{ event.preventDefault\(\); setSelectedAddressId\(address.id\); \} \}\}/;
 assert.match(card,pattern);
 const expr=card.match(pattern)?.[0];
 const content=expr.slice("onKeyDown={".length,-1);
 const calls=[];
 const handler=new Function("setSelectedAddressId","address","return "+content)(
  id=>calls.push(id),{id:"A"});
 const target={},inside={};
 for(const key of ["Enter"," ","Tab"]){
  handler({key,target:inside,currentTarget:target,preventDefault(){calls.push("prevent")}});
 }
 assert.deepEqual(calls,[],"inner action target never selects address");
 handler({key:"Tab",target,currentTarget:target,preventDefault(){calls.push("prevent")}});
 assert.deepEqual(calls,[]);
 for(const key of ["Enter"," "]){
  handler({key,target,currentTarget:target,preventDefault(){calls.push("prevent")}});
 }
 assert.deepEqual(calls,["prevent","A","prevent","A"]);
 assert.ok(card.includes("handleDelete(address)"),"deletion confirmation handler preserved");
 assert.ok(card.includes("handleConfirmAddress()"),"server confirmation preserved");
});

test("CV-033/034 / VIS-034/035: selected labels and product-specific action remain under same callbacks",()=>{
 const newForm=read("src/routes/enderecos/novo.tsx");
 const edit=read("src/routes/enderecos/editar/$addressId.tsx");
 const shop=read("src/routes/estabelecimento.$merchantId.tsx");
 assert.equal(patchNewNickname(newForm),newForm);
 assert.equal(patchEditNickname(edit),edit);
 assert.equal(patchCatalog(shop),shop);
 for(const token of [
  'aria-pressed={formData.label === value}',
  'onClick={() => setFormData((previous) => ({ ...previous, label: value }))}',
 ])assert.ok(newForm.includes(token));
 assert.ok(edit.includes('aria-pressed={formData.label === opt}'));
 assert.ok(shop.includes('aria-pressed={activeCategory === "all"}'));
 assert.ok(shop.includes('aria-pressed={activeCategory === cat.id}'));
 assert.ok(shop.includes('Adicionar ou personalizar " + product.name'));
 assert.ok(shop.includes('Preparando " + product.name'));
 assert.equal((shop.match(/handleAddToCart\(product\)/g)||[]).length,1);
 assert.ok(shop.includes("disabled={isCustomizing}"));
});

test("CV-036 / VIS-037: distinguish autocomplete error, empty, loading and stale response with V11",async()=>{
 const source=read("src/components/CustomerLocationAddressSelector.tsx");
 assert.ok(source.includes("APOIS_ADDRESS_ASYNC_V11"));
 assert.ok(source.includes("APOIS_CV11_AUTOCOMPLETE_FEEDBACK_V1"));
 assert.equal(patchAutocompleteVisual11(source),source);
 const start=source.indexOf("  const search = async (value: string) => {");
 const end=source.indexOf("  const selectSuggestion = async (suggestion: Suggestion) => {",start);
 assert.ok(start>0&&end>start);
 let body=source.slice(start,end);
 body=body.replace("(value: string)","(value)");
 const searchRequestRef={current:0};
 const events={query:"",suggestions:[],status:"idle"};
 const waiting=[];
 const invokeMaps=()=>new Promise((resolve,reject)=>waiting.push({resolve,reject}));
 const search=new Function("searchRequestRef","setQuery","setSuggestions","setAutocompleteStatus","invokeMaps","console",
  body+"\nreturn search;")(searchRequestRef,
  x=>{events.query=x;},x=>{events.suggestions=x;},x=>{events.status=x;},invokeMaps,{error:()=>{}});
 await search("ab");
 assert.equal(events.status,"idle");
 const a=search("Primeira");
 const b=search("Segunda");
 assert.equal(events.status,"loading");
 waiting[1].resolve({predictions:[]});
 await b;
 assert.equal(events.status,"empty");
 waiting[0].resolve({predictions:[{place_id:"stale"}]});
 await a;
 assert.deepEqual(events.suggestions,[]);
 assert.equal(events.status,"empty","stale response does not replace newer empty result");
 const c=search("Nova busca");
 waiting[2].reject(Error("offline"));
 await c;
 assert.equal(events.status,"error");
 const d=search("Nova busca");
 waiting[3].resolve({predictions:[{place_id:"valid"}]});
 await d;
 assert.equal(events.status,"ready");
 assert.deepEqual(events.suggestions,[{place_id:"valid"}]);
 assert.ok(source.includes("Tentar novamente"));
 assert.ok(source.includes("Nenhum endereço encontrado"));
 assert.ok(source.includes("Usar minha localização atual"));
});

test("CV-038 / VIS-039: address is not truncated; no modifications to persistence",()=>{
 const address=read("src/routes/enderecos.tsx");
 assert.ok(address.includes("data-apois-cv11-address-street"));
 assert.ok(address.includes("break-words text-sm font-semibold"));
 assert.ok(address.includes("break-words text-xs text-zinc-500"));
 assert.ok(!address.includes('<p className="mt-2 truncate text-sm font-semibold">'));
 assert.ok(address.includes("handleConfirmAddress()"));
});

test("RV-11: source lock and build order retained",()=>{
 const lock=JSON.parse(readFileSync(resolve(root,".apois/source-lock.json"),"utf8"));
 assert.equal(lock.sources.entregas.commit,"2f4606e0fb52dffb49f2e6aebbe921ce687ab625");
 const customer=readFileSync(resolve(root,"scripts/build-isolated-module.mjs"),"utf8");
 const merchant=readFileSync(resolve(root,"scripts/build-merchant-panel.mjs"),"utf8");
 for(const script of ["fix-entregas-labels-visual11-v1.mjs",
  "fix-entregas-address-catalog-visual11-v1.mjs",
  "fix-entregas-autocomplete-visual11-v1.mjs"]) {
  assert.ok(customer.includes(script)&&merchant.includes(script));
  assert.ok(customer.indexOf(script)>customer.indexOf("fix-entregas-product-customization-visual10-v1.mjs"));
  assert.ok(merchant.indexOf(script)>merchant.indexOf("fix-entregas-product-customization-visual10-v1.mjs"));
 }
});
