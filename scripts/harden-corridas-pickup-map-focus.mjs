// APOIS_PICKUP_FOCUS_V1: manter a posicao do cliente acima do painel durante
// a busca; o GPS, a rota, a chave de API e os marcadores permanecem intactos.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
const file=resolve(process.env.APOIS_CORRIDAS_WORKSPACE||'.work/corridas','src/components/map/PassengerMap.tsx');
let src=readFileSync(file,'utf8');
function change(from,to,label){
  if(src.includes(to))return;
  if(!src.includes(from))throw Error('[FAIL] Mapa pickup foco: '+label);
  src=src.replace(from,to);
}
change('  isStatic: boolean | undefined;','  isStatic: boolean | undefined;\n  focusPickup?: boolean;', 'tipo da propriedade');
change('  isStatic = false,','  isStatic = false,\n  focusPickup = false,','prop de foco de busca');
change('  const cameraInitializedRef = useRef(false);',
  '  const cameraInitializedRef = useRef(false);\n  const pickupCameraRef = useRef<Coordinate | null>(null); // APOIS_PICKUP_FOCUS_V1',
  'memoria da camera');
const helper='  const origin = useMemo(() => {';
change(helper,
  '  // O centro se desloca para o sul e deixa o pin no terco superior.\n'
  +'  const pickupCameraCoordinate = (point: Coordinate, height: number, zoom: number): Coordinate => {\n'
  +'    const metersPerPixel = 156543.03392 * Math.cos(point.lat * Math.PI / 180) / Math.pow(2, zoom);\n'
  +'    const offsetPixels = Math.min(260, Math.max(55, height * 0.21));\n'
  +'    return { lat: point.lat - offsetPixels * metersPerPixel / 111320, lng: point.lng };\n'
  +'  };\n'
  +'  const pickupMoved = (point: Coordinate) => {\n'
  +'    const old=pickupCameraRef.current;\n'
  +'    if(!old)return true;\n'
  +'    const dy=(point.lat-old.lat)*111320;\n'
  +'    const dx=(point.lng-old.lng)*111320*Math.cos(point.lat*Math.PI/180);\n'
  +'    return Math.hypot(dx,dy)>85;\n'
  +'  };\n\n'+helper,
  'ajuste de enquadramento sem jitter');
// O branch nativo deve ser aplicado ANTES do fitRouteBounds para evitar zoom amplo
// quando o passageiro aguarda a busca de motorista.
if (!src.includes('mapService.upsertRoutePolyline(mapId, points)')) throw Error('[FAIL] Rota nativa sem polyline de referência');
change('        await mapService.fitRouteBounds(mapId, points);',
  '        if (focusPickup && origin) {\n'
  +'          if (pickupMoved(origin)) {\n'
  +'            const h = mapElementRef.current?.clientHeight ?? 500;\n'
  +'            await mapService.setCamera(mapId, { coordinate: pickupCameraCoordinate(origin, h, 16), zoom: 16 });\n'
  +'            pickupCameraRef.current=origin;\n'
  +'          }\n'
  +'        } else await mapService.fitRouteBounds(mapId, points);',
  'foco durante rota nativa');
change('        if (origin && destination) await mapService.fitPickupAndDestination(mapId, origin, destination, 110);',
  '        if (focusPickup && origin) {\n'
  +'          if (pickupMoved(origin)) {\n'
  +'            await mapService.setCamera(mapId, { coordinate: pickupCameraCoordinate(origin, mapElementRef.current?.clientHeight ?? 500, 16), zoom: 16 });\n'
  +'            pickupCameraRef.current=origin;\n'
  +'          }\n'
  +'        } else if (origin && destination) await mapService.fitPickupAndDestination(mapId, origin, destination, 110);',
  'foco nativo sem polyline');
change('  }, [destination, displayedRoutePoints, origin, status, validDriverLocation]);',
  '  }, [destination, displayedRoutePoints, origin, status, validDriverLocation, focusPickup]);',
  'dependencia do foco');
change('    if (pointCount > 1) {\n      mapRef.current.fitBounds(bounds, { top: 120, right: 28, bottom: 240, left: 28 });',
  '    if (focusPickup && origin) {\n'
  +'      if (pickupMoved(origin)) {\n'
  +'        const zoom = 16;\n'
  +'        mapRef.current.setZoom(zoom);\n'
  +'        mapRef.current.setCenter(pickupCameraCoordinate(origin, mapElementRef.current?.clientHeight ?? 500, zoom));\n'
  +'        pickupCameraRef.current=origin;\n'
  +'      }\n'
  +'    } else if (pointCount > 1) {\n'
  +'      pickupCameraRef.current=null;\n'
  +'      mapRef.current.fitBounds(bounds, { top: 120, right: 28, bottom: 240, left: 28 });',
  'foco JS antes dos bounds');
const cameraEffectMarker = 'cameraInitializedRef.current = true;';
const cameraEffectAt = src.indexOf(cameraEffectMarker);
if(cameraEffectAt < 0)throw Error('[FAIL] estado da camera JS ausente');
const depsBegin=src.indexOf('  }, [',cameraEffectAt);
const depsEnd=src.indexOf(']);',depsBegin);
if(depsBegin<0||depsEnd<0)throw Error('[FAIL] lista de dependencias da camera JS ausente');
const originalDeps=src.slice(depsBegin,depsEnd+3);
if(!originalDeps.includes('origin')||!originalDeps.includes('status'))throw Error('[FAIL] dependencias da camera inesperadas');
if(!originalDeps.includes('focusPickup')){
  src=src.slice(0,depsBegin)+originalDeps.replace(']);',', focusPickup]);')+src.slice(depsEnd+3);
}

for(const marker of ['APOIS_PICKUP_FOCUS_V1','focusPickup = false','pickupCameraCoordinate','pickupMoved(origin)']){
  if(!src.includes(marker))throw Error('[FAIL] Mapa foco incompleto '+marker);
}
writeFileSync(file,src,'utf8');
console.log('[OK] mapa Passageiro: pin central visivel na home e no estado de busca, sem saltos por GPS.');
