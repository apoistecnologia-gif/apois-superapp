// Isolated laboratory only. Loopback, ephemeral bearer, no database or real ride authority.
import {createRouteGateway,createBudget} from "../valhalla/route-gateway.mjs";
import {timingSafeEqual} from "node:crypto";
import {readFileSync} from "node:fs";
export const contains=(lat,lon)=>Number.isFinite(lat)&&Number.isFinite(lon)&&lat>=-7.75&&lat<=-6.85&&lon>=-41.85&&lon<=-41.15;
export function pilotGateway(secret,upstreamPort=8002,{expiresAt=Date.now()+900_000,now=()=>Date.now()}={}){
  const began=now();
  if(!Number.isSafeInteger(began)||!Number.isSafeInteger(expiresAt)||expiresAt<=began||expiresAt-began>900_000)throw Error("invalid lab expiry");
  let last=began;
  if(typeof secret!=="string"||!/^[a-f0-9]{64}$/.test(secret))throw Error("invalid lab secret");
  const expected=Buffer.from("Bearer "+secret);
  return createRouteGateway({upstreamPort,contains,budget:createBudget({limit:30,parallel:2}),authorize:async header=>{
    const t=now();
    if(!Number.isSafeInteger(t)||t<last){last=expiresAt;return {status:401};}
    last=t;
    if(t>=expiresAt)return {status:401};
    const actual=Buffer.from(typeof header==="string"?header:"");
    if(actual.length!==expected.length||!timingSafeEqual(actual,expected))return {status:401};
    return {status:200,release(){}};
  }});
}
if(process.env.APOIS_FIELD_DYNAMIC_RUN==="1"){
  const file=process.env.APOIS_FIELD_DYNAMIC_SECRET_FILE;
  const secret=file?readFileSync(file,"utf8").trim():process.env.APOIS_FIELD_DYNAMIC_SECRET;
  const expiry=process.env.APOIS_FIELD_DYNAMIC_EXPIRES_AT;
  if(file&&!expiry)throw Error("explicit expiry required for file credential");
  const server=pilotGateway(secret,8002,expiry?{expiresAt:Number(expiry)}:{});
  server.listen(8003,"127.0.0.1",()=>console.log("Field dynamic gateway ready on loopback"));
}
