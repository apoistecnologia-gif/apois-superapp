import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...corsHeaders,"Content-Type":"application/json"}});

function rec(v: unknown): Record<string, unknown> { return v && typeof v==="object" && !Array.isArray(v) ? v as Record<string,unknown> : {}; }
function num(v: unknown){ const n=Number(String(v??"").replace(",",".")); return Number.isFinite(n)&&n>0?n:0; }
function yes(v: unknown){ return v===true||["sim","yes","true","1"].includes(String(v??"").trim().toLowerCase()); }
function rounded(v:number){ return Math.round(v*100)/100; }

function fare(category:string,distanceKm:number,durationMin:number,tariff:Record<string,number>,serviceDetails?:unknown){
  const baseRaw=(category==="guincho"?(tariff.call_out_fee??tariff.base_fare??0):(tariff.base_fare??0))+(tariff.per_km??0)*Math.max(0,distanceKm)+(tariff.per_min??0)*Math.max(0,durationMin);
  const base=Math.max(tariff.min_fare??0,baseRaw);
  const d=rec(serviceDetails); const extras:Record<string,number>={}; const add=(k:string,a:number)=>{if(Number.isFinite(a)&&a>0)extras[k]=rounded(a);};
  if(category==="fretes"){
    if(d.ajudantes==="um")add("1 ajudante",tariff.helper1_fee??0);
    if(d.ajudantes==="dois")add("2 ajudantes",tariff.helper2_fee??0);
    if(yes(d.itemPesado))add("Item pesado",tariff.heavy_furniture_fee??0);
    if(yes(d.desmontar))add("Montagem/desmontagem",tariff.assembly_fee??0);
    if(yes(d.embalar))add("Embalagem",tariff.packing_fee??0);
  }
  if(category==="guincho"){
    if(["utilitario","caminhonete"].includes(String(d.tipoVeiculo)))add("Veículo pesado",tariff.heavy_vehicle_fee??0);
    if(yes(d.dificilAcesso))add("Acesso difícil",tariff.difficult_access_fee??0);
    if(yes(d.acidente))add("Veículo acidentado",tariff.accident_fee??0);
    if(yes(d.precisaPlataforma))add("Plataforma",tariff.platform_fee??0);
    if(yes(d.rodasTravadas))add("Rodas travadas",tariff.locked_wheels_fee??0);
    if(yes(d.garagemSubsolo))add("Garagem/subsolo",tariff.garage_fee??0);
  }
  if(category==="envios"){ const weight=num(d.weightKg); const max=tariff.max_weight_kg??0; if(max>0&&weight>max)throw new Error("Peso acima do máximo permitido."); add("Peso",weight*(tariff.per_kg??0)); }
  return {base:rounded(base),extras,total:rounded(base+Object.values(extras).reduce((a,b)=>a+b,0))};
}

Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:corsHeaders});
  if(req.method!=="POST")return json({error:"Método não permitido"},405);
  try{
    const url=Deno.env.get("SUPABASE_URL")??"", anon=Deno.env.get("SUPABASE_ANON_KEY")??"", auth=req.headers.get("authorization")??"";
    const client=createClient(url,anon,{global:{headers:{Authorization:auth}}});
    const {data:{user},error:authError}=await client.auth.getUser();
    if(authError||!user)return json({error:"Unauthorized"},401);
    const admin=createClient(url,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")??"");
    const input=await req.json(); const distanceMeters=Number(input?.distanceMeters),durationSeconds=Number(input?.durationSeconds);
    if(!Number.isFinite(distanceMeters)||!Number.isFinite(durationSeconds))return json({error:"Distância ou duração inválida"},400);
    const [{data:categories,error:catError},{data:rules,error:ruleError}]=await Promise.all([
      admin.from("ride_categories").select("id,code,name").eq("is_active",true),
      admin.from("tariff_rules").select("*"),
    ]);
    if(catError)throw catError; if(ruleError)throw ruleError;
    const estimates=(categories??[]).filter((cat:any)=>!input.categoryIds||input.categoryIds.includes(cat.id)).map((cat:any)=>{
      const catRules=(rules??[]).filter((r:any)=>r.category_id===cat.id||r.category_key===cat.code);
      if(!catRules.length)return{categoryId:cat.id,available:false,unavailableReason:"Sem regras de tarifa"};
      const tariff:Record<string,number>={}; for(const r of catRules)tariff[r.field_key]=Number(r.value);
      try{const b=fare(cat.code,distanceMeters/1000,durationSeconds/60,tariff,input.serviceDetails);return{categoryId:cat.id,categoryCode:cat.code,available:true,estimatedPrice:b.total,basePrice:b.base,extras:b.extras,currency:"BRL"};}
      catch(e){return{categoryId:cat.id,available:false,unavailableReason:e instanceof Error?e.message:"Tarifa indisponível"};}
    });
    return json({ok:true,estimates,pricingVersion:"v2-edge"});
  }catch(error){console.error("[passenger-pricing-estimate]",error instanceof Error?error.message:"unknown");return json({error:"Não foi possível calcular a estimativa agora."},500);}
});