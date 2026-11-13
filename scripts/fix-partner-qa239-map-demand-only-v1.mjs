// APOIS_PARTNER_QA239_DEMAND_ONLY_V1
// Only the disposable Motorista copy, never protected source or Entregador.
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
const file=resolve(process.env.APOIS_MOTORISTA_WORKSPACE||'.work/partner-motorista','src/routes/motorista.app.tsx');
let s=readFileSync(file,'utf8');
const MARK='APOIS_PARTNER_QA239_DEMAND_ONLY_V1';
if(s.includes(MARK))throw Error('[QA239] duplicate');
function once(old,replacement,label){const n=s.split(old).length-1;if(n!==1)throw Error('[QA239] '+label+' anchors='+n);s=s.replace(old,replacement);}
for(const x of ['APOIS_PARTNER_QA235_ONE_NAVIGATION_V1','APOIS_PARTNER_QA236_PICKUP_PIN_V1','APOIS_DRIVER_DEMAND_ZONES_V1','useApoisOperationalNotification("motorista"'])if(!s.includes(x))throw Error('[QA239] prerequisite '+x);
once('  const [active, setActive] = useState<RideRow | null>(null);','  const [active, setActive] = useState<RideRow | null>(null);\n  // '+MARK+'\n  const [apoisDemandMapOpen,setApoisDemandMapOpen]=useState(false);','map opt-in state');
once('  const [ratingRide, setRatingRide] = useState<RideRow | null>(null);','  const [ratingRide, setRatingRide] = useState<RideRow | null>(null);\n  const showApoisDemandMap=Boolean(apoisDemandMapOpen && online && !active && !incoming && !ratingRide);','idle guard');
once('  const mapRef = useRef<google.maps.Map | null>(null);','  const mapRef = useRef<google.maps.Map | null>(null);\n  useEffect(()=>{if(!showApoisDemandMap)mapRef.current=null;},[showApoisDemandMap]);','stale map ref');
once('  const showDemandZones = Boolean(online && !active && !incoming && !ratingRide &&','  const showDemandZones = Boolean(showApoisDemandMap && online && !active && !incoming && !ratingRide &&','demand poll only when map visible');
const start=s.indexOf('  // Rota da corrida ativa.');
const end=start<0?-1:s.indexOf('  // Voz de navegação',start);
if(start<0||end<=start)throw Error('[QA239] route effect moved');
const prior=s.slice(start,end);
if(!prior.includes('callRoute({ data: { origin: pos, destination: dest } })')||!prior.includes('setPolyline(points)'))throw Error('[QA239] expected route provider missing');
s=s.slice(0,start)+[
'  // QA239: Google Maps/Waze handles all roads, deviation, ETA and turn-by-turn.',
'  // GPS, dispatch, background arrival, PIN and completion remain in APOIS.',
'  useEffect(()=>{',
'    routeRequestEpochRef.current+=1;',
'    routeRefreshRef.current=null;',
'    lastRouteRequestKeyRef.current=null;',
'    setPolyline([]);setLegKm(null);setEtaSeconds(null);',
'  },[active?.id,active?.status]);',
'  void callRoute;',
''].join('\n')+s.slice(end);
// The QA236 screen owns its parent layout; patch only the Google Map element.
// Keep its full operational JSX children, but never instantiate it without opt-in.
const mapTags=[...s.matchAll(/<MovviMap\b/g)];
if(mapTags.length!==1 || s.split("</MovviMap>").length!==2)throw Error("[QA239] exact Google Map instance changed: "+mapTags.length);
s=s.replace("<MovviMap","{showApoisDemandMap && <MovviMap");
s=s.replace("        </MovviMap>",[
'        </MovviMap>}',
'        {!showApoisDemandMap && <div data-apois-economy-map-off="true" className="absolute inset-0 bg-[#0C1221]">',
'          {!active && !incoming && !ratingRide && (',
'            <div className="absolute inset-x-5 top-[23%] mx-auto max-w-sm rounded-3xl border border-white/10 bg-white/[0.06] p-5 text-center text-white shadow-xl">',
'              <p className="text-base font-bold">Mapa econômico</p>',
'              <p className="mt-2 text-xs text-white/70">O mapa só carrega se você solicitar. GPS e corridas permanecem ativos.</p>',
'              {online ? <button type="button" onClick={()=>setApoisDemandMapOpen(true)} data-apois-open-demand-map="true" className="mt-4 min-h-12 w-full rounded-2xl bg-[#E51B23] px-3 text-sm font-bold text-white">Ver regiões de demanda</button>',
'                : <p className="mt-2 text-xs text-white/70">Fique online para ver demanda.</p>}',
'            </div>',
'          )}',
'          {active && <p className="absolute inset-x-4 top-[25%] text-center text-sm font-semibold text-white/70">Navegue pelo Google Maps ou Waze. O APOIS mantém PIN, GPS e finalização.</p>}',
'        </div>}',
'        {showApoisDemandMap && <button type="button" onClick={()=>setApoisDemandMapOpen(false)} aria-label="Ocultar mapa de demanda"',
'          className="absolute right-3 top-[calc(env(safe-area-inset-top)+85px)] z-30 min-h-11 rounded-xl bg-black/85 px-3 text-xs font-bold text-white">Ocultar mapa</button>}'
].join("\n"));

for(const x of [MARK,'{showApoisDemandMap && <MovviMap','data-apois-open-demand-map','showDemandZones && demandZones.map','onStart(pinCode)','onClick={handleComplete}','setPolyline([]);setLegKm(null);setEtaSeconds(null);'])if(!s.includes(x))throw Error('[QA239] postcondition '+x);
if(s.includes('callRoute({ data: { origin: pos, destination: dest } })'))throw Error('[QA239] paid route request survived');
writeFileSync(file,s,'utf8');
console.log('[OK] QA239: Dynamic Maps demand-only with explicit opt-in, no internal Google Routes calls');
