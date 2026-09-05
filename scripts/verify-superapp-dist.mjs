import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
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
requireMarkers('.work/corridas/src/services/payments/payment-service.ts',['const isDirectToDriver = code === "cash" || code === "credit";','Pague diretamente ao motorista ao final da corrida.','Pague diretamente ao motorista com cartão de crédito.'],'Corridas preserva PIX digital e Dinheiro/Cartão direto ao motorista');
requireMarkers('.work/corridas/src/components/BottomNavigation.tsx',['grid-cols-5','min-h-[64px]','Início','Corridas','Carteira','Notificações','Perfil'],'Corridas mantém rodapé único, legível e com cinco destinos');
requireMarkers('.work/corridas/src/routes/_authenticated.tsx',['hideBottomNavigation','pathname === "/buscar-destino"','pathname.startsWith("/corrida/")'],'Corridas não sobrepõe rodapé nas jornadas fullscreen');
requireMarkers('.work/corridas/src/styles.css',['APOIS_VISUAL_KIT_V1','.apois-kit-home','.apois-kit-search-screen'],'Corridas recebeu o kit visual durável');
requireMarkers('.work/corridas/src/routes/_authenticated.inicio.tsx',['PassengerMap','apois-kit-home','Digite um endereço...','<CategorySelector />'],'Home Corridas usa mapa real, busca e visual APOIS');
requireMarkers('.work/corridas/src/routes/_authenticated.buscar-destino.tsx',['apois-kit-search-screen','suggestions.map','whitespace-normal break-words'],'Busca Corridas mantém sugestões visíveis e legíveis');
requireMarkers('.work/corridas/src/components/ui/bottom-sheet/BottomSheet.tsx',['max-h-[94dvh]','max(16px, env(safe-area-inset-bottom))','overscroll-contain'],'BottomSheet Corridas não reserva rodapé fantasma e respeita teclado/safe area');
requireMarkers('.work/corridas/src/components/pricing/CategorySelector.tsx',['grid-cols-[58px_minmax(0,1fr)_auto]','carro: Car','moto: Bike','fretes: Truck','guincho: Wrench','envios: Package','PRICING_CONFIG.LABELS[cat.key]'],'Categorias Corridas usam os cinco códigos oficiais em cards premium sem truncamento horizontal');
requireMarkers('.work/corridas/src/hooks/rides/use-active-ride.tsx',['RIDE_STATUS_ORDER','lastAcceptedStatusRef','await loadRide(currentRideId)'],'Corridas preserva lifecycle monotônico e retomada terminal');
requireMarkers('.work/corridas/src/routes/_authenticated.corrida.$rideId.tsx',['PassengerMap','["motorista_a_caminho", "motorista_chegou"].includes(status)'],'Corrida ativa usa PassengerMap real e mantém PIN até o embarque');
requireMarkers('.work/corridas/src/services/rides/active-ride-service.ts',['postgres_changes','canCancel: ["procurar_motorista", "motorista_a_caminho", "motorista_chegou"].includes(status)'],'Corridas mantém Realtime e bloqueia cancelamento após início da viagem');
forbidMarkers('.work/corridas/src/services/rides/active-ride-service.ts',['canCancel: ["procurar_motorista", "motorista_a_caminho", "motorista_chegou", "em_viagem"]'],'Corridas não permite cancelamento em viagem');

const visualBundleMarkers=['apois-kit-home','apois-kit-search-screen','apois-kit-home-panel'];
const missingVisualBundleMarkers=visualBundleMarkers.filter(marker=>!treeContains('superapp/shell/dist/modules/corridas',marker));
if(missingVisualBundleMarkers.length)fail(`bundle Corridas final não contém identificadores do kit visual: ${missingVisualBundleMarkers.join(' | ')}`);else ok('bundle Corridas final contém identificadores do APOIS_VISUAL_KIT_V1');
if(!treeContains('superapp/shell/dist/modules/corridas','apois-kit-search-screen'))fail('bundle Corridas final não contém a busca visual nova');else ok('bundle Corridas final contém a busca visual nova');
if(!treeContains('superapp/shell/dist/modules/corridas','Continuar com Google'))fail('bundle Corridas final perdeu o botão Google');else ok('bundle Corridas final contém login com Google');
if(!treeContains('superapp/shell/dist/modules/corridas','corridas-google'))fail('bundle Corridas final perdeu callback Google do Superapp');else ok('bundle Corridas final contém callback Google nativo');

forbidMarkers('.apois/modules.json',['ActiveRideMap.tsx','RidePixPaymentCard.tsx','ActiveJourneyScreen.tsx','aguardando_pagamento: 2'],'pipeline Corridas não depende de componentes/estados ausentes no pin atual');
forbidMarkers('scripts/fix-corridas-superapp-ui.mjs',['src/components/layout/AppShell.tsx','PassengerProfileCenter.tsx','native-password-recovery.ts'],'adaptador UI Corridas aponta somente para arquivos do pin atual');
requireMarkers('.work/entregas/src/integrations/supabase/client.ts',['storageKey: "apois-superapp-entregas-auth-v1"'],'Entregas usa namespace de sessão próprio');
requireMarkers('.work/entregas/src/components/AuthSessionIsolation.tsx',['window.location.hash.startsWith("#/")'],'isolamento de sessão Entregas entende Hash History');
requireMarkers('.work/entregas/src/components/GoogleLoginButton.tsx',['function getNativeAuthCallback()','VITE_APOIS_NATIVE_SCHEME','__APOIS_SUPERAPP_AUTH_BRIDGE__'],'Google OAuth Entregas retorna pelo package unificado');
requireMarkers('.work/entregas/src/routes/register.tsx',['emailRedirectTo: "br.com.apois.app://auth/callback"'],'cadastro Entregas usa callback unificado');
requireMarkers('.work/entregas/src/routes/login.tsx',['redirectTo: "br.com.apois.app://auth/reset"'],'reset Entregas usa deep link unificado');
requireMarkers('.work/entregas/src/lib/customer-push.ts',['register_superapp_customer_push_device','_app_package: "br.com.apois.app"','const isDeliveryPush =','if (!target) return;'],'Push Entregas filtra produto e registra package correto');
forbidMarkers('.work/entregas/src/lib/customer-push.ts',['PushNotifications.unregister()'],'logout Entregas não invalida token FCM compartilhado');
requireMarkers('.work/entregas/src/routes/checkout.tsx',['const paymentMethod = "pix";'],'checkout Entregas permanece PIX-only');
requireMarkers('.work/entregas/src/components/AppBottomNav.tsx',['fixed bottom-0','min-h-[88px]','aria-label="Buscar"','<Search className="h-8 w-8" />'],'rodapé Entregas é fixo, legível e explícito');
if(failed)process.exit(1);console.log('[OK] Superapp dist reconciliado: Corridas atual + Entregas + shell validados.');
