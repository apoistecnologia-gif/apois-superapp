import {readFileSync,writeFileSync} from "node:fs";
import {resolve} from "node:path";
const root=resolve(process.env.APOIS_ENTREGAS_WORKSPACE || ".work/partner-entregador");
const path=resolve(root,"src/routes/courier.tsx");
let s=readFileSync(path,"utf8");
const before=`        ) : (
          <CourierOfflineCard busy={busy === "online"} onToggle={toggleOnline} />
        )}`;
const after=`        ) : (
          <CourierLiveMap
            currentPosition={currentPosition}
            merchants={nearbyMerchants}
            activeOfferMerchantIds={[]}
          />
        )}`;
if(!s.includes(before))throw Error("[FAIL] bloco offline não localizado");
s=s.replace(before,after);
const stateAnchor='  const [settlementBusy, setSettlementBusy] = useState<string | null>(null);';
if(!s.includes(stateAnchor))throw Error('[FAIL] posição dos hooks do Entregador mudou');
s=s.replace(stateAnchor,stateAnchor+`
  // Vista inicial do mapa OFFLINE: uma leitura pontual de GPS, sem rastreamento
  // contínuo nem transmissão ao servidor enquanto o entregador está offline.
  useEffect(() => {
    if (!courier?.id || availability?.is_online || !navigator.geolocation) return;
    let active = true;
    navigator.geolocation.getCurrentPosition(
      ({coords}) => {
        if (!active) return;
        setCurrentPosition({
          lat: coords.latitude, lng: coords.longitude,
          accuracy: coords.accuracy, heading: coords.heading,
          speed: coords.speed, recordedAt: Date.now()
        });
      },
      () => { /* sem permissão: componente exibe aviso sem ativar GPS contínuo */ },
      {enableHighAccuracy:false,timeout:8000,maximumAge:60000}
    );
    return () => {active=false;};
  }, [courier?.id, availability?.is_online]);
`);

// StatusCard continua sendo o único botão online/offline, inclusive antes de haver oferta.
s=s.replace('className="mx-auto w-full max-w-lg space-y-4 overflow-x-hidden p-4 pb-[calc(7.7rem+env(safe-area-inset-bottom))]"',
'className="mx-auto w-full max-w-lg space-y-2.5 overflow-x-hidden px-3 py-3 pb-[calc(6.5rem+env(safe-area-inset-bottom))]"');
writeFileSync(path,s,"utf8");
const mapPath=resolve(root,"src/components/CourierRouteMap.tsx");
let m=readFileSync(mapPath,"utf8");
m=m.replace('className="relative h-[23rem] min-h-[52vh] max-h-[31rem] w-full bg-zinc-900"',
'className="relative h-[18rem] min-h-[30vh] max-h-[22rem] w-full bg-zinc-900"');
m=m.replace('className="border-b border-accent/20 bg-black/70 px-4 py-3.5"',
'className="border-b border-accent/20 bg-black/70 px-3 py-2"');
writeFileSync(mapPath,m,"utf8");
const premiumPath=resolve(root,"src/components/CourierPremiumViews.tsx");
let p=readFileSync(premiumPath,"utf8");
if(!p.includes("export function CourierStatusCard"))throw Error("[FAIL] status card ausente");
const start=p.indexOf("export function CourierStatusCard");
const end=p.indexOf("export function ",start+15);
let card=p.slice(start,end>start?end:undefined);
card=card.replaceAll("p-6 ","p-3 ").replaceAll("p-5 ","p-3 ").replaceAll("h-16 w-16","h-11 w-11").replaceAll("text-3xl","text-xl").replaceAll("text-2xl","text-lg").replaceAll("min-h-","min-h-");
p=p.slice(0,start)+card+(end>start?p.slice(end):"");
writeFileSync(premiumPath,p,"utf8");
console.log("[OK] Entregador: mapa também OFFLINE, um único controle de disponibilidade, home compacta.");
