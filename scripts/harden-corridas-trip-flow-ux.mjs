// APOIS_TRIP_UX_V1: somente UI do Cliente. Cancelamento continua no servidor.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
const workspace=resolve(process.env.APOIS_CORRIDAS_WORKSPACE||'.work/corridas');
function patch(path,transform){
  const f=resolve(workspace,path),before=readFileSync(f,'utf8'),after=transform(before);
  if(before!==after)writeFileSync(f,after,'utf8');
  console.log('[OK] APOIS trip UX '+path);
  return after;
}
function change(s,from,to,label){
  if(s.includes(to))return s;
  if(!s.includes(from))throw Error('[FAIL] '+label);
  return s.replace(from,to);
}
patch('src/hooks/use-pickup-address.tsx',(s)=>{
  s=change(s,'useEffect, useCallback }','useEffect, useCallback, useRef }','import useRef');
  s=change(s,'  const refreshAddress = useCallback(async () => {',
    '  // APOIS_PICKUP_STABLE_V1: uma atualizacao do GPS nao invalida o endereco conhecido.\n  const lastGeocodeRef = useRef<{ latitude: number; longitude: number } | null>(null);\n  const geocodeBusyRef = useRef(false);\n  const addressKnownRef = useRef(false);\n  const refreshAddress = useCallback(async () => {','memoizacao pickup');
  s=change(s,
    '    if (!location || !Number.isFinite(location.latitude) || !Number.isFinite(location.longitude)) return;\n\n    setIsLoading(true);\n    setStatus("identifying");',
    '    if (!location || !Number.isFinite(location.latitude) || !Number.isFinite(location.longitude)) return;\n    if (geocodeBusyRef.current) return;\n    const previous = lastGeocodeRef.current;\n    if (previous) {\n      const north = (location.latitude - previous.latitude) * 111320;\n      const east = (location.longitude - previous.longitude) * 111320 * Math.cos(location.latitude * Math.PI / 180);\n      if (Math.hypot(north, east) < 85) return;\n    }\n    geocodeBusyRef.current = true;\n    if (!addressKnownRef.current) { setIsLoading(true); setStatus("identifying"); }',
    'controle de jitter de gps');
  s=change(s,'      setAddress(exactAddress);',
    '      lastGeocodeRef.current = { latitude: location.latitude, longitude: location.longitude };\n      addressKnownRef.current = true;\n      setAddress(exactAddress);','endereco estabilizado');
  s=change(s,'      setAddress(null);\n      setStatus("error");',
    '      if (!addressKnownRef.current) setAddress(null);\n      setStatus(addressKnownRef.current ? "success" : "error");','erro transitório preserva endereço');
  s=change(s,'    } finally {\n      setIsLoading(false);',
    '    } finally {\n      geocodeBusyRef.current = false;\n      setIsLoading(false);','liberacao do guard');
  return s;
});
patch('src/hooks/use-route.tsx',(s)=>{
  // Uma resposta de rota antiga nao pode repor destino/linha vermelha após limpar viagem.
  s=change(s,'useEffect, useCallback }','useEffect, useCallback, useRef }','rota useRef');
  s=change(s,'  const [route, setRoute] = useState<RouteResult | null>(null);',
    '  const [route, setRoute] = useState<RouteResult | null>(null);\n  const routeGenerationRef=useRef(0); // APOIS_ROUTE_CLEAR_SAFE_V1',
    'geracao de calculo');
  s=change(s,'  const calculateRoute = useCallback(async () => {\n    if (!location || !destination) {',
    '  const calculateRoute = useCallback(async () => {\n    const generation=++routeGenerationRef.current;\n    if (!location || !destination) {',
    'generation no calculo');
  s=change(s,'      setRoute(newRoute);\n      setStatus("success");',
    '      if (generation !== routeGenerationRef.current) return;\n      setRoute(newRoute);\n      setStatus("success");','resposta antiga de calculo');
  s=change(s,'    } catch (err: any) {\n      if (err.name === "AbortError") return;',
    '    } catch (err: any) {\n      if (generation !== routeGenerationRef.current) return;\n      if (err.name === "AbortError") return;','erro obsoleto de rota');
  s=change(s,'        clearRoute: () => setRoute(null),',
    '        clearRoute: () => {\n          ++routeGenerationRef.current;\n          setRoute(null);\n          setStatus("idle");\n          setError(null);\n        },','limpeza sincrona da rota');
  return s;
});
patch('src/routes/_authenticated.inicio.tsx',(s)=>{
  const a=s.indexOf('<PassengerMap'),b=s.indexOf('/>',a);
  if(a<0||b<0)throw Error('[FAIL] mapa da home nao localizado');
  const old=s.slice(a,b);
  if(!old.includes('focusPickup=')){
    if(!old.includes('driverLocation={undefined}'))throw Error('[FAIL] prop driverLocation nao localizado');
    s=s.slice(0,a)+old.replace('driverLocation={undefined}', 'driverLocation={undefined}\n          focusPickup={!destination}')+s.slice(b);
  }
  return change(s,'addressStatus === "identifying" || isGeocoding',
    '(addressStatus === "identifying" || isGeocoding) && !address','evitar texto identificando sobre endereco');
});
patch('src/routes/_authenticated.corrida.$rideId.tsx',(s)=>{
  if(!s.includes('APOIS_TRIP_CANCEL_RESET_V1')){
    s=change(s,'import { useActiveRide } from "@/hooks/rides/use-active-ride";',
      'import { useActiveRide } from "@/hooks/rides/use-active-ride";\nimport { useDestination } from "@/hooks/use-destination";\nimport { useRideStops } from "@/hooks/rides/use-ride-stops";\nimport { useRoute } from "@/hooks/use-route";\nimport { useRideRequest } from "@/hooks/rides/use-ride-request";','imports reset da viagem');
    s=change(s,'  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);',
      '  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);\n  const { clearDestination } = useDestination();\n  const { clearStops } = useRideStops();\n  const { clearRoute } = useRoute();\n  const { resetRequest } = useRideRequest();\n  const resetFinishedTripUi = () => { // APOIS_TRIP_CANCEL_RESET_V1\n    clearRide();\n    clearDestination();\n    clearStops();\n    clearRoute();\n    resetRequest();\n  };','limpeza dos estados da viagem');
    s=change(s,'if (screenState === "completed" || screenState === "cancelled") clearRide();',
      'if (screenState === "completed" || screenState === "cancelled") resetFinishedTripUi();','voltar com corrida encerrada');
    s=change(s,'  const handleReturnHome = () => {\n    clearRide();',
      '  const handleReturnHome = () => {\n    resetFinishedTripUi();','voltar a home');
    s=change(s,'          void loadRide(ride.id);',
      '          resetFinishedTripUi();\n          void navigate({ to: "/inicio", replace: true });',
      'cancelamento confirmado');
    const begin=s.indexOf('        {actionAvailability?.canCancel && (');
    const end=s.indexOf('\n        )}',begin);
    if(begin<0||end<0)throw Error('[FAIL] botao cancelar nao encontrado');
    let action=s.slice(begin,end+12);
    if(!action.includes('CANCELAR CORRIDA'))throw Error('[FAIL] acao cancelar invalida');
    action=action.replace(/className="h-12 w-full rounded-2xl[^"]*"/,'className="h-12 w-full rounded-2xl border border-[#E51B23]/30 bg-[#FFF1F2] text-sm font-black text-[#B91C1C] active:bg-[#FFE4E6]"');
    s=s.slice(0,begin)+s.slice(end+12);
    const footerPoint='      </motion.div>\n\n      <CancellationDialog';
    if(!s.includes(footerPoint))throw Error('[FAIL] ponto para novo rodape fixo ausente');
    s=s.replace(footerPoint,
      '      </motion.div>\n\n      {/* APOIS_CANCEL_VISIBLE_V1: botao separado da rolagem, acima da barra inferior */}\n      <div className="relative z-30 shrink-0 border-t border-[#E2E4E8] bg-white px-4 pt-2 pb-[max(env(safe-area-inset-bottom),0.75rem)]">\n'+action+'\n      </div>\n\n      <CancellationDialog');
    s=change(s,'relative flex h-[100dvh] flex-col overflow-hidden',
      'relative flex h-full min-h-0 flex-col overflow-hidden','altura da tela de corrida');
  }
  const a=s.indexOf('<PassengerMap'),b=s.indexOf('/>',a);
  if(a<0||b<0)throw Error('[FAIL] mapa da corrida ausente');
  const map=s.slice(a,b);
  if(!map.includes('focusPickup=')){
    if(!map.includes('origin={ride.origin}'))throw Error('[FAIL] prop origem nao encontrada');
    s=s.slice(0,a)+map.replace('origin={ride.origin}','origin={ride.origin}\n          focusPickup={status === "procurar_motorista"}')+s.slice(b);
  }
  for(const marker of ['APOIS_TRIP_CANCEL_RESET_V1','APOIS_CANCEL_VISIBLE_V1','focusPickup={status === "procurar_motorista"}','resetRequest();']){
    if(!s.includes(marker))throw Error('[FAIL] marcador UX ausente '+marker);
  }
  return s;
});
console.log('[OK] endereco estavel, cancelamento visivel e estados limpos apos cancelamento confirmado.');
