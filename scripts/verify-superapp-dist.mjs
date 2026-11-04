import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { verifyClientBundleAssets } from './qa/verify-client-static-assets-v1.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
verifyClientBundleAssets(resolve(root, 'superapp/shell/dist'));

let failed = false;
function fail(message) { console.error(`[FAIL] ${message}`); failed = true; }
function ok(message) { console.log(`[OK] ${message}`); }
function requireFile(path) { const full=resolve(root,path); if(!existsSync(full)){fail(`arquivo obrigatório ausente: ${path}`);return null;} return readFileSync(full,'utf8'); }
function requireMarkers(path,markers,label){const source=requireFile(path);if(!source)return;const missing=markers.filter(m=>!source.includes(m));if(missing.length)fail(`${label}: ${missing.join(' | ')}`);else ok(label);}
function forbidMarkers(path,markers,label){const source=requireFile(path);if(!source)return;const found=markers.filter(m=>source.includes(m));if(found.length)fail(`${label}: ${found.join(' | ')}`);else ok(label);}
function treeContains(dir,marker,extensions=/\.(?:html|css|js|mjs|json|svg)$/i){const fullDir=resolve(root,dir);if(!existsSync(fullDir))return false;const stack=[fullDir];while(stack.length){const current=stack.pop();for(const entry of readdirSync(current)){const path=resolve(current,entry);const stat=statSync(path);if(stat.isDirectory()){stack.push(path);continue;}if(!extensions.test(entry))continue;try{if(readFileSync(path,'utf8').includes(marker))return true;}catch{}}}return false;}

