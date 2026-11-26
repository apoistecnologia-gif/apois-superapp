// Isolated laboratory only. Loopback, ephemeral bearer, no database or real ride authority.
import {createRouteGateway,createBudget} from "../valhalla/route-gateway.mjs";
import {timingSafeEqual} from "node:crypto";
export const contains=(lat,lon)=>Number.isFinite(lat)&&Number.isFinite(lon)&&lat>=-7.75&&lat<=-6.85&&lon>=-41.85&&lon<=-41.15;
export function pilotGateway(secret,upstreamPort=8002){
  if(typeof secret!=="string"||!/^[a-f0-9]{64}$/.test(secret))throw Error("invalid lab secret");
  const expected=Buffer.from("Bearer "+secret);
  return createRouteGateway({upstreamPort,contains,budget:createBudget({limit:30,parallel:2}),authorize:async header=>{
    const actual=Buffer.from(typeof header==="string"?header:"");
    if(actual.length!==expected.length||!timingSafeEqual(actual,expected))return {status:401};
    return {status:200,release(){}};
  }});
}
if(process.env.APOIS_FIELD_DYNAMIC_RUN==="1"){
  const server=pilotGateway(process.env.APOIS_FIELD_DYNAMIC_SECRET);
  server.listen(8003,"127.0.0.1",()=>console.log("Field dynamic gateway ready on loopback"));
}
