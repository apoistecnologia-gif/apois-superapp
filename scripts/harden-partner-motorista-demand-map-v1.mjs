import {readFileSync,writeFileSync} from "node:fs";
import {resolve} from "node:path";
const file=resolve(process.env.APOIS_MOTORISTA_WORKSPACE||".work/partner-motorista","src/routes/motorista.app.tsx");
let src=readFileSync(file,"utf8");
if(src.includes("APOIS_DRIVER_DEMAND_ZONES_V1")){console.log("[OK] Demand map already patched");process.exit(0);}
function rep(before,after,name){
  if(src.split(before).length!==2)throw Error("[FAIL] Driver demand source moved: "+name);
  src=src.replace(before,after);
}
rep('import { Marker, Polyline } from "@react-google-maps/api";',
'import { Marker, Polyline, OverlayView } from "@react-google-maps/api";',"maps import");
rep('  const [polyline, setPolyline] = useState<LatLng[]>([]);',[
'  // APOIS_DRIVER_DEMAND_ZONES_V1: only anonymous aggregated zones; no passenger identity.',
'  const [demandZones,setDemandZones]=useState<Array<{lat:number;lng:number;level:"moderada"|"alta"|"muito_alta"}>>([]);',
'  const [polyline, setPolyline] = useState<LatLng[]>([]);'
].join("\n"),"zone state");
rep('  useDriverBroadcast(userId, online && (!featureStatusBlock || Boolean(active)), position);',[
'  useDriverBroadcast(userId, online && (!featureStatusBlock || Boolean(active)), position);',
'  // QA218: only aggregated opt-in groups; GPS from authenticated driver.',
'  const showDemandZones = Boolean(online && !active && !incoming && !ratingRide &&',
'    position && Number.isFinite(position.lat) && Number.isFinite(position.lng));',
'  useEffect(() => {',
'    let disposed=false;',
'    if(!showDemandZones){setDemandZones([]);return;}',
'    const refreshDemand = async () => {',
'      try {',
'        // QA218: preservar zonas de pedidos e somar somente grupos consentidos.',
'        const [requests,passengers]=await Promise.all([',
'          (supabase as any).rpc("apois_get_driver_demand_zones"),',
'          (supabase as any).rpc("apois_driver_passenger_hotspots"),',
'        ]);',
'        if(disposed)return;',
'        const requestZones=!requests.error && Array.isArray(requests.data) ? requests.data : [];',
'        const optInZones=!passengers.error && Array.isArray(passengers.data) ? passengers.data : [];',
'        const zones=[...requestZones,...optInZones].filter((zone:any)=>zone && Number.isFinite(zone.lat) &&',
'          Number.isFinite(zone.lng) && zone.lat>=-35 && zone.lat<=6 &&',
'          zone.lng>=-75 && zone.lng<=-30 &&',
'          ["moderada","alta","muito_alta"].includes(zone.level)).slice(0,8);',
'        setDemandZones(zones);',
'      } catch { if(!disposed)setDemandZones([]); }',
'    };',
'    void refreshDemand();',
'    const timer=window.setInterval(()=>{if(navigator.onLine)void refreshDemand();},30_000);',
'    return()=>{disposed=true;window.clearInterval(timer);};',
'  },[showDemandZones]);'
].join("\n"),"load-on-idle");
rep('          {active && (\n            <>\n              <PlacePinMarker',[
'          {/* Demand zones: fixed 2.7 km cells, 3+ recent requests; never individual clients. */}',
'          {showDemandZones && demandZones.map((zone,index)=>(',
'            <OverlayView key={"apois-demand-"+zone.lat+"-"+zone.lng+"-"+index}',
'              position={{lat:zone.lat,lng:zone.lng}} mapPaneName={OverlayView.OVERLAY_LAYER}>',
'              <div data-apois-demand-zone-v1="aggregated" aria-hidden="true"',
'                className="pointer-events-none relative -translate-x-1/2 -translate-y-1/2"',
'                style={{width:zone.level==="muito_alta"?23:zone.level==="alta"?19:15,',
'                        height:zone.level==="muito_alta"?23:zone.level==="alta"?19:15}}>',
'                <span className="absolute inset-0 animate-ping rounded-full opacity-35"',
'                  style={{backgroundColor:zone.level==="muito_alta"?"#B91C1C":zone.level==="alta"?"#EA0029":"#F87171"}} />',
'                <span className="absolute inset-[2px] rounded-full border-2 border-white shadow-[0_0_0_3px_rgba(185,28,28,0.22)]"',
'                  style={{backgroundColor:zone.level==="muito_alta"?"#B91C1C":zone.level==="alta"?"#EA0029":"#F87171"}} />',
'              </div>',
'            </OverlayView>',
'          ))}',
'          {active && (',
'            <>',
'              <PlacePinMarker'
].join("\n"),"map overlay");
for(const marker of ["APOIS_DRIVER_DEMAND_ZONES_V1",'rpc("apois_get_driver_demand_zones")','rpc("apois_driver_passenger_hotspots")',"showDemandZones && demandZones.map","OverlayView.OVERLAY_LAYER","window.clearInterval(timer)"])if(!src.includes(marker))throw Error("Marker missing: "+marker);
writeFileSync(file,src,"utf8");
console.log("[OK] Motorista: anonymous pulsing demand areas in ONLINE idle map; no client data or mock points");
