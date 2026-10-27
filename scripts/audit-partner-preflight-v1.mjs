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
  "harden-partner-courier-driver-inspired-home-v1.mjs",
  "harden-partner-courier-home-viewport-v3.mjs",
  "harden-partner-courier-map-native-fallback-v3.mjs",
  "harden-partner-courier-inner-panels-v1.mjs",
  "harden-partner-courier-push-diagnostics-v1.mjs",
  "harden-partner-motorista-payment-policy.mjs",
  "harden-partner-entregador-map.mjs",
  "bun run typecheck",
  "npm run build:motorista",
  "bun run build",
], "Isolated partner module build and all patches integrated");

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
  const offersPatched=read(".work/partner-entregador/src/components/CourierOfferOverlay.tsx");
  const waitingPatched=read(".work/partner-entregador/src/components/CourierPremiumViews.tsx");
  const courierPanels=read(".work/partner-entregador/src/components/CourierPanels.tsx");
  const courierTheme=read(".work/partner-entregador/src/system-theme.css");
  all(courierPatched,["data-apois-courier-map-home","data-apois-courier-inline-status","CourierStatusCard","CourierRouteMap"],"Built courier home integrated");
  check((courierPatched.match(/<CourierStatusCard\b/g)||[]).length===1,"One online availability control in courier home");
  all(mapPatched,["h-[clamp(235px,36dvh,375px)]"],"Idle courier map uses responsive height fitting Android viewport");
  all(courierPanels,["data-apois-courier-bottom-nav","bg-white","min-h-[62px]","min-h-[54px]","pb-[max(8px,env(safe-area-inset-bottom))]"],"Courier nav compact and light with safe area");
  check(!courierPanels.slice(courierPanels.indexOf("export function CourierBottomNav("),courierPanels.indexOf("function PanelHeader(")).includes("linear-gradient(180deg,rgba(5,5,5,0.94),#000)"),"Courier nav has no legacy black overlay");
  all(courierTheme,["APOIS_COURIER_VIEWPORT_V3","background-image:none!important","data-apois-courier-bottom-nav"],"Courier stylesheet explicitly removes black nav background image");
  check(!waitingPatched.slice(waitingPatched.indexOf("export function CourierStatusCard("),waitingPatched.indexOf("export function CourierWaitingSheet(")).includes("truncate text-lg"),"Courier status ONLINE/OFFLINE can wrap instead of being cut");
  all(courierTheme,["padding-bottom:calc(5rem + env(safe-area-inset-bottom))!important"],"Courier content reserves compact nav height");

  check(!courierPatched.includes("data-apois-courier-floating-status"),"No fixed courier availability");
  all(mapPatched,["ColorScheme.LIGHT","mapPosition","Geolocation.getCurrentPosition"],"Built courier native GPS and light map");
  all(driverPatched,["data-apois-driver-profile-v2","text-[#111827]","ProfilePhotoUploader"],"Built driver profile contrast with uploads intact");
  all(offersPatched,["APOIS_PARTNER_LOGO_DATA_URL","apois:courier-offer-accepted","AudioContext","stopAlert","pulseAlert"],"Built courier offer modal, ringtone and immediate route refresh");
  all(courierPatched,["window.addEventListener(\"apois:courier-offer-accepted\", refresh)","window.removeEventListener(\"apois:courier-offer-accepted\", refresh)"],"Courier updates active route on accepted offer");
  all(waitingPatched,["Aguardando chamadas","Atualizar ofertas","Ganhos hoje","Entregas hoje","Tempo online","earnings_today","completed_deliveries","online_seconds_today"],"Compact courier waiting sheet retains metrics and refresh");
  check(courierPatched.includes("<CourierWaitingSheet"),"Courier home still displays compact metrics during idle online");
  check(existsSync("superapp/partner-shell/dist/index.html"),"Partner chooser included");
  check(existsSync("superapp/partner-shell/dist/modules/motorista/index.html"),"Driver module copied");
  check(existsSync("superapp/partner-shell/dist/modules/entregador/index.html"),"Courier module copied");
  check(!existsSync("build/APOIS-Parceiro-TESTE.apk"),"Preflight did not generate an Android APK");
}
if(failures)process.exit(1);
console.log("[OK] APOIS Partner web preflight: all scoped static and integration assertions passed.");
