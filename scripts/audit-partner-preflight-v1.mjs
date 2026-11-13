import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

let failures=0;
function read(path){const full=resolve(path);if(!existsSync(full)){console.error("[FAIL] preflight file missing "+path);failures++;return "";}return readFileSync(full,"utf8");}
function all(source,markers,label){const missed=markers.filter(m=>!source.includes(m));if(missed.length){console.error("[FAIL] "+label+": "+missed.join(" / "));failures++;}else console.log("[OK] "+label);}
function check(value,label){if(!value){console.error("[FAIL] "+label);failures++;}else console.log("[OK] "+label);}
const shell=read("superapp/partner-shell/index.html");
const build=read("scripts/build-partner-release.sh");
all(shell,[
  "function partnerModuleUrl(target)",
  "new URL('/'+rootPath,window.location.origin).href",
  "routeRole(requestedRole,target)",
  "partnerModuleUrl(operationalHome(locked))",
  "const PARTNER_PENDING_PUSH_KEY=",
  "const PARTNER_OPERATIONAL_ROLE_KEY=",
  "if(launch?.url&&relayDeepLink(launch.url))return;",
], "Module URL normalization, deep links, push and role lock");
check(!shell.includes("modules/motorista/modules/motorista"),"No double module navigation path");
check(!shell.includes("window.location.assign('./modules/"),"Shell always resolves module URL to origin before assign");
all(build,[
  "harden-partner-motorista-profile-contrast-v2.mjs",
  "harden-partner-motorista-login-focus-v19.mjs",
  "harden-partner-motorista-google-pkce-v20.mjs",
  "harden-partner-courier-driver-inspired-home-v1.mjs",
  "harden-partner-courier-home-viewport-v3.mjs",
  "harden-partner-courier-map-client-style-v4.mjs",
  "harden-partner-courier-online-speed-v4.mjs",
  "harden-partner-courier-map-native-fallback-v3.mjs",
  "harden-partner-courier-inner-panels-v1.mjs",
  "harden-partner-courier-push-diagnostics-v1.mjs",
  "harden-partner-motorista-payment-policy.mjs",
  "harden-partner-entregador-map.mjs",
  "bun run typecheck",
  "npm run build:motorista",
  "bun run build",
], "Isolated partner module build and all patches integrated");


const courierCoverageAdmin=read("sources/apois-entregas/src/components/AdminCoveragePanel.tsx");
const courierAdminGates=read("sources/apois-entregas/src/components/AdminCourierOperationalGates.tsx");
const courierCoverageLogic=read("sources/apois-entregas/src/lib/courier-dispatch-readiness.ts");
const courierCommercialLogic=read("sources/apois-entregas/src/lib/courier-operation-readiness.ts");
all(courierCoverageAdmin, ["citiesNeedingDispatchRadius", "data-apois-courier-dispatch-readiness", "AdminCourierOperationalGates"], "Admin flags unconfigured courier radius with a configuration action");
all(courierCoverageLogic, ["courier_dispatch_radius_km", "citiesWithoutCourierDispatch", "radius > 0 && radius <= 100"], "Courier dispatch requires explicit independent radius, not customer radius");
all(courierAdminGates, ["paymentProviderBlockingOrders", "merchantSubscriptionDateWarnings", "data-apois-courier-operations-readiness"], "Admin warns about actual Safe2Pay and subscription blockers");
all(courierCommercialLogic, ["current_period_end", "last_payment_status", "safe2pay_marketplace"], "Merchant subscription/payment readiness remains fail-closed");
all(build, ["bun test src/lib/courier-dispatch-readiness.test.ts src/lib/courier-operation-readiness.test.ts"], "Courier readiness tests run in the real Partner module build");
// Catch the exact JSX regression that previously reached TypeScript TS1005:
const journeyGenerator=read("scripts/fix-partner-courier-simple-journey-v1.mjs");
const journeyLiteral=journeyGenerator.match(/^const component=(.*);$/m);
let journeyComponentClosed=false;
if(journeyLiteral){
  try {
    const jsx=JSON.parse(journeyLiteral[1]);
    journeyComponentClosed=jsx.includes("export function ActiveDelivery(") &&
      jsx.trimEnd().endsWith(");\n}") &&
      jsx.includes("Código de entrega (PIN)") &&
      jsx.includes("PEDIDO RETIRADO");
  } catch {}
}
check(journeyComponentClosed,"Simplified courier ActiveDelivery closes its JSX and function before CourierFinance");