for(const path of ['superapp/shell/dist/index.html','superapp/shell/dist/assets/apois-brand.png','superapp/shell/dist/modules/corridas/index.html','superapp/shell/dist/modules/entregas/index.html']){if(existsSync(resolve(root,path)))ok(path);else fail(`ausente: ${path}`);}
requireMarkers('superapp/shell/index.html',['./assets/apois-brand.png',"return hasPersistedSession(moduleName)?base+'#/inicio':base+'#/login';","path==='corridas-reset'","path==='email-change'"],'shell fonte mantém marca, sessão por módulo e deep links atuais');
forbidMarkers('superapp/shell/index.html',['<div class="logo-mark">A</div>'],'shell não contém branding provisório');
const shell=requireFile('superapp/shell/dist/index.html');if(shell){if(/\b(?:src|href)=["']\/(?!\/)/.test(shell))fail('shell final contém asset absoluto incompatível com WebView local');else ok('shell final usa recursos relativos');if(!shell.includes('data-apois-superapp-push-routing'))fail('shell final não recebeu roteamento global de Push');else ok('shell final contém roteamento global de Push');}

requireMarkers('.work/corridas/src/integrations/supabase/client.ts',['storageKey: "apois-superapp-corridas-auth-v1"'],'Corridas usa namespace de sessão próprio');
requireMarkers('.work/corridas/src/hooks/use-auth.tsx',['APOIS_RESUME_AUTH_SNAPSHOT_V1','apois-superapp-corridas-auth-v1','persistedBootSession?.user ?? null','useState<Session | null>(() => persistedBootSession)'],'retomada Corridas reidrata sessão persistida sem tela cheia');
requireMarkers('.work/corridas/src/components/auth/AuthGuard.tsx',['APOIS_RESUME_AUTH_GUARD_V1','session?.user'],'AuthGuard Corridas preserva a tela ao voltar do segundo plano');
requireMarkers('.work/corridas/src/routes/_public.login.tsx',['PassengerGoogleLoginButton','<PassengerGoogleLoginButton />','to="/recuperar-senha"'],'Corridas login oferece Google, senha e recuperação');
const googleAuth=requireFile('.work/corridas/src/components/auth/PassengerGoogleLoginButton.tsx');
if(googleAuth){
  const baseMarkers=['br.com.apois.app://auth/corridas-google','signInWithOAuth','provider: "google"'];
  const missing=baseMarkers.filter(marker=>!googleAuth.includes(marker));
  const hasBrowserOpen=googleAuth.includes('Browser.open') || (googleAuth.includes('browserPlugin()') && googleAuth.includes('browser.open({ url: data.url })'));
  if(missing.length || !hasBrowserOpen) fail(`Google OAuth Corridas usa callback nativo do Superapp: ${[...missing,...(!hasBrowserOpen?['Browser.open/native Browser bridge']:[])].join(' | ')}`);
  else ok('Google OAuth Corridas usa callback nativo do Superapp');
}
requireMarkers('.work/corridas/src/hooks/rides/use-ride-request.tsx',['functions.invoke("request-ride"'],'Corridas cria solicitação pelo roteador financeiro do Superapp');
requireMarkers('.work/corridas/src/hooks/rides/use-ride-request.tsx',[
  'APOIS_REQUEST_RIDE_TIMEOUT_V1',
  'REQUEST_RIDE_TIMEOUT_MS = 20_000',
  'Promise.race([',
  'invokeRequestRideWithTimeout(payload)',
  'request_timeout',
],'Corridas não deixa solicitação de corrida carregando indefinidamente');
requireMarkers('.work/corridas/src/services/payments/payment-service.ts',['const isDirectToDriver = code === "cash" || code === "credit";','Pague diretamente ao motorista em dinheiro ao final da corrida.','Pague diretamente ao motorista no cartão de crédito'],'Corridas preserva somente Dinheiro/Cartão direto ao motorista');
requireMarkers('.work/corridas/src/components/BottomNavigation.tsx',['grid-cols-5','min-h-[64px]','pb-[max(44px,env(safe-area-inset-bottom))]','Início','Corridas','Carteira','Notificações','Perfil'],'Corridas mantém rodapé acima da barra de navegação Android, legível e com cinco destinos');
requireMarkers('.work/corridas/src/routes/_authenticated.tsx',['hideBottomNavigation','pathname === "/buscar-destino"','pathname.startsWith("/corrida/")'],'Corridas não sobrepõe rodapé nas jornadas fullscreen');
requireMarkers('.work/corridas/src/styles.css',['APOIS_VISUAL_KIT_V1','APOIS_REFERENCE_HOME_V2','.apois-kit-home','.apois-kit-search-screen'],'Corridas recebeu o kit visual durável');
requireMarkers('.work/corridas/src/routes/_authenticated.inicio.tsx',['PassengerMap','data-apois-reference-home-v2','apois-kit-home','Local de partida','Destino','max-h-[46dvh]', 'h-10 w-10 rounded-full object-contain','bg-transparent','<CategorySelector />','Solicitar corrida'],'Home Corridas usa mapa predominante, destino só no painel inferior e visual APOIS V2 aprovado');
forbidMarkers('.work/corridas/src/routes/_authenticated.inicio.tsx',['Para onde vamos?'],'Home Corridas não duplica campo de destino no topo');
requireMarkers('.work/corridas/src/routes/_authenticated.buscar-destino.tsx',[
  'apois-kit-search-screen',
  'suggestions.map',
  'whitespace-normal break-words',
  'text-[#111111]',
  'caret-[#E51B23]',
  'placeholder:text-[#9AA0A8]',
],'Busca Corridas mantém sugestões visíveis e texto digitado legível sobre fundo branco');
requireMarkers('.work/corridas/src/components/ui/bottom-sheet/BottomSheet.tsx',['max-h-[94dvh]','z-[120]','z-[110]','max(52px, env(safe-area-inset-bottom))','overscroll-contain'],'BottomSheet Corridas fica acima do rodapé e da barra Android, respeitando teclado/safe area');
requireMarkers('.work/corridas/src/components/payments/PaymentMethodSelector.tsx',[
  'z-[140]',
  'max-h-[78dvh]',
  'overflow-y-auto overscroll-contain',
  'touch-pan-y',
],'Forma de pagamento fica acima do rodapé e possui rolagem própria');
requireMarkers('.work/corridas/src/routes/_authenticated.corrida.$rideId.tsx',[
  'status !== "procurar_motorista" ? <RideStatusHeader',
  'max-h-[52dvh]',
  'overscroll-contain',
],'Busca de motorista não duplica banner piscante e preserva mapa proporcional');
requireMarkers('.work/corridas/src/routes/_authenticated.revisar-solicitacao.tsx',[
  'h-[100dvh] min-h-0 flex-col overflow-hidden',
  'overscroll-contain px-4 py-4',
  'pb-[max(64px,env(safe-area-inset-bottom))]',
  'h-14 w-full rounded-2xl',
],'Revisão de corrida mantém CTA acima da navegação Android e reduz rolagem excessiva');
requireMarkers('.work/corridas/src/components/pricing/CategorySelector.tsx',[
  'APOIS_CATEGORY_VEHICLE_SPRITE_V6',
  'import { vehicleSprite } from "@/assets/categoryVehicleData"',
  'carros: "0%"',
  'motos: "25%"',
  'fretes: "50%"',
  'guincho: "75%"',
  'envios: "100%"',
  'validated-sprite-v6',
  'backgroundSize: "500% 100%"',
  'PRICING_CONFIG.LABELS[cat.key]',
  'w-[124px]',
  'h-[84px]',
  'border-[#E51B23]',
],'Categorias Corridas usam o sprite APOIS validado com cinco veículos corretos');
forbidMarkers('.work/corridas/src/components/pricing/CategorySelector.tsx',[
  'images.pexels.com',
  'pic.52112.com',
  'fahrschule-arnold.info',
  'findamover.com.au',
  'jige-international.com',
  'deliverybikeparts.co.za',
],'Categorias Corridas não dependem de imagens externas/hotlink');
requireMarkers('.work/corridas/src/components/map/PassengerMap.tsx',[
  'APOIS_NATIVE_MAP_FALLBACK_V3',
  '[isStatic, nativeApiKey, reloadKey]',
  'VITE_GOOGLE_MAPS_NATIVE_API_KEY',
  'Capacitor.isNativePlatform()',
  'mapService.createMap',
  'mapService.upsertDriverMarker',
  'PolylineDecoder',
  'displayedRoutePoints',
  'if (encodedPolyline)',
  'bottom: 240',
  'const previousHtml = document.documentElement.style.backgroundColor',
  'const changed: Array<{ element: HTMLElement',
  'document.body.style.backgroundColor = "transparent"',
  'bg-transparent',
],'PassengerMap usa Google Maps nativo no Android com fallback JS');
const passengerMapSource = requireFile('.work/corridas/src/components/map/PassengerMap.tsx') ?? '';
if (!/const PassengerMap:[\s\S]*?\{[\s\S]*?encodedPolyline,\s*driverLocation,/.test(passengerMapSource)) {
  fail('PassengerMap recebe encodedPolyline no destructuring');
} else ok('PassengerMap recebe encodedPolyline no destructuring');
const polylineImport = 'import { PolylineDecoder } from "@/services/routes/polyline-decoder";';
if ((passengerMapSource.split(polylineImport).length - 1) !== 1) {
  fail('PassengerMap não pode duplicar PolylineDecoder');
} else ok('PassengerMap contém exatamente um import de PolylineDecoder');

requireMarkers('.work/corridas/src/services/maps/map-service.ts',['APOIS_MAP_STYLE_LIGHT_NATIVE','styles: APOIS_MAP_STYLE_LIGHT_NATIVE','strokeColor: "#E51B23"','iconUrl: "assets/markers/apois-location.svg"','upsertDriverMarker(','removeDriverMarker('],'Mapa nativo do passageiro usa estilo claro APOIS, rota vermelha e marcador do passageiro/motorista');
requireMarkers('.work/corridas/src/services/routes/route-config.ts',['TOP: 72','RIGHT: 28','BOTTOM: 220','LEFT: 28'],'Câmera da rota preserva mais área útil do mapa com painel compacto');
forbidMarkers('.work/corridas/src/services/maps/map-service.ts',['assets/markers/pickup.png','assets/markers/destination.png'],'Mapa nativo não depende de marker PNG inexistente');
requireMarkers('.work/corridas/src/services/places/places-service.ts',[
  'supabase.functions',
  'invoke("google-maps-address"',
  'action: "autocomplete"',
  'action: "place_details"',
  'places_timeout',
],'Busca de destino Corridas usa Edge Function autenticada e não pode ficar carregando indefinidamente');
requireMarkers('.work/corridas/src/hooks/use-destination-search.tsx',[
  'requestSequence',
  'placesService.cancelPendingSearch()',
  'PLACES_CONFIG.DEBOUNCE_MS',
  'setIsLoading(false)',
],'Digitação de destino cancela buscas antigas e limpa loading corretamente');
requireMarkers('.work/corridas/src/routes/_authenticated.buscar-destino.tsx',[
  'data-apois-stable-destination-sheet',
  'h-[78dvh]',
  'query.trim().length < 3',
],'Busca de destino mantém painel estável com teclado aberto');

requireMarkers('.work/corridas/src/hooks/use-location.tsx',[
  'APOIS_PRECISE_LOCATION_V1',
  'permissions: ["location", "coarseLocation"]',
  'enableHighAccuracy: true',
  'maximumAge: 0',
  'Geolocation.watchPosition(',
],'localização Corridas solicita permissão precisa e acompanha GPS em alta precisão');
requireMarkers('.work/corridas/src/components/map/PassengerMap.tsx',[
  'APOIS_MAP_STYLE_LIGHT_JS',
  'label: { text: "A"',
  'strokeColor: "#E51B23"',
],'Mapa JS usa identidade clara APOIS, marcador A e rota vermelha');


requireMarkers('.work/corridas/src/hooks/rides/use-active-ride.tsx',['RIDE_STATUS_ORDER','lastAcceptedStatusRef','await loadRide(currentRideId)'],'Corridas preserva lifecycle monotônico e retomada terminal');
requireMarkers('.work/corridas/src/routes/_authenticated.corrida.$rideId.tsx',['PassengerMap','APOIS_PIN_AFTER_ACCEPT_V1','get_passenger_ride_security_code','code={passengerPin}','status === "motorista_chegou"'],'Corrida ativa usa mapa real e PIN buscado com autorização após aceite/chegada');
forbidMarkers('.work/corridas/src/routes/_authenticated.corrida.$rideId.tsx',['<SecurityCodeCard code={ride.security_code}'],'PIN nunca deve vir diretamente de public.rides');
requireMarkers('.work/corridas/src/services/rides/active-ride-service.ts',['postgres_changes','canCancel: ["procurar_motorista", "motorista_a_caminho"].includes(status)'],'Corridas mantém Realtime e bloqueia cancelamento após chegada/início da viagem');
forbidMarkers('.work/corridas/src/services/rides/active-ride-service.ts',['canCancel: ["procurar_motorista", "motorista_a_caminho", "motorista_chegou", "em_viagem"]'],'Corridas não permite cancelamento em viagem');

const visualBundleMarkers=['apois-kit-home','apois-kit-search-screen','apois-kit-home-panel'];
const missingVisualBundleMarkers=visualBundleMarkers.filter(marker=>!treeContains('superapp/shell/dist/modules/corridas',marker));
if(missingVisualBundleMarkers.length)fail(`bundle Corridas final não contém identificadores do kit visual: ${missingVisualBundleMarkers.join(' | ')}`);else ok('bundle Corridas final contém identificadores do APOIS_VISUAL_KIT_V1');
if(!treeContains('superapp/shell/dist/modules/corridas','apois-kit-search-screen'))fail('bundle Corridas final não contém a busca visual nova');else ok('bundle Corridas final contém a busca visual nova');
function treeCountFiles(dir,pattern){const fullDir=resolve(root,dir);if(!existsSync(fullDir))return 0;let count=0;const stack=[fullDir];while(stack.length){const current=stack.pop();for(const entry of readdirSync(current)){const path=resolve(current,entry);const stat=statSync(path);if(stat.isDirectory()){stack.push(path);continue;}if(pattern.test(entry))count++;}}return count;}
const realisticVehicleAssets=treeCountFiles('superapp/shell/dist/modules/corridas',/\.webp$/i);
if(!treeContains('superapp/shell/dist/modules/corridas','data:image/webp;base64,'))fail('bundle Corridas final não contém sprite local das categorias');else ok('bundle Corridas final contém sprite local validado das categorias');
if(treeContains('superapp/shell/dist/modules/corridas','pic.52112.com/180806/JPG-180806_120/vGHP86zk7D_small.jpg'))fail('bundle Corridas final ainda depende da imagem externa antiga de Carro');else ok('bundle Corridas final não depende de imagem externa antiga de Carro');
if(!treeContains('superapp/shell/dist/modules/corridas','Continuar com Google'))fail('bundle Corridas final perdeu o botão Google');else ok('bundle Corridas final contém login com Google');
if(!treeContains('superapp/shell/dist/modules/corridas','corridas-google'))fail('bundle Corridas final perdeu callback Google do Superapp');else ok('bundle Corridas final contém callback Google nativo');

forbidMarkers('.apois/modules.json',['ActiveRideMap.tsx','RidePixPaymentCard.tsx','ActiveJourneyScreen.tsx','aguardando_pagamento: 2'],'pipeline Corridas não depende de componentes/estados ausentes no pin atual');
forbidMarkers('scripts/fix-corridas-superapp-ui.mjs',['src/components/layout/AppShell.tsx','PassengerProfileCenter.tsx','native-password-recovery.ts'],'adaptador UI Corridas aponta somente para arquivos do pin atual');
requireMarkers('.work/entregas/src/integrations/supabase/client.ts',['storageKey: "apois-superapp-entregas-auth-v1"','flowType: "pkce"'],'Entregas usa namespace de sessão próprio e Google OAuth PKCE');
requireMarkers('.work/entregas/src/components/AuthSessionIsolation.tsx',['window.location.hash.startsWith("#/")'],'isolamento de sessão Entregas entende Hash History');
requireMarkers('.work/entregas/src/components/GoogleLoginButton.tsx',['function getNativeAuthCallback()','VITE_APOIS_NATIVE_SCHEME','__APOIS_SUPERAPP_AUTH_BRIDGE__','APOIS_GOOGLE_PENDING_KEY','APOIS_GOOGLE_FORWARD_KEY','consumeForwardedGoogleCallback','apois:entregas-google-callback'],'Google OAuth Entregas retorna pelo package unificado e consome callback no módulo correto');
requireMarkers('.work/entregas/src/routes/register.tsx',['emailRedirectTo: "br.com.apois.app://auth/callback"'],'cadastro Entregas usa callback unificado');
requireMarkers('.work/entregas/src/routes/login.tsx',['redirectTo: Capacitor.isNativePlatform() ? "br.com.apois.app://auth/reset" : new URL("/redefinir-senha", window.location.origin).toString()','data-apois-customer-login-red-v3','src={apoisClientBrand}','bg-[linear-gradient(180deg,#FFFFFF_0%,#FFF8F8_58%,#FFF1F2_100%)]','<GoogleLoginButton />'],'Login Entregas mantém reset/Google e usa visual claro APOIS vermelho/branco');
requireMarkers('.work/entregas/src/lib/customer-push.ts',['register_superapp_customer_push_device','_app_package: "br.com.apois.app"','const isDeliveryPush =','if (!target) return;'],'Push Entregas filtra produto e registra package correto');
forbidMarkers('.work/entregas/src/lib/customer-push.ts',['PushNotifications.unregister()'],'logout Entregas não invalida token FCM compartilhado');
requireMarkers('.work/entregas/src/routes/checkout.tsx',['const paymentMethod = "cash";','paymentMethod: "cash"','if (paymentMethod !== "cash")'],'checkout Entregas permanece cash-only e fail-closed');
requireMarkers('.work/entregas/src/components/AppBottomNav.tsx',['fixed bottom-0','min-h-[88px]','aria-label="Buscar"','<Search className="h-8 w-8" />'],'rodapé Entregas é fixo, legível e explícito');
requireMarkers('.work/entregas/src/components/AppBottomNav.tsx',['pb-[max(44px,env(safe-area-inset-bottom))]'],'rodapé Entregas preserva fallback físico para barra Android');
requireMarkers('.work/entregas/src/components/ui/dialog.tsx',['z-[120]','z-[121]'],'Dialog Entregas fica acima do rodapé fixo');
requireMarkers('.work/entregas/src/components/ui/alert-dialog.tsx',['z-[120]','z-[121]'],'AlertDialog Entregas fica acima do rodapé fixo');
requireMarkers('.work/entregas/src/components/ui/sheet.tsx',['z-[120]','z-[121]'],'Sheet Entregas fica acima do rodapé fixo');
requireMarkers('.work/entregas/src/components/ProductCustomizationSheet.tsx',['h-[90dvh]','pb-[max(52px,env(safe-area-inset-bottom))]'],'personalização de produto respeita viewport e barra Android');
requireMarkers('.work/entregas/src/routes/sacola.tsx',['pb-[max(52px,env(safe-area-inset-bottom))]'],'sacola Entregas mantém CTA acima da barra Android');
requireMarkers('.work/entregas/src/routes/pedido/confirmado.tsx',['pb-[max(52px,env(safe-area-inset-bottom))]'],'confirmação de pedido respeita barra Android');
requireMarkers('.work/entregas/src/routes/pedido/$orderId/avaliar.tsx',['pb-[max(52px,env(safe-area-inset-bottom))]'],'avaliação do pedido respeita barra Android');
if(failed)process.exit(1);console.log('[OK] Superapp dist reconciliado: Corridas atual + Entregas + shell validados.');
