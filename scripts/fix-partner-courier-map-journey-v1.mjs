import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
const root=resolve(process.env.APOIS_ENTREGAS_WORKSPACE||".work/partner-entregador");
const path=resolve(root,"src/components/CourierRouteMap.tsx");
if(!existsSync(path))throw Error("[FAIL] Courier route map source not found");
const original=readFileSync(path,"utf8");
let s=original;
function change(before,after,label){
 if(s.includes(after))return;
 if(!s.includes(before))throw Error("[FAIL] Map source mismatch: "+label);
 s=s.replace(before,after);
}
change('import { supabase } from "@/integrations/supabase/client";',
 'import { supabase } from "@/integrations/supabase/client";\nimport { Capacitor } from "@capacitor/core";\nimport { Browser } from "@capacitor/browser";',
 'native external navigation');
// Earlier branding hardener renames BRAND_GOLD to APOIS_RED; accept either source.
if(s.includes('const BRAND_GOLD = "#F6BE1C";')) {
 change('const BRAND_GOLD = "#F6BE1C";','const APOIS_RED = "#E51B23";','brand constant');
 s=s.replaceAll("BRAND_GOLD","APOIS_RED");
}
if(!s.includes('const APOIS_RED = "#E51B23";')) throw Error("[FAIL] Canonical APOIS red not found");
change('    if (!targetChanged && moved < 50 && elapsed < 30_000) return;',
 '    if (!targetChanged && (elapsed < 180_000 || moved < 500)) return;',
 'protect Google route quota');
change('        const routesLibrary = (await google.maps.importLibrary("routes")) as any;',
 '        // Live Routes is opt-in while Google Maps billing is under dispute.\n        if ((import.meta as any).env.VITE_APOIS_ENTREGAS_LIVE_ROUTING !== "true") throw new Error("paid routing disabled in homologation");\n        const routesLibrary = (await google.maps.importLibrary("routes")) as any;',
 'fail closed on billable routing');
change(
 'className="absolute bottom-3 left-3 right-3 z-20 rounded-xl border border-amber-500/20 bg-black/90 px-3 py-2 text-center text-[10px] font-bold text-amber-300 backdrop-blur-xl"',
 'className="absolute bottom-3 left-3 right-3 z-20 rounded-xl border border-[#F1B9C1] bg-white/95 px-3 py-2 text-center text-[11px] font-bold text-[#A31A2C] shadow-sm"',
 'light route fallback notice');
change('Trajeto aproximado exibido. Use “Rotas” para orientação curva a curva.',
 'Trajeto aproximado. Toque NAVEGAR para seguir as ruas.',
 'clear external route fallback');
const start=s.indexOf("export function CourierRouteMap(");
if(start<0)throw Error("[FAIL] CourierRouteMap missing");
let prefix=s.slice(0,start), route=s.slice(start);
function routeReplace(before,after,label){
 if(route.includes(after))return;
 if(!route.includes(before))throw Error("[FAIL] Route UI source mismatch: "+label);
 route=route.replace(before,after);
}
routeReplace(
 '  const [metrics, setMetrics] = useState<RouteMetrics>({\n    distanceMeters: Number(job.estimated_distance_meters ?? 0),\n    durationSeconds: Number(job.estimated_duration_seconds ?? 0),\n  });',
 '  // APOIS_COURIER_ROUTE_STAGE_METRICS_V1: do not label old total as remaining distance.\n  const [metrics, setMetrics] = useState<RouteMetrics>({ distanceMeters: 0, durationSeconds: 0 });\n  useEffect(() => { setMetrics({ distanceMeters: 0, durationSeconds: 0 }); }, [job.id, goingToDelivery]);',
 'per-stage real metrics');
const navBegin=route.indexOf("  const openNavigation = () => {"),navEnd=route.indexOf("\n  if (!target) {",navBegin);
if(navBegin<0||navEnd<0)throw Error("[FAIL] navigation handler boundaries");
const nav="  // APOIS_COURIER_MAPS_URL_NO_API_KEY_V1: directions via official Maps URL.\n  // Does not use APOIS Maps Platform credentials or billable Routes API.\n  const openNavigation = () => {\n    if (!target) return;\n    const destination = [target.lat, target.lng].join(\",\");\n    const url = \"https://www.google.com/maps/dir/?api=1&destination=\"\n      + encodeURIComponent(destination)\n      + \"&travelmode=driving&dir_action=navigate\";\n    if (Capacitor.isNativePlatform()) {\n      void Browser.open({ url }).catch(() => {\n        window.open(url, \"_blank\", \"noopener,noreferrer\");\n      });\n    } else {\n      window.open(url, \"_blank\", \"noopener,noreferrer\");\n    }\n  };\n";
if(!route.includes("APOIS_COURIER_MAPS_URL_NO_API_KEY_V1"))
 route=route.slice(0,navBegin)+nav+route.slice(navEnd);
