import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

let failed = false;
const read = (path) => {
  const full = resolve(path);
  if (!existsSync(full)) {
    console.error(`[FAIL] Entregador runtime v3: arquivo ausente ${path}`);
    failed = true;
    return '';
  }
  return readFileSync(full, 'utf8');
};
const requireAll = (path, markers, label) => {
  const source = read(path);
  if (!source) return;
  const missing = markers.filter((marker) => !source.includes(marker));
  if (missing.length) {
    console.error(`[FAIL] ${label}: ${missing.join(' | ')}`);
    failed = true;
  } else console.log(`[OK] ${label}`);
};
const forbidAll = (path, markers, label) => {
  const source = read(path);
  if (!source) return;
  const found = markers.filter((marker) => source.includes(marker));
  if (found.length) {
    console.error(`[FAIL] ${label}: ${found.join(' | ')}`);
    failed = true;
  } else console.log(`[OK] ${label}`);
};

requireAll('scripts/harden-partner-entregador-online-bootstrap.mjs', [
  'rpc("bootstrap_courier_location"',
  'const { error: onlineError } = await rpc("set_courier_online"',
  'toggleBlock.includes(\'rpc("update_courier_location"\')',
], 'Entregador elimina deadlock GPS/offline antes de ficar online');

requireAll('supabase/migrations/20260822013000_allow_secure_courier_location_bootstrap_before_online.sql', [
  'create or replace function public.bootstrap_courier_location',
  "c.status = 'approved'",
  'c.is_active = true',
  'private.courier_max_location_accuracy_meters()',
  'revoke all on function public.bootstrap_courier_location',
  'grant execute on function public.bootstrap_courier_location',
], 'Bootstrap GPS é restrito, valida precisão e não fica exposto a anon/public');

requireAll('scripts/harden-partner-entregador-gps-resume.mjs', [
  'const clearNativeWatch = async () =>',
  'const restartNativeTracking = async () =>',
  'App.addListener("appStateChange"',
  'void restartNativeTracking().catch(receiveError);',
  'Uma falha temporária de GPS não deve apagar a última posição válida',
  'void appStateHandle?.remove();',
], 'GPS do Entregador é rearmado ao voltar do background sem desmontar rota por falha transitória');

requireAll('scripts/harden-partner-entregador-active-tracking.mjs', [
  'const online = Boolean(availability?.is_online) || Boolean(activeJob);',
  '<CourierLocationTracker enabled={online} onPosition={setCurrentPosition} />',
  'disabled={Boolean(activeJob || completedJob)}',
  'Perfil indisponível durante a entrega',
  '{!activeJob && !completedJob ? (',
], 'Entrega ativa mantém rastreamento e trava perfil/rodapé para não abandonar a jornada');

requireAll('scripts/harden-partner-entregador-quiet-refresh.mjs', [
  'if (quiet) {',
  'setOperationsError',
  'setAppError',
], 'Refresh silencioso não substitui operação ativa por erro de tela cheia');

requireAll('scripts/harden-partner-entregador-push-runtime.mjs', [
  '"pushNotificationReceived"',
  'const delivery = isDeliveryPushPayload(data);',
  'const ride = isRidePushPayload(data);',
  'if (delivery && ride) return;',
  'sessionStorage.setItem(PARTNER_PENDING_PUSH_KEY',
  'new CustomEvent("apois:courier-push-open"',
], 'Push do Entregador isola entrega/corrida, foreground e toque sem alternância indevida');
requireAll('scripts/harden-partner-entregador-push-runtime.mjs', [
  "if (source.includes('PushNotifications.unregister()'))",
  'runtime não pode invalidar o token FCM compartilhado',
], 'Entregador protege o token FCM compartilhado contra unregister');

