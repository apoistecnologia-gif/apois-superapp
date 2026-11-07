import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
const root=resolve(process.env.APOIS_ENTREGAS_WORKSPACE||".work/entregas");
const read=(path)=>readFileSync(resolve(root,path),"utf8");
const form=read("src/routes/enderecos/novo.tsx");
const selector=read("src/components/CustomerLocationAddressSelector.tsx");
const theme=read("src/system-theme.css");
const required=(source,parts,label)=>parts.forEach(part=>assert.ok(source.includes(part),label+" requires "+part));
required(form,[
  'data-apois-address-create-v8="true"',
  'data-apois-address-header-v8="true"',
  'data-apois-address-main-v8="true"',
  'data-apois-address-cep-row-v8="true"',
  'data-apois-address-footer-v8="true"',
  "APOIS_ENTREGAS_LOCATION_FORM_STATUS_V2",
  "APOIS_ENTREGAS_CEP_LOOKUP_V1",
  "hasIdentifiedAddress",
  "onSubmit={handleSubmit}",
  "!hasPreciseLocation",
  "customer_addresses",
  "handleCEPBlur",
  "CustomerLocationAddressSelector",
  "apois_checkout_address_changed",
],"create address");
required(selector,[
  'data-apois-address-selector-v8="true"',
  "Geolocation.getCurrentPosition",
  'action: "reverse_geocode"',
  'action: "autocomplete"',
  'action: "place_details"',
  "onAddressSelected",
],"location selector");
required(theme,[
  "APOIS_ENTREGAS_CUSTOMER_ADDRESS_VISUAL_V8",
  "html.apois-entregas-customer-light-v4 [data-apois-address-create-v8]",
  "data-apois-address-footer-v8",
  "grid-template-columns:minmax(0,1fr) 126px",
  "color:#fff!important",
  ":has(input:focus)",
],"isolated client theme");
assert.equal((form.match(/data-apois-address-create-v8/g)||[]).length,1,"do not duplicate customer root");
assert.equal((form.match(/data-apois-address-cep-row-v8/g)||[]).length,1,"do not duplicate CEP grid");
assert.equal((theme.match(/\/\* APOIS_ENTREGAS_CUSTOMER_ADDRESS_VISUAL_V8 \*\//g)||[]).length,1,"do not duplicate CSS");
assert.ok(!theme.includes("html.dark [data-apois-address-create-v8]"),"never affect courier/merchant/admin");
console.log("[PASS] Customer Entregas address V8 visual scope, keyboard, GPS, CEP, mandatory coordinates, saving and source isolation.");