routeReplace('  const expanded = goingToDelivery;','  // The map stays visible; a compact status sheet follows below.','remove oversized map stage');
routeReplace('    <section className="overflow-hidden rounded-[1.9rem] border border-accent/25 bg-black shadow-[0_22px_60px_rgba(0,0,0,0.5)]">',
 '    <section data-apois-courier-route-map className="overflow-hidden rounded-[1.3rem] border border-[#E5E7EB] bg-white text-[#111827] shadow-[0_10px_24px_rgba(17,24,39,0.08)]">',
 'light map wrapper');
routeReplace('className="flex items-center justify-between gap-3 border-b border-accent/15 bg-black/95 p-3"',
 'className="flex items-center justify-between gap-3 border-b border-[#E5E7EB] bg-white p-3"',
 'light map header');
routeReplace('text-[9px] font-black uppercase tracking-[0.18em] text-accent',
 'text-[10px] font-black uppercase tracking-[0.12em] text-[#BC1530]',
 'route heading contrast');
routeReplace('text-xs text-zinc-500','text-xs text-[#596371]','route subtitle contrast');
// Previous mobile styling may have updated the route CTA class in place.
// Match the unique navigation handler, not a brittle old style string.
const navCtas=[...route.matchAll(/onClick=\{openNavigation\}\s+className="([^"]+)"/g)];
if(navCtas.length!==1)throw Error("[FAIL] Courier navigation CTA not uniquely found");
route=route.replace(navCtas[0][0],
  'onClick={openNavigation}\n          className="flex h-11 shrink-0 items-center gap-1.5 rounded-xl bg-[#E90024] px-3 text-xs font-black text-white shadow-md active:scale-95"');
routeReplace('<ExternalLink className="h-4 w-4" /> Rotas',
 '<Navigation className="h-4 w-4" /> NAVEGAR',
 'navigation CTA label');
routeReplace('className="grid grid-cols-2 divide-x divide-zinc-800 border-b border-zinc-900 bg-black"',
 'className="grid grid-cols-2 divide-x divide-[#E5E7EB] border-b border-[#E5E7EB] bg-white"',
 'metrics surface');
routeReplace('text-[9px] font-black uppercase text-zinc-600',
 'text-[10px] font-black uppercase text-[#596371]',
 'metrics label');
routeReplace('text-lg font-black text-white','text-sm font-black text-[#111827]','light metrics value');
routeReplace('text-lg font-black text-primary','text-sm font-black text-[#B91C32]','ETA value');
routeReplace('            {formatDuration(metrics.durationSeconds)}',
 '              {metrics.durationSeconds > 0 ? formatDuration(metrics.durationSeconds) : "Consultar no mapa"}',
 'honest ETA');
// Previous visual hardeners already changed the large map's size and background.
const compactMap = 'className="relative h-[clamp(265px,43dvh,470px)] w-full bg-[#F3F4F6]"';
const earlierCompactMap = 'className="relative h-[clamp(235px,36dvh,375px)] w-full bg-[#F3F4F6]"';
if(!route.includes(compactMap) && !route.includes(earlierCompactMap)) {
 const oldClasses = [
  'className={\x60relative w-full bg-zinc-900 \x24{expanded ? "h-[36rem] min-h-[72vh] max-h-[44rem]" : "h-[29rem] min-h-[62vh] max-h-[36rem]"}\x60}',
  'className={\x60relative w-full bg-[#F3F4F6] \x24{expanded ? "h-[65dvh] min-h-[430px]" : "h-[58dvh] min-h-[390px]"}\x60}'
 ];
 const found=oldClasses.find(oldClass=>route.includes(oldClass));
 if(!found){
   const safeClasses=route.split("\n").filter((line)=>line.includes("className")&&line.includes("bg-")&&line.includes("relative")).slice(0,8).map((line)=>line.trim().slice(0,220));
   throw Error("[FAIL] Courier route map responsive class not recognized; classes="+JSON.stringify(safeClasses));
 }
 route=route.replace(found,compactMap);
}
routeReplace('              colorScheme={ColorScheme.DARK}',
 '              colorScheme={ColorScheme.LIGHT}',
 'light map color');
routeReplace('className="grid h-72 place-items-center px-6 text-center text-sm text-zinc-500"',
 'className="grid h-48 place-items-center px-5 text-center text-sm text-[#596371]"',
 'small map unavailable space');
routeReplace('          Mapa indisponível: configuração do Google Maps não foi carregada.',
 '          O mapa integrado depende da conta Google Maps. Use NAVEGAR para abrir a rota no Google Maps, sem chave de API.',
 'external navigation fallback');
s=prefix+route;
const required=["APOIS_COURIER_MAPS_URL_NO_API_KEY_V1","APOIS_COURIER_ROUTE_STAGE_METRICS_V1","NAVEGAR","ColorScheme.LIGHT","paid routing disabled in homologation"];
for(const marker of required)if(!s.includes(marker))throw Error("[FAIL] Missing map gate: "+marker);
if(s!==original)writeFileSync(path,s,"utf8");
console.log("[OK] Courier maps: compact light map, 2 destinations, external navigation without APOIS API, billing guard");
