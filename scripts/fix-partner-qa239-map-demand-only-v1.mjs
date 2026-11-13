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
once('      {/* MAPA */}\n      <div className="absolute inset-0">\n        <MovviMap','      {/* QA239 demand-only, explicit Dynamic Maps load. */}\n      {showApoisDemandMap ? <div className="absolute inset-0" data-apois-demand-map-visible="true">\n        <MovviMap','map mount');
once('        </MovviMap>\n      </div>\n\n      {/* Top bar',[
'        </MovviMap>',
'        <button type="button" onClick={()=>setApoisDemandMapOpen(false)}',
'          aria-label="Ocultar mapa de demanda" className="absolute right-3 top-[calc(env(safe-area-inset-top)+86px)] z-30 min-h-11 rounded-2xl border border-white/25 bg-black/80 px-4 text-xs font-bold text-white shadow-lg">Ocultar mapa</button>',
'      </div> : <div data-apois-economy-map-off="true" className="absolute inset-0 bg-[#0C1221]">',
'        {!active && !incoming && !ratingRide && (',
'          <div className="absolute inset-x-5 top-[23%] mx-auto max-w-sm rounded-3xl border border-white/10 bg-white/[0.06] p-5 text-center text-white shadow-xl">',
'            <div className="text-base font-bold">Mapa econômico</div>',
'            <p className="mt-2 text-xs leading-5 text-white/70">O mapa não consome carregamentos enquanto fechado. GPS e avisos de corridas permanecem ativos.</p>',
'            {online ? <button type="button" onClick={()=>setApoisDemandMapOpen(true)} data-apois-open-demand-map="true" className="mt-4 min-h-12 w-full rounded-2xl bg-[#E51B23] px-4 text-sm font-extrabold text-white">Ver regiões de demanda</button>',
'              : <p className="mt-3 text-xs font-semibold text-white/70">Fique online para consultar regiões próximas.</p>}',
'          </div>',
'        )}',
'        {active && <div className="absolute inset-x-5 top-[24%] mx-auto max-w-sm text-center text-white/70">',
'          <p className="text-lg font-bold text-white">Navegação externa</p>',
'          <p className="mt-2 text-sm">Use Reabrir mapa para Google Maps ou Waze. O APOIS mantém GPS, PIN e finalização.</p>',
'        </div>}',
'      </div>}',
'',
'      {/* Top bar'
].join('\n'),'closed map shell');
for(const x of [MARK,'showApoisDemandMap ? <div','data-apois-open-demand-map','showDemandZones && demandZones.map','onStart(pinCode)','onClick={handleComplete}','setPolyline([]);setLegKm(null);setEtaSeconds(null);'])if(!s.includes(x))throw Error('[QA239] postcondition '+x);
if(s.includes('callRoute({ data: { origin: pos, destination: dest } })'))throw Error('[QA239] paid route request survived');
writeFileSync(file,s,'utf8');
console.log('[OK] QA239: Dynamic Maps demand-only with explicit opt-in, no internal Google Routes calls');
