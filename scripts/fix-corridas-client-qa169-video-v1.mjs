// APOIS_CLIENT_QA169_VIDEO_V1 — fixed only in .work/corridas.
import {readFileSync,writeFileSync} from "node:fs";
import {resolve} from "node:path";
const root=resolve(process.env.APOIS_CORRIDAS_WORKSPACE||".work/corridas");
function once(s,a,b,id){const n=s.split(a).length-1;if(n!==1)throw Error("[FAIL] QA169 "+id+" anchors="+n);return s.replace(a,b);}
function change(rel,transform){const file=resolve(root,rel),src=readFileSync(file,"utf8");const result=transform(src);if(src===result)throw Error("[FAIL] QA169 no change "+rel);writeFileSync(file,result,"utf8");}
// Two independent Android bottom safe-area gaps totaling 96px caused excessive spacing.
change("src/components/BottomNavigation.tsx",s=>{
 s=once(s,"pb-[max(44px,env(safe-area-inset-bottom))]","pb-3","navbar");
 if(!s.includes("grid-cols-5")||!s.includes("min-h-[64px]"))throw Error("[FAIL] 5 touch targets");
 return s.replace("export const BottomNavigation =","// APOIS_CLIENT_QA169_VIDEO_V1: safe area is reserved after this nav.\nexport const BottomNavigation =");
});
change("src/routes/_authenticated.tsx",s=>{
 s=once(s,'max(52px, env(safe-area-inset-bottom, 0px))','max(24px, env(safe-area-inset-bottom, 0px))',"system bar");
 if(!s.includes("!hideBottomNavigation ? <BottomNavigation /> : null"))throw Error("[FAIL] fullscreen routes");
 return s.replace("function AuthenticatedLayout() {","// APOIS_CLIENT_QA169_VIDEO_V1: compact Android system bar guard.\nfunction AuthenticatedLayout() {");
});
// Driver image: valid image or genuine placeholder; short-lived signed read is RLS-controlled.
change("src/components/rides/active/DriverCard.tsx",s=>{
 s=once(s,'import React from "react";',
 'import React, {useEffect,useState} from "react";\nimport {supabase} from "@/integrations/supabase/client";\n// APOIS_CLIENT_QA169_VIDEO_V1',"photo imports");
 const photo=[
 '  const [photoUrl,setPhotoUrl]=useState<string|null>(null);',
 '  const [failedUrl,setFailedUrl]=useState<string|null>(null);',
 '  useEffect(()=>{',
 '    let cancelled=false;',
 '    const raw=typeof ride.driver_photo==="string"?ride.driver_photo.trim():"";',
 '    setPhotoUrl(null);setFailedUrl(null);',
 '    if(!raw)return ()=>{cancelled=true;};',
 '    if(/^https:\/\//i.test(raw)){setPhotoUrl(raw);return ()=>{cancelled=true;};}',
 '    const path=raw.replace(/^profile-photos\//i,"");',
 '    if(!/^[A-Za-z0-9_./-]{1,500}$/.test(path)||path.split("/").includes(".."))return ()=>{cancelled=true;};',
 '    void supabase.storage.from("profile-photos").createSignedUrl(path,3600)',
 '      .then(({data,error})=>{if(!cancelled)setPhotoUrl(error?null:data?.signedUrl??null);})',
 '      .catch(()=>{if(!cancelled)setPhotoUrl(null);});',
 '    return ()=>{cancelled=true;};',
 '  },[ride.driver_photo]);'
 ].join("\n");
 s=once(s,"  if (!ride.driver_id && !ride.driver_name) return null;",photo+"\n  if (!ride.driver_id && !ride.driver_name) return null;","photo effect");
 s=once(s,"{ride.driver_photo ? (","{photoUrl && photoUrl !== failedUrl ? (","valid photo");
 s=once(s,"src={ride.driver_photo}","src={photoUrl}\n            onError={() => setFailedUrl(photoUrl)}","photo onError");
 if(!s.includes("<User className="))throw Error("[FAIL] neutral avatar missing");
 return s;
});
// The route remains computed by the existing backend/google maps. We only
// change the in-trip camera target to a position 85m ahead along that route.
change("src/components/map/PassengerMap.tsx",s=>{
 s=once(s,"  isStatic: boolean | undefined;","  isStatic: boolean | undefined;\n  isTrip?: boolean;","map prop");
 s=once(s,"  isStatic = false,","  isStatic = false,\n  isTrip = false,","trip default");
 s=once(s,"  const lastCameraUpdateRef = useRef(0);",
   "  const lastCameraUpdateRef = useRef(0);\n  const tripCameraPointRef = useRef<{lat:number;lng:number;at:number}|null>(null);","trip camera ref");
 const lines=[
 '  // APOIS_CLIENT_QA169_VIDEO_V1: forward route camera on real trip only.',
 '  useEffect(()=>{',
 '    if(!isTrip||isStatic||status!=="ready"||!validDriverLocation){tripCameraPointRef.current=null;return;}',
 '    const p=validDriverLocation;',
 '    const distance=(a:Coordinate,b:Coordinate)=>Math.hypot((a.lat-b.lat)*111320,(a.lng-b.lng)*111320*Math.cos(a.lat*Math.PI/180));',
 '    const old=tripCameraPointRef.current;',
 '    if(old && distance(old,p)<12 && Date.now()-old.at<2500)return;',
 '    const bearing=(a:Coordinate,b:Coordinate)=>{',
 '      const r=Math.PI/180,p1=a.lat*r,p2=b.lat*r,dl=(b.lng-a.lng)*r;',
 '      return (Math.atan2(Math.sin(dl)*Math.cos(p2),Math.cos(p1)*Math.sin(p2)-Math.sin(p1)*Math.cos(p2)*Math.cos(dl))*180/Math.PI+360)%360;',
 '    };',
 '    let pathHeading:number|null=null;',
 '    if(destination && displayedRoutePoints.length>1){',
 '      const path=[...displayedRoutePoints] as Coordinate[];',
 '      if(distance(path[0],destination)<distance(path[path.length-1],destination))path.reverse();',
 '      let near=0,best=Infinity;',
 '      for(let i=0;i<path.length;i++){const d=distance(p,path[i]);if(d<best){best=d;near=i;}}',
 '      if(best<150)for(let i=near+1;i<path.length;i++){',
 '        if(distance(path[near],path[i])>=25){pathHeading=bearing(path[near],path[i]);break;}',
 '      }',
 '    }',
 '    const gps=typeof driverLocation?.heading==="number" && Number.isFinite(driverLocation.heading)',
 '      && driverLocation.heading>=0 && driverLocation.heading<360?driverLocation.heading:null;',
 '    const heading=pathHeading??gps??(destination&&distance(p,destination)>20?bearing(p,destination):null);',
 '    if(heading===null)return;',
 '    const rad=heading*Math.PI/180;',
 '    const ahead:Coordinate={lat:p.lat+Math.cos(rad)*85/111320,',
 '      lng:p.lng+Math.sin(rad)*85/(111320*Math.max(.2,Math.cos(p.lat*Math.PI/180)))};',
 '    tripCameraPointRef.current={...p,at:Date.now()};',
 '    if(nativeModeRef.current){',
 '      void mapService.setCamera(nativeMapIdRef.current,{coordinate:ahead,zoom:16}).catch(()=>undefined);',
 '    }else if(mapRef.current){',
 '      const liveMap=mapRef.current as any,maps=(window as any).google?.maps;',
 '      if(maps?.RenderingType?.VECTOR && liveMap.getRenderingType?.()===maps.RenderingType.VECTOR){',
 '        liveMap.setHeading?.(heading);liveMap.setTilt?.(0);',
 '      }',
 '      liveMap.panTo(ahead);',
 '      if((liveMap.getZoom?.()??0)<15)liveMap.setZoom(16);',
 '    }',
 '  },[isTrip,isStatic,status,validDriverLocation,driverLocation?.heading,displayedRoutePoints,destination]);',
 ''
 ].join("\n");
 s=once(s,"  const retry = () => {",lines+"  const retry = () => {","insert forward camera");
 for(const t of ["displayedRoutePoints","APOIS_PASSENGER_LIVE_FOCUS_V2","mapService.upsertRoutePolyline"])
 if(!s.includes(t))throw Error("[FAIL] route preserved "+t);
 return s;
});
change('src/routes/_authenticated.corrida.$rideId.tsx',s=>{
 s=once(s,'          isStatic={screenState === "completed" || screenState === "cancelled"}',
 '          isTrip={status === "em_viagem"}\n          isStatic={screenState === "completed" || screenState === "cancelled"}',"trip-only view");
 if(!s.includes("setIsCancelDialogOpen(true)")||!s.includes("onClick={handleReturnHome}"))
 throw Error("[FAIL] ride controls");
 return s;
});
console.log("[OK] QA169 Cliente physical video: compact navbar, driver photo fallback, road-forward camera.");
