import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

// APOIS_PASSENGER_QA217_NEARBY_V1
// Only anonymous, coarse red dots from the restricted server RPC.
// Never query public.drivers directly, reveal driver IDs or invent markers.
export type NearbyDriverPoint = {lat:number;lng:number};
export type NearbyDriversState = {
  points:NearbyDriverPoint[];
  state:"loading"|"available"|"unavailable";
};
const POLL_MS=60_000;
const coordinate=(lat:unknown,lng:unknown):lat is number =>
  typeof lat==="number" && Number.isFinite(lat) && Math.abs(lat)<=90 &&
  typeof lng==="number" && Number.isFinite(lng) && Math.abs(lng)<=180;
export function useNearbyPassengerDrivers(lat:number|undefined,lng:number|undefined,category:string|undefined) {
  const [result,setResult]=useState<NearbyDriversState>({points:[],state:"loading"});
  useEffect(()=>{
    let active=true;
    setResult({points:[],state:"loading"});
    if(typeof lat!=="number"||typeof lng!=="number"||!coordinate(lat,lng))return ()=>{active=false;};
    const fetchNearby=async()=>{
      if(!navigator.onLine||document.visibilityState!=="visible")return;
      try{
        // Deliberate typed boundary: new SQL RPC is applied in controlled deploy
        // after RLS/security review; production absence means no fake pins.
        const api=supabase as unknown as {rpc:(
          fn:"apois_nearby_driver_presence",
          args:{_lat:number;_lng:number;_category:string|null}
        )=>Promise<{data:unknown;error:{message:string}|null}>};
        const {data,error}=await api.rpc("apois_nearby_driver_presence",{
          _lat:lat,_lng:lng,_category:category||null
        });
        if(!active)return;
        if(error||!Array.isArray(data))throw Error("nearby_unavailable");
        const points=data.slice(0,12).flatMap((item:unknown)=>{
          if(!item||typeof item!=="object")return [];
          const p=item as Record<string,unknown>;
          const la=typeof p["lat"]==="number"?p["lat"]:Number(p["lat"]);
          const ln=typeof p["lng"]==="number"?p["lng"]:Number(p["lng"]);
          return coordinate(la,ln)?[{lat:la,lng:ln}]:[];
        });
        setResult({points,state:"available"});
      }catch{
        if(active)setResult({points:[],state:"unavailable"});
      }
    };
    void fetchNearby();
    const timer=window.setInterval(()=>{void fetchNearby()},POLL_MS);
    const onVisible=()=>{if(document.visibilityState==="visible")void fetchNearby()};
    document.addEventListener("visibilitychange",onVisible);
    return ()=>{active=false;window.clearInterval(timer);document.removeEventListener("visibilitychange",onVisible)};
  },[lat===undefined?undefined:Number(lat.toFixed(3)),
     lng===undefined?undefined:Number(lng.toFixed(3)),category]);
  return result;
}