const courierRoute=read("sources/apois-entregas/src/routes/courier.tsx");
const courierMap=read("sources/apois-entregas/src/components/CourierRouteMap.tsx");
const courierOffers=read("sources/apois-entregas/src/components/CourierOfferOverlay.tsx");
const driverRoute=read("sources/apois-corridas-motorista-admin/src/routes/motorista.perfil.tsx");
all(courierRoute,[
  "set_courier_online",
  "accept_delivery_offer",
  "transitionDelivery",
  "completeDelivery",
  "<CourierRouteMap",
  "CourierLocationTracker",
  "CourierBottomNav",
], "Courier journey, offer acceptance, tracking and navigation remain intact");
all(courierMap,[
  "computeRoutes",
  "goingToDelivery",
  "job.pickup_latitude",
  "job.delivery_latitude",
  "RouteMapContent",
], "Courier two-leg route retained (merchant and customer)");
all(courierOffers,[
  "AudioContext",
  "pulseAlert",
  "stopAlert",
  "alertTimerRef",
  "navigator.vibrate",
  "accept_delivery_offer",
], "Courier ringtone, vibration, lifecycle and accept/reject retained");
all(driverRoute,[
  "function DriverProfilePage()",
  "ProfilePhotoUploader",
  "MovviHeader",
], "Motorista source profile and uploads preserved");
const driverFix=read("scripts/harden-partner-motorista-profile-contrast-v2.mjs");
const courierAvatarPolicy=read("supabase/entregas-forward-migrations/courier_profile_avatar_scoped_upload.sql");
all(courierAvatarPolicy,[
  "APOIS courier own profile avatar upload",
  "FOR INSERT TO authenticated",
  "(storage.foldername(name))[1] = (SELECT auth.uid())::text",
  "(storage.foldername(name))[2] = 'courier-profile'",
  "apois_can_upload_own_courier_avatar()",
  "c.status = 'approved'",
  "c.is_active IS TRUE",
  "p.is_active IS TRUE",
  "REVOKE ALL ON FUNCTION public.apois_can_upload_own_courier_avatar() FROM PUBLIC, anon"
], "Pending scoped courier avatar policy, no production grant");
const courierAvatarDiagnostics=read("scripts/fix-partner-courier-avatar-diagnostics-v1.mjs");
all(courierAvatarDiagnostics,[
  "APOIS_COURIER_AVATAR_UPLOAD_DIAGNOSTIC_V1",
  'user.id + "/courier-profile/"',
  "upsert: false"
], "Courier own-profile avatar diagnostics");
all(build,["fix-partner-courier-avatar-diagnostics-v1.mjs"],"Avatar QA patch integrated in Partner build");
const courierFix=read("scripts/harden-partner-courier-driver-inspired-home-v1.mjs");
all(driverFix,["data-apois-driver-profile-v2","max-w-full break-words","text-[#111827]"],"Driver pinned profile patch");
all(courierFix,[
  "data-apois-courier-inline-status",
  "CourierStatusCard",
  "CourierWaitingSheet",
  "ColorScheme.LIGHT",
], "Courier map-first inline home patch");
check(!courierFix.includes("position:fixed;"),"Courier availability layout has no fixed overlay");
check(!courierFix.includes("data-apois-courier-floating-status"),"Courier floating panel removed");
const routeLock=read("scripts/harden-partner-entregador-operational-lock.mjs");
const driverLock=read("scripts/harden-partner-motorista-operational-lock.mjs");
all(routeLock,["apois-parceiro:operational-role","stopCourierNativeLocation","removeCourierPushRegistration"],"Courier operational lock");
all(driverLock,["apois-parceiro:operational-role","SIGNED_OUT"],"Driver operational lock");
const partnerMap=read("scripts/harden-partner-entregador-map.mjs");
all(partnerMap,["strokeColor: APOIS_RED","VITE_GOOGLE_MAPS_API_KEY"],"APOIS route branding and Maps key");