requireAll('scripts/harden-partner-entregador-state-handoff.mjs', [
  'const activeJobIdentity = activeJob?.id ?? null;',
  '\'setPin("");\'',
  'setSupportOpen(false);',
  'setSupportDescription("");',
  'if (activeJobIdentity) setOffers([]);',
  'if (courier?.id) void loadCourierOperations(courier.id);',
], 'Troca/conclusão de entrega limpa PIN, suporte e ofertas antigas');

requireAll('scripts/harden-partner-entregador-action-timeouts.mjs', [
  'const acceptedOfferId = offerId;',
  'const rejectedOfferId = offerId;',
  'const transitionJobId = activeJob.id;',
  'const completionJobId = activeJob.id;',
  'const supportJobId = activeJob.id;',
  'COURIER_ACTION_TIMEOUT_MS = 20_000',
  'current === "delivery" ? null : current',
  'current === "support" ? null : current',
], 'Aceitar, recusar, transicionar, concluir e suporte não ficam presos em busy infinito');

requireAll('scripts/harden-partner-entregador-profile.mjs', [
  "replaceAll('Carteira e saques', 'Ganhos e repasses')",
  "replaceAll('Disponível {money(wallet?.available_balance)}', 'Registrado {money(wallet?.available_balance)}')",
  'Trocar perfil de parceiro',
  "window.location.replace('../../index.html')",
], 'Perfil do Entregador remove linguagem de saque e permite voltar ao seletor Parceiro');

requireAll('scripts/harden-partner-entregador-finance-runtime.mjs', [
  'Recebimento direto ainda está em homologação.',
  'Saque manual está desativado.',
], 'Runtime do Entregador deixa apenas bloqueio explícito enquanto repasse direto não está homologado');

requireAll('scripts/harden-partner-entregador-privacy.mjs', [
  'registros necessários à conciliação de ganhos e repasses',
  'Chave PIX e solicitação manual de saque também não são coletadas',
  'nos fluxos financeiros efetivamente habilitados',
], 'Privacidade do Entregador não declara carteira/saque/PIX-only que não estejam habilitados');

requireAll('scripts/harden-partner-entregador-terms.mjs', [
  'As formas de pagamento e os fluxos financeiros disponíveis dependem das funcionalidades efetivamente habilitadas',
  'O aplicativo não oferece saque manual nem coleta chave PIX',
  'registros financeiros ou áreas administrativas de terceiros',
], 'Termos do Entregador refletem homologação real e não prometem funcionalidades financeiras antigas');

requireAll('scripts/harden-partner-entregador-map.mjs', [
  "import './harden-partner-entregador-online-bootstrap.mjs';",
  "import './harden-partner-entregador-active-tracking.mjs';",
  "import './harden-partner-entregador-gps-resume.mjs';",
  "import './harden-partner-entregador-quiet-refresh.mjs';",
  "import './harden-partner-entregador-push-runtime.mjs';",
  "import './harden-partner-entregador-state-handoff.mjs';",
  "import './harden-partner-entregador-profile.mjs';",
  "import './harden-partner-entregador-finance-runtime.mjs';",
  "import './harden-partner-entregador-privacy.mjs';",
  "import './harden-partner-entregador-terms.mjs';",
], 'Umbrella real do Entregador executa bootstrap, tracking ativo, GPS, Push, perfil, payout lockdown, legal e handoff');

requireAll('superapp/partner-shell/index.html', [
  'const isDelivery=Boolean(orderId)',
  'const isRide=Boolean(rideId)',
  'if(isDelivery&&isRide)return false;',
  "if(isDelivery)return routeRole('entregador',operationalUrls.entregador);",
  "if(isRide)return routeRole('motorista',operationalUrls.motorista);",
  "localStorage.setItem('apois-parceiro:last-module',requestedRole)",
], 'Shell do Parceiro não decide payload ambíguo e roteia por produto explícito');

requireAll('superapp/partner-shell/package.json', [
  '"@capacitor/app"',
  '"@capacitor/browser"',
  '"@capacitor/geolocation"',
  '"@capacitor/push-notifications": "8.1.2"',
], 'Host nativo do Parceiro instala App, Browser, GPS e Push usados pelos módulos');

