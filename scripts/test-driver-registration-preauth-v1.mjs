// APOIS Partner isolated runtime guard: 12 vehicle photos must be validated
// BEFORE the Auth account is created. Does not contact Supabase or upload files.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const file=readFileSync(".work/partner-motorista/src/lib/driverRegistration.mobile.ts","utf8");
assert.match(file,/APOIS_DRIVER_INSPECTION_PREFLIGHT_BEFORE_AUTH_V1/);
const clean=file
  .replace(/^import .*$/gm,"")
  .replace(/^export type /gm,"type ")
  .replace(/^export async function cadastrarMotoristaMobile/m,"async function cadastrarMotoristaMobile");
const compiled=new Bun.Transpiler({loader:"ts",target:"browser"}).transformSync(clean);
let authCalls=0;
const context={
  supabase:{auth:{
    async signUp(){authCalls++;throw new Error("AUTH_SENTINEL");},
    async signInWithPassword(){authCalls++;throw new Error("AUTH_SENTINEL");},
  }},
  isValidCpf:()=>true, normalizeCpf:(v)=>v,
  window:{atob:()=>{throw new Error("UPLOAD_OR_DECODE_NOT_EXPECTED");}},
  Uint8Array,Date,Error,console,Number,String,Math,Array,Object,Set,
};
vm.runInNewContext(compiled+"\nthis.cadastrarMotoristaMobile=cadastrarMotoristaMobile;",context,{
  filename:"driverRegistration.mobile.ts"
});
const register=context.cadastrarMotoristaMobile;
assert.equal(typeof register,"function");
const slots=["right","left","dashboard","front_seats","rear_seats",
  "tire_fl","tire_fr","tire_rl","tire_rr","belt_front","belt_rear","headlights_on"];
const validPhotos=slots.map(label=>({
  bucket:"apois-inspections",label,base64:"/9j/fixture",contentType:"image/jpeg",fileName:label+".jpg"
}));
const base={cpf:"00000000000",birth_date:"1990-01-01",
  email:"qa@example.invalid",password:"no-real-password",category:"carros",
  documents:[],inspection_photos:validPhotos};
let passed=0;
async function check(label,data,shouldAuth){
  authCalls=0;
  try{
    await register({...base,...data});
    assert.fail("Expected pre-auth rejection or auth probe");
  }catch(e){
    if(shouldAuth)assert.match(String(e.message),/AUTH_SENTINEL/);
    else assert.match(String(e.message),/Vistoria fotográfica incompleta ou com fotos repetidas/);
  }
  assert.equal(authCalls,shouldAuth?1:0,"Wrong auth side effect "+label);
  console.log("[OK] "+label);
  passed++;
}
await check("Missing photos blocks account creation",{inspection_photos:[]},false);
await check("One missing mandatory slot blocks account creation",
  {inspection_photos:validPhotos.slice(0,11)},false);
await check("Duplicate slot blocks account creation",
  {inspection_photos:[...validPhotos.slice(0,11),validPhotos[0]]},false);
await check("Wrong private bucket blocks account creation",
  {inspection_photos:validPhotos.map((x,i)=>i===0?{...x,bucket:"driver-cnh"}:x)},false);
await check("Empty photo payload blocks account creation",
  {inspection_photos:validPhotos.map((x,i)=>i===0?{...x,base64:""}:x)},false);
await check("Complete set proceeds to Auth without performing uploads",{},true);
await check("Non-car category does not require vehicle inspection",
  {category:"motos",inspection_photos:[]},true);
console.log("[PASS] "+passed+" runtime pre-Auth vehicle photo cases; no account creation or uploads.");