if(process.argv.includes("--dist")){
  const courierPatched=read(".work/partner-entregador/src/routes/courier.tsx");
  const mapPatched=read(".work/partner-entregador/src/components/CourierRouteMap.tsx");
  const driverPatched=read(".work/partner-motorista/src/routes/motorista.perfil.tsx");
  all(read(".work/partner-entregador/src/components/CourierPanels.tsx"),["data-apois-courier-new-membership-rate-v1","R$ 49,90","não gera pagamento"],"Courier commercial rate remains informational until real billing integration");
  const driverMonthlyFee=read(".work/partner-motorista/src/lib/payments/types.ts");
  const driverMembershipPage=read(".work/partner-motorista/src/routes/motorista.assinatura.tsx");
  all(driverMonthlyFee,["APOIS_MONTHLY_FEE_BRL = 59.9"],"New Driver fee 59.90 applied to disposable workspace");
  all(driverMembershipPage,[
    "APOIS_DRIVER_NEW_MONTHLY_FEE_5990_V1",
    '.from("driver_memberships")',
    "contractMonthlyFee === null",
    "Pagamento eletrônico temporariamente indisponível"
  ],"Driver membership page preserves the legacy contract-specific amount");

  const driverBroadcastPatched=read(".work/partner-motorista/src/hooks/useDriverBroadcast.ts");
  all(driverBroadcastPatched,["APOIS_DRIVER_PRESENCE_ACK_V1",'if (desiredOnline && !presenceConfirmed) throw new Error("presence_rejected_by_server")','new CustomEvent("apois:driver-presence-rejected"'], "Motorista server presence ACK must surface RPC failure");
  const driverAppPatched=read(".work/partner-motorista/src/routes/motorista.app.tsx");
  const driverLoginFocus=read(".work/partner-motorista/src/routes/motorista.login.tsx");
  const driverCssFocus=read(".work/partner-motorista/src/styles.css");
  const driverSupabaseAuth=read(".work/partner-motorista/src/integrations/supabase/client.ts");
  const driverGoogleButton=read(".work/partner-motorista/src/components/DriverGoogleLoginButton.tsx");
  all(driverSupabaseAuth,['flowType: "pkce"', 'APOIS_PARTNER_MOTORISTA_GOOGLE_PKCE_V20',"persistSession: true","autoRefreshToken: true","createSupabaseFetch"],"Motorista Google PKCE enabled in the same persistent Supabase client");
  all(driverGoogleButton,['const CALLBACK = "br.com.apois.parceiro://auth/motorista-google";',"googleCallbackProcessingRef.current = true;","googleCallbackProcessingRef.current = false;","google_callback_tokens_rejected","exchangeCodeForSession(code)","isDriverCallback(rawUrl)","Browser.open({ url: data.url })","const FORWARDED_KEY"],"Motorista native Google PKCE callback is validated and deduplicated");
  check(!driverGoogleButton.includes('setSession({ access_token:'),"Motorista Google does not accept implicit bearer tokens in deep links");
  check((driverGoogleButton.match(/googleCallbackProcessingRef.current = true;/g)||[]).length===1,"Motorista Google callback has one idempotence guard");
  all(shell,['const DRIVER_GOOGLE_KEY=',"path==='motorista-google'","sessionStorage.setItem(DRIVER_GOOGLE_KEY,rawUrl)"],"Partner shell forwards Motorista Google callback without modifying callback code");

  all(driverCssFocus,["APOIS_MOTORISTA_INPUT_FOCUS_V19",'input[name="email"]:focus-visible','input[name="password"]:focus-visible',"outline: none !important;","border: 0 !important;"],"Motorista email/password fields suppress squared WebView focus outline");
  check((driverLoginFocus.match(/focus-within:border-\[#AEB7C4\]/g)||[]).length===2,"Motorista email and password retain subtle rounded focus indicator");
  check(!driverLoginFocus.includes("focus-within:border-[#E51B23] focus-within:ring-2"),"Motorista login no longer draws an aggressive red focus outline");
  all(driverLoginFocus,["DriverGoogleLoginButton","showPassword","onSubmit={onSubmit}","/motorista/cadastro","/motorista/recuperar-senha"],"Motorista login credentials, Google, password visibility, recovery and registration retained");

  const offersPatched=read(".work/partner-entregador/src/components/CourierOfferOverlay.tsx");
  const waitingPatched=read(".work/partner-entregador/src/components/CourierPremiumViews.tsx");
  const courierPanels=read(".work/partner-entregador/src/components/CourierPanels.tsx");
  const courierTheme=read(".work/partner-entregador/src/system-theme.css");
  all(courierPatched,["data-apois-courier-map-home","data-apois-courier-inline-status","CourierStatusCard","CourierRouteMap"],"Built courier home integrated");
  const courierLiveMap = mapPatched.slice(mapPatched.indexOf("export function CourierLiveMap("),mapPatched.indexOf("export function CourierRouteMap("));
  const courierOnlineToggle = courierPatched.slice(courierPatched.indexOf("  const toggleOnline = async () => {"),courierPatched.indexOf("\n  const acceptOffer = async",courierPatched.indexOf("  const toggleOnline = async () => {")));
  const courierStatusCard = waitingPatched.slice(waitingPatched.indexOf("export function CourierStatusCard("),waitingPatched.indexOf("export function CourierWaitingSheet("));
  // QA218: the approved courier-exclusive cloud vector map intentionally
  // replaces inline 'styles' with Map ID + palette fallback. Verify BOTH gates
  // instead of expecting the old inline-only style and rejecting valid APKs.
  if (mapPatched.includes("APOIS_COURIER_EXCLUSIVE_VECTOR_MAP_20261112_V1")) {
    all(mapPatched,[
      "APOIS_COURIER_CLIENT_MAP_V4",
      "const APOIS_COURIER_MAP_STYLE: google.maps.MapTypeStyle[]",
      "CourierStyledLiveMarkers",
      "mapId={useCourierCloudMap ? courierCloudMapId : null}",
      "styles={useCourierCloudMap ? null : APOIS_COURIER_MAP_STYLE}",
      '"#0B2944"','"#EDEAE4"',
    ], "Courier cloud vector Map ID and official inline fallback both preserved");
  } else {
  all(mapPatched,["APOIS_COURIER_CLIENT_MAP_V4","const APOIS_COURIER_MAP_STYLE: google.maps.MapTypeStyle[]","CourierStyledLiveMarkers","styles={APOIS_COURIER_MAP_STYLE}","\"#0B2944\"","\"#EDEAE4\""],"Courier home reuses actual APOIS Cliente map colors");
  }
  check(!courierLiveMap.includes("mapId={mapId}"),"Courier home does not combine local styles with incompatible cloud mapId");
  check(!courierLiveMap.includes("<AdvancedMarker"),"Courier home replaces advanced markers incompatible with styled classic map");
  all(courierOnlineToggle,["APOIS_COURIER_FAST_ONLINE_V4","Date.now() - currentPosition.recordedAt <= 20_000","accuracy <= 100","rpc(\"bootstrap_courier_location\"","rpc(\"set_courier_online\"","backgroundStarted = await startCourierNativeLocation();","ensureCourierPushRegistration(true)","setAvailability((previous: any) => ({ ...(previous ?? {}), is_online: true }))","setAvailability((previous: any) => ({ ...(previous ?? {}), is_online: false }))","void loadCourierOperations(courier.id).catch"],"Online activation is server-confirmed, non-blocking after validation and uses recent GPS safely");
  check(!courierOnlineToggle.includes("await loadCourierOperations(courier.id);"),"Online button does not await unrelated metrics, history, wallet and merchant queries");
  all(courierStatusCard,["relative h-11 w-[3.7rem]","absolute top-1.5 grid h-8 w-8","aria-busy={busy || undefined}","aria-pressed={online}"],"Courier online switch compact and accessible without loss of controls");

  check((courierPatched.match(/<CourierStatusCard\b/g)||[]).length===1,"One online availability control in courier home");
  all(mapPatched,["h-[clamp(235px,36dvh,375px)]"],"Idle courier map uses responsive height fitting Android viewport");
  all(courierPanels,["data-apois-courier-bottom-nav","bg-white","min-h-[62px]","min-h-[54px]","pb-[max(8px,env(safe-area-inset-bottom))]"],"Courier nav compact and light with safe area");
  check(!courierPanels.slice(courierPanels.indexOf("export function CourierBottomNav("),courierPanels.indexOf("function PanelHeader(")).includes("linear-gradient(180deg,rgba(5,5,5,0.94),#000)"),"Courier nav has no legacy black overlay");
  all(courierTheme,["APOIS_COURIER_VIEWPORT_V3","background-image:none!important","data-apois-courier-bottom-nav"],"Courier stylesheet explicitly removes black nav background image");
  check(!waitingPatched.slice(waitingPatched.indexOf("export function CourierStatusCard("),waitingPatched.indexOf("export function CourierWaitingSheet(")).includes("truncate text-lg"),"Courier status ONLINE/OFFLINE can wrap instead of being cut");
  all(courierTheme,["padding-bottom:calc(5rem + env(safe-area-inset-bottom))!important"],"Courier content reserves compact nav height");

  check(!courierPatched.includes("data-apois-courier-floating-status"),"No fixed courier availability");
  all(mapPatched,["ColorScheme.LIGHT","mapPosition","Geolocation.getCurrentPosition"],"Built courier native GPS and light map");
  all(driverPatched,["data-apois-driver-profile-v3","text-[#111827]","ProfilePhotoUploader","signOutDriverOnThisDevice","Ver status do cadastro"],"Built driver profile V3, uploads and logout intact");
  all(read(".work/partner-motorista/src/routes/motorista.app.tsx"),["data-apois-pin-v4","createPortal(","document.body","Confirmar PIN e iniciar corrida","disabled={pinBusy || pinCode.length !== 4}","await onStart(pinCode)","data-apois-ride-phase-v4","data-apois-pickup-bottom-v4"],"Motorista PIN V4 always visible and original start action preserved");
  all(read(".work/partner-motorista/src/styles.css"),["APOIS_DRIVER_PIN_RIDE_V4","data-apois-pickup-top-v4","data-apois-pin-v4"],"Motorista ride and PIN theme independent of global dark CSS");

  all(read(".work/partner-motorista/src/components/MovviMap.tsx"),[
    'isDriverRole ? getMapStyleForTheme("light") : getMapStyleForTheme(theme)',
    'isDriverRole ? getMapBackgroundForTheme("light") : getMapBackgroundForTheme(theme)',
    "clickableIcons: isDriverRole",
  ],"Motorista uses APOIS client light map palette with visible road/city labels");
  all(read(".work/partner-motorista/src/components/ApoisExternalNavigation.tsx"),[
    'registerPlugin<ExternalPlugin>("APOISExternalNavigation")',
    'https://www.google.com/maps/dir/?api=1&destination=',
    'https://waze.com/ul?ll=',
    'INICIAR NAVEGAÇÃO',
    'setOperation({ role, active })',
  ],"Motorista uses official external Google Maps/Waze navigation, without internal turn-by-turn voice");
  check(!driverAppPatched.includes("tickNavigation("),"Motorista does not repeat third-party turn-by-turn voice in APOIS");
  all(driverAppPatched,[
    "const NAVIGATION_ZOOM = 17;",
    "APOIS_DRIVER_FORWARD_CAMERA_V1",
    "APOIS_DRIVER_QA209_CAMERA_V1",
    "driverCameraHistory",
    "movedMeters < 9",
    "now-previous.at < 1400",
    "navMap.moveCamera({",
    "tilt:nearDestination ? 0 : 25",
    "res.distanceMeters < directMeters * 0.55",
    "setLegKm(null); setEtaSeconds(null);",
    'ApoisExternalNavigation latitude={ride.origin_lat}',
    'ApoisExternalNavigation latitude={ride.destination_lat}',
    'useApoisOperationalNotification("motorista", Boolean(active))',
    "onStart(pinCode)",
    "onClick={handleComplete}",
  ],"Motorista preserves route plausibility and ride lifecycle while opening external navigation");

  all(driverAppPatched,["data-apois-trip-top-v6","data-apois-trip-bottom-v6","onShowRoute","onRecenter","m.fitBounds"],"Motorista V6 keeps route overview and compact light panels");
  all(driverAppPatched,["APOIS_DRIVER_PRESENCE_ACK_V1",'window.addEventListener("apois:driver-presence-rejected", handlePresenceRejection)',"setDesiredOnline(false);","stopDriverWatch();"],"Motorista cannot remain phantom ONLINE after RPC rejection");

  all(driverAppPatched,["APOIS_ASSIGNED_PASSENGER_V6","apois_driver_assigned_passenger"],"Passenger name lookup is confined to assigned ride and protected RPC");
  all(read(".work/partner-motorista/src/components/DriverVoiceToggle.tsx"),["Voz ligada","Voz desligada","setVoiceEnabled(next)"],"Driver retains optional operational voice controls");
  all(read(".work/partner-motorista/src/styles.css"),["APOIS_DRIVER_TRIP_V6"],"Driver V6 readable passenger and trip palette");
  all(read(".work/partner-motorista/src/lib/driverLocalSignOut.ts"),['scope: "local"','window.location.replace','sb-'],"Motorista logout local with offline fallback");
  all(offersPatched,["APOIS_PARTNER_LOGO_DATA_URL","apois:courier-offer-accepted","AudioContext","stopAlert","pulseAlert"],"Built courier offer modal, ringtone and immediate route refresh");
  all(courierPatched,["window.addEventListener(\"apois:courier-offer-accepted\", refresh)","window.removeEventListener(\"apois:courier-offer-accepted\", refresh)"],"Courier updates active route on accepted offer");
  all(waitingPatched,["Aguardando chamadas","Atualizar ofertas","Ganhos hoje","Entregas hoje","Tempo online","earnings_today","completed_deliveries","online_seconds_today"],"Compact courier waiting sheet retains metrics and refresh");
  check(courierPatched.includes("<CourierWaitingSheet"),"Courier home still displays compact metrics during idle online");
  check(existsSync("superapp/partner-shell/dist/index.html"),"Partner chooser included");
  check(existsSync("superapp/partner-shell/dist/modules/motorista/index.html"),"Driver module copied");
  check(existsSync("superapp/partner-shell/dist/modules/entregador/index.html"),"Courier module copied");
  check(!existsSync("build/APOIS-Parceiro-TESTE.apk"),"Preflight did not generate an Android APK");
}
const { spawnSync } = await import('node:child_process');
const guardResult = spawnSync(process.execPath, ['scripts/test-driver-registration-guard-review-v1.mjs'], { stdio: 'inherit' });
check(!guardResult.error && guardResult.status === 0, 'Driver registration review-only guard contract');
const redispatchResult = spawnSync(process.execPath, ['scripts/qa/verify-corridas-redispatch-contract-v1.mjs'], { stdio: 'inherit' });
check(!redispatchResult.error && redispatchResult.status === 0, 'Corridas ride offer rejection/cancel redispatch dependencies staged (not deployed)');
if(failures)process.exit(1);
console.log("[OK] APOIS Partner web preflight: all scoped static and integration assertions passed.");
