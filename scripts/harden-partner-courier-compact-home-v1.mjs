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
s=s.replace('            activeOfferMerchantIds={[]}\\n          />', '            activeOfferMerchantIds={[]}\\n          />\\n          {offlineGpsError ? <p role="status" className="rounded-xl bg-amber-50 px-3 py-2 text-center text-xs text-amber-900">{offlineGpsError}</p> : null}');
if(!s.includes('activeOfferMerchantIds={[]}')) throw Error('[FAIL] mapa offline não inserido');
const stateAnchor='  const [settlementBusy, setSettlementBusy] = useState<string | null>(null);';
if(!s.includes(stateAnchor))throw Error('[FAIL] posição dos hooks do Entregador mudou');
s=s.replace(stateAnchor,stateAnchor+`\n  const [offlineGpsError, setOfflineGpsError] = useState<string | null>(null);
  // Vista inicial do mapa OFFLINE: uma leitura pontual de GPS, sem rastreamento
  // contínuo nem transmissão ao servidor enquanto o entregador está offline.
  useEffect(() => {
    if (!courier?.id || availability?.is_online) return;
    let active = true;
    const onCoordinates = ({coords}: {coords: {latitude: number; longitude: number; accuracy: number; heading: number | null; speed: number | null}}) => {
        if (!active) return;
        setOfflineGpsError(null);
        setCurrentPosition({
          lat: coords.latitude, lng: coords.longitude,
          accuracy: coords.accuracy, heading: coords.heading,
          speed: coords.speed, recordedAt: Date.now()
        });
      };
    // A WebView Android pode não fornecer navigator.geolocation com permissão
    // mesmo quando o app possui GPS nativo autorizado.
    const locate = async () => {
      try {
        if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android") {
          let permission = await Geolocation.checkPermissions();
          if (permission.location !== "granted") {
            permission = await Geolocation.requestPermissions({ permissions: ["location", "coarseLocation"] });
          }
          if (permission.location !== "granted") {
            if (active) setOfflineGpsError("Autorize a localização nas configurações do Android.");
            return;
          }
          const position = await Geolocation.getCurrentPosition({
            enableHighAccuracy: true, timeout: 20000, maximumAge: 60000
          });
          onCoordinates(position);
        } else if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            onCoordinates,
            () => { if(active) setOfflineGpsError("Verifique a permissão e o GPS para visualizar o mapa."); },
            {enableHighAccuracy:true,timeout:20000,maximumAge:60000}
          );
        } else if (active) setOfflineGpsError("GPS indisponível neste dispositivo.");
      } catch {
        if (active) setOfflineGpsError("Não foi possível obter a localização. Verifique o GPS e tente novamente.");
      }
    };
    void locate();
    return () => {active=false;};
  }, [courier?.id, availability?.is_online]);
`);

s=s.replace('import logoAsset from "@/assets/logo.png.asset.json";',
'import { APOIS_PARTNER_LOGO_DATA_URL } from "@/assets/apoisPartnerLogoData";\nimport { Capacitor } from "@capacitor/core";\nimport { Geolocation } from "@capacitor/geolocation";');
s=s.replaceAll("src={logoAsset.url}", "src={APOIS_PARTNER_LOGO_DATA_URL}");
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
