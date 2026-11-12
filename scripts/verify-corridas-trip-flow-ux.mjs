import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const root=resolve('.work/corridas');
const read=p=>readFileSync(resolve(root,p),'utf8');
const home=read('src/routes/_authenticated.inicio.tsx');
const active=read('src/routes/_authenticated.corrida.$rideId.tsx');
const pickup=read('src/hooks/use-pickup-address.tsx');
const route=read('src/hooks/use-route.tsx');
const map=read('src/components/map/PassengerMap.tsx');
const dialog=read('src/components/rides/active/CancellationDialog.tsx');
for(const token of ['APOIS_PICKUP_STABLE_V1','geocodeBusyRef.current','APOIS_PASSENGER_QA215_PICKUP_BACKOFF_V1','movedFromSuccess < 85','elapsed < 20000','elapsed < 60000','addressKnownRef.current ? "success" : "error"'])
  assert.ok(pickup.includes(token),'pickup instavel: '+token);
for(const token of ['focusPickup={!destination}','currentAddressText','&& !address'])
  assert.ok(home.includes(token),'home nao protege endereco: '+token);
for(const token of ['APOIS_PICKUP_FOCUS_V1','focusPickup?: boolean','focusPickup = false','pickupCameraCoordinate','pickupMoved(origin)','mapService.setCamera','setCenter(pickupCameraCoordinate'])
  assert.ok(map.includes(token),'mapa sem foco: '+token);
for(const token of ['APOIS_TRIP_CANCEL_RESET_V1','APOIS_CANCEL_VISIBLE_V1','clearDestination();','clearStops();','clearRoute();','resetRequest();','focusPickup={status === "procurar_motorista"}','void navigate({ to: "/inicio", replace: true })'])
  assert.ok(active.includes(token),'cancelamento/reset faltando: '+token);
assert.ok(active.includes('relative flex h-full min-h-0 flex-col overflow-hidden'));
const button=active.indexOf('CANCELAR CORRIDA');
const panelClose=active.lastIndexOf('</motion.div>',button);
const dialogAt=active.indexOf('<CancellationDialog',button);
assert.ok(panelClose>=0&&button>panelClose&&dialogAt>button,'botao cancelar deve ficar fora do painel rolavel e antes do dialog');
const footer=active.indexOf('APOIS_CANCEL_VISIBLE_V1');
assert.ok(footer>panelClose&&footer<button,'rodape de cancelamento ausente');
assert.ok(dialog.includes('await rideRequestService.cancelRide(rideId)'),'cancelamento precisa continuar confirmado pelo servidor');
assert.ok(dialog.includes('if (!response.ok)')&&dialog.includes('onSuccess();'),'erro servidor impede reset visual prematuro');
for(const token of ['APOIS_ROUTE_CLEAR_SAFE_V1','generation !== routeGenerationRef.current','++routeGenerationRef.current'])
  assert.ok(route.includes(token),'rota atrasada nao invalidada: '+token);
assert.ok(!active.includes('void loadRide(ride.id);'),'cancelamento nao deve recarregar corrida antiga');
console.log('[OK] APOIS Cliente: GPS/endereco estavel, camera embarque, cancelamento visivel, reset e invalidacao de rota conferidos.');
