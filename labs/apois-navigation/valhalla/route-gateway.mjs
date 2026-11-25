// Local laboratory gateway, never an Internet-facing authenticated service.
// Fixed regional Valhalla contract. No database, access token, user identifier,
// address, raw request/response logging, redirect, or third-party fallback.
import {createServer} from "node:http";
import {pathToFileURL} from "node:url";
const MAX_BODY=4096,MAX_RESPONSE=2_000_000;
const keys=(obj,expected)=>obj!==null&&typeof obj==="object"&&!Array.isArray(obj)&&
  Object.keys(obj).length===expected.length&&expected.every(k=>Object.hasOwn(obj,k));
export function normalizeRoute(body){
  if(!keys(body,["locations","costing","units","language","format","voice_instructions","banner_instructions","shape_format"]))return null;
  if(body.costing!=="auto"||body.units!=="kilometers"||body.language!=="pt-BR"||body.format!=="osrm"||
     body.voice_instructions!==true||body.banner_instructions!==true||body.shape_format!=="polyline6")return null;
  if(!Array.isArray(body.locations)||body.locations.length!==2)return null;
  const points=body.locations;
  if(!points.every(p=>keys(p,["lat","lon","type"])&&p.type==="break"&&
    typeof p.lat==="number"&&Number.isFinite(p.lat)&&p.lat>=-9.65&&p.lat<=-9.10&&
    typeof p.lon==="number"&&Number.isFinite(p.lon)&&p.lon>=-40.80&&p.lon<=-40.20))return null;
  return {locations:points.map(({lat,lon})=>({lat,lon,type:"break"})),costing:"auto",units:"kilometers",
    language:"pt-BR",format:"osrm",voice_instructions:true,banner_instructions:true,shape_format:"polyline6"};
}
export function createBudget({limit=60,parallel=4,now=()=>performance.now()}={}){
  let starts=[],active=0,last=now();
  return {enter(){
    const t=now();
    if(!Number.isFinite(t)||t<last)return null;
    last=t;
    starts=starts.filter(x=>t-x<60_000);
    if(starts.length>=limit||active>=parallel)return null;
    starts.push(t);active++;
    let released=false;
    return ()=>{if(!released){released=true;active--;}};
  }};
}
function reply(res,status,value){
  if(res.destroyed)return;
  const body=JSON.stringify(value);
  res.writeHead(status,{"Content-Type":"application/json; charset=utf-8","Content-Length":Buffer.byteLength(body),
    "Cache-Control":"no-store","Connection":"close","X-Content-Type-Options":"nosniff"});
  res.end(body);
}
export function createRouteGateway({upstreamPort=8002,budget=createBudget(),timeout=10_000,inputTimeout=5000,authorize=null}={}){
  if(!Number.isInteger(inputTimeout)||inputTimeout<50||inputTimeout>5000)throw Error("Invalid local input timeout");
  if(!Number.isInteger(upstreamPort)||upstreamPort<1||upstreamPort>65535)throw Error("Invalid local upstream port");
  const upstream="http://127.0.0.1:"+upstreamPort+"/route";
  const server=createServer({requestTimeout:inputTimeout,headersTimeout:inputTimeout,connectionsCheckingInterval:Math.min(250,inputTimeout),maxHeaderSize:8192},async(req,res)=>{
    if(req.url==="/healthz"&&req.method==="GET"){reply(res,200,{ok:true,scope:"local-lab"});return;}
    if(req.url!=="/route"){reply(res,404,{error:"not_found"});return;}
    if(req.method!=="POST"){reply(res,405,{error:"method_not_allowed"});return;}
    if(req.headers["content-type"]?.split(";")[0].trim().toLowerCase()!=="application/json"){
      reply(res,415,{error:"unsupported_media"});return;
    }
    const len=req.headers["content-length"];
    if(req.headers["transfer-encoding"]||typeof len!=="string"||!/^\d+$/.test(len)){
      reply(res,411,{error:"length_required"});return;
    }
    if(Number(len)<1||Number(len)>MAX_BODY){reply(res,413,{error:"request_size"});return;}
    let body;
    // An absolute body deadline, not a resettable inactivity timer. Never
    // authorize/forward an incomplete or expired body.
    const bodyDeadline=setTimeout(()=>req.destroy(),inputTimeout);
    try{
      const chunks=[];let n=0;
      for await(const chunk of req){n+=chunk.length;if(n>MAX_BODY)throw Error("size");chunks.push(chunk);}
      if(n!==Number(len))throw Error("size");
      body=normalizeRoute(JSON.parse(Buffer.concat(chunks).toString("utf8")));
    }catch{reply(res,400,{error:"invalid_route"});return;}
    finally{clearTimeout(bodyDeadline);}
    if(!body){reply(res,400,{error:"invalid_route"});return;}
    if(res.destroyed)return;
    // Optional verifier is for the isolated authenticated test only. The
    // standalone CLI remains loopback-only synthetic benchmark mode.
    let grant=null;
    if(authorize){
      try{grant=authorize(req.headers.authorization,body);}catch{reply(res,503,{error:"authorization_unavailable"});return;}
      if(grant?.status!==200||typeof grant.release!=="function"){
        const status=[401,403,429,503].includes(grant?.status)?grant.status:503;
        reply(res,status,{error:"route_not_authorized"});return;
      }
    }
    const done=budget.enter();
    if(!done){grant?.release();reply(res,429,{error:"route_budget"});return;}
    const controller=new AbortController();
    const disconnected=()=>controller.abort();
    res.once("close",disconnected);
    const timer=setTimeout(()=>controller.abort(),timeout);
    try{
      const result=await fetch(upstream,{method:"POST",redirect:"error",
        headers:{"Content-Type":"application/json","Accept":"application/json"},
        body:JSON.stringify(body),signal:controller.signal});
      if(!result.ok){await result.body?.cancel();reply(res,502,{error:"route_unavailable"});return;}
      if(Number(result.headers.get("content-length"))>MAX_RESPONSE){
        await result.body?.cancel();reply(res,502,{error:"route_unavailable"});return;
      }
      const chunks=[];let n=0;
      for await(const chunk of result.body){
        n+=chunk.length;if(n>MAX_RESPONSE){controller.abort();throw Error("size");}
        chunks.push(Buffer.from(chunk));
      }
      const data=JSON.parse(Buffer.concat(chunks).toString("utf8"));
      if(data?.code!=="Ok"||!Array.isArray(data.routes)||!data.routes.length)throw Error("contract");
      const payload=JSON.stringify(data);
      if(Buffer.byteLength(payload)>MAX_RESPONSE)throw Error("size");
      reply(res,200,data);
    }catch{reply(res,502,{error:"route_unavailable"});}
    finally{clearTimeout(timer);res.removeListener("close",disconnected);done();grant?.release();}
  });
  server.keepAliveTimeout=1000;
  server.maxConnections=16;
  return server;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const port=Number(process.env.APOIS_LAB_GATEWAY_PORT??"8003");
  if(!Number.isInteger(port)||port<1024||port>65535)throw Error("Invalid local port");
  createRouteGateway().listen(port,"127.0.0.1",()=>console.log("[OK] local routing gateway ready"));
}