requireAll('scripts/verify-partner-native-plugins.mjs', [
  "'@capacitor/push-notifications'",
  "'PushNotificationsPlugin'",
  "'GeolocationPlugin'",
  'capacitor.plugins.json',
], 'Empacotamento valida que Push/GPS Capacitor foram registrados pelo cap sync');

requireAll('scripts/install-partner-driver-location.mjs', [
  'DriverLocationPlugin.java',
  'DriverLocationService.java',
  'registerPlugin(DriverLocationPlugin.class)',
  'android.permission.FOREGROUND_SERVICE_LOCATION',
  'android:name=".DriverLocationService"',
  'com.google.android.gms:play-services-location:21.3.0',
  'driver_set_presence',
  'ACCESS_BACKGROUND_LOCATION reapareceu indevidamente',
], 'Host Parceiro instala o Foreground Service nativo necessário ao GPS do Motorista em background');

requireAll('scripts/install-partner-launcher.mjs', [
  "import './install-partner-driver-location.mjs';",
  "await import('./verify-partner-native-plugins.mjs');",
  'registerPlugin(DriverLocationPlugin.class)',
  'android.permission.FOREGROUND_SERVICE_LOCATION',
], 'Launcher valida plugins Capacitor e DriverLocation customizado depois dos hardeners, antes de empacotar');

requireAll('scripts/install-partner-splash.mjs', [
  'apois_partner_splash.xml',
  'windowSplashScreenBackground',
  'windowSplashScreenAnimatedIcon',
  '@mipmap/ic_launcher',
  '#050505',
  'Splash padrão do template Android permaneceu ativo no Parceiro.',
], 'Splash nativo do Parceiro usa fundo preto e identidade APOIS em vez do template Android');

requireAll('codemagic.yaml', [
  'node scripts/install-partner-splash.mjs',
  'drawable/apois_partner_splash.xml',
  'windowSplashScreenBackground">#050505<',
  'windowSplashScreenAnimatedIcon">@mipmap/ic_launcher<',
], 'Codemagic instala e valida splash APOIS antes de compilar o APK Parceiro');

requireAll('scripts/harden-partner-entregador-finance.mjs', [
  'Recebimento direto em homologação',
  'Nenhuma chave PIX ou valor de saque é solicitado nesta fase.',
  'Histórico de repasses',
], 'Financeiro do Entregador não promete saque antes de marketplace direto');
requireAll('scripts/harden-partner-entregador-finance.mjs', [
  "'<h2 className=\"font-black\">Solicitar saque</h2>'",
  "'>Salvar chave PIX<'",
  'if (source.includes(forbidden))',
  'UI financeira legada permaneceu',
], 'Financeiro do Entregador bloqueia CTA legado de saque/PIX na UI transformada');

requireAll('scripts/configure-partner-android.mjs', [
  'android:scheme="br.com.apois.parceiro"',
  'legacyPartnerMpFilterPattern',
  'callback Mercado Pago legado do app cliente permaneceu',
], 'Android Parceiro remove callback Mercado Pago do app cliente e mantém scheme próprio');
forbidAll('scripts/configure-partner-android.mjs', [
  'if (!manifest.includes(\'android:scheme="br.com.apois.app"\'))',
], 'Configurador Android não recria callback legado br.com.apois.app');

requireAll('superapp/partner-shell/capacitor.config.ts', [
  "appId: 'br.com.apois.parceiro'",
  "style: 'LIGHT'",
  "backgroundColor: '#050505'",
], 'Host Parceiro usa package correto e ícones claros na barra de status escura');
forbidAll('superapp/partner-shell/capacitor.config.ts', [
  "style: 'DARK'",
], 'Barra de status do Parceiro não usa ícones escuros sobre fundo preto');

process.exit(failed ? 1 : 0);
