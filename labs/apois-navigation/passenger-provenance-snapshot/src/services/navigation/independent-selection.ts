// Opt-in experimental client, intentionally NOT mounted or imported by ride UI.
// All positions come from a trusted independent catalog response; no Google
// object, coordinate, source label, auth ID, or ride ID accepted as input.
export type CatalogRef = Readonly<{id:string;version:number}>;
type Point = Readonly<{lat:number;lng:number;label:string}>;
export type ConfirmedIndependentSelection = Readonly<{
  selectionId:string;requestKey:string;expiresAt:string;origin:Point;destination:Point;
}>;
type Transport = (body:Readonly<{requestKey:string;pickup:CatalogRef;destination:CatalogRef;confirmed:true}>,signal?:AbortSignal)=>Promise<unknown>;
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const id=(v:unknown):v is string=>typeof v==="string"&&uuid.test(v);
const record=(v:unknown):v is Record<string,unknown>=>v!==null&&typeof v==="object"&&!Array.isArray(v);
const exact=(v:unknown,fields:string[]):v is Record<string,unknown>=>record(v)&&Object.keys(v).length===fields.length&&fields.every(k=>Object.hasOwn(v,k));
function ref(v:unknown):CatalogRef|null{
  if(!exact(v,["id","version"])||!id(v["id"])||typeof v["version"]!=="number"||!Number.isSafeInteger(v["version"])||v["version"]<1||v["version"]>2147483647)return null;
  return Object.freeze({id:v["id"],version:v["version"]});
}
function point(v:unknown):Point|null{
  if(!exact(v,["lat","lng","label"]))return null;
  const lat=v["lat"],lng=v["lng"],label=v["label"];
  if(typeof lat!=="number"||!Number.isFinite(lat)||lat< -9.65||lat> -9.10||typeof lng!=="number"||!Number.isFinite(lng)||lng< -40.80||lng> -40.20||typeof label!=="string"||!label.trim()||label.length>120)return null;
  return Object.freeze({lat,lng,label});
}
export async function confirmIndependentSelection(input:unknown,transport:Transport,signal?:AbortSignal,now=()=>Date.now()):Promise<ConfirmedIndependentSelection|null>{
  if(!exact(input,["requestKey","pickup","destination","confirmed"])||!id(input["requestKey"])||input["confirmed"]!==true||signal?.aborted)return null;
  const pickup=ref(input["pickup"]),destination=ref(input["destination"]),requestKey=input["requestKey"];
  if(!pickup||!destination||pickup.id===destination.id)return null;
  try{
    const response=await transport(Object.freeze({requestKey,pickup,destination,confirmed:true}),signal);
    if(signal?.aborted||!exact(response,["selectionId","requestKey","expiresAt","origin","destination"])||!id(response["selectionId"])||response["requestKey"]!==requestKey||typeof response["expiresAt"]!=="string")return null;
    const expiry=Date.parse(response["expiresAt"]),t=now();
    if(!Number.isFinite(t)||!Number.isFinite(expiry)||expiry<=t||expiry-t>300000)return null;
    const origin=point(response["origin"]),target=point(response["destination"]);
    if(!origin||!target||(origin.lat===target.lat&&origin.lng===target.lng))return null;
    return Object.freeze({selectionId:response["selectionId"],requestKey,expiresAt:response["expiresAt"],origin,destination:target});
  }catch{return null;}
}
