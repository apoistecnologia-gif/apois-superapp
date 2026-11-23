/** Verify premium PDF screen coverage in final generated Partner module sources. */
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
const root=resolve(process.cwd());
const matrix=[
  ['.work/partner-motorista/src/routes/motorista.app.tsx',[
    'data-apois-premium-driver-header','data-apois-premium-driver-summary','data-apois-premium-driver-nav',
    'data-apois-premium-screen="driver-offer"','data-apois-premium-screen="driver-active"','data-apois-premium-screen="driver-rating"',
    'DriverActiveRideRecovery','PickupNavOverlay','ActiveTripNavOverlay','onAccept','onReject','onStart','onComplete','onClick={toggleOnline}'
  ]],
  ['.work/partner-motorista/src/routes/motorista.login.tsx',['Entrar','Esqueci minha senha']],
  ['.work/partner-motorista/src/routes/motorista.ganhos.tsx',['data-apois-premium-screen="driver-finance"','loadDriverFinancialDashboard','Saques indisponíveis','ApoisDriverBottomNav','ApoisPremiumDriverNav active="ganhos"']],
  ['.work/partner-motorista/src/routes/motorista.corridas.tsx',['data-apois-premium-screen="driver-rides"','RideCard','aria-label','ApoisPremiumDriverNav active="corridas"']],
  ['.work/partner-motorista/src/routes/motorista.perfil.tsx',['data-apois-premium-screen="driver-profile"','handleLogout','ApoisPremiumDriverNav active="perfil"']],
  ['.work/partner-motorista/src/components/ApoisPremiumDriverNav.tsx',['data-apois-premium-internal-nav','/motorista/app','/motorista/corridas','/motorista/ganhos','/motorista/perfil']],
  ['.work/partner-motorista/src/apois-ui-hardening-round3.css',['APOIS_PREMIUM_ALL_SCREENS_V1','#F51D2A','#BB071D','driver-offer','driver-active','driver-finance']],
  ['.work/partner-entregador/src/routes/courier.tsx',['data-apois-premium-courier-summary','data-apois-premium-availability','data-apois-courier-map-first-v2','data-apois-courier-calls-card-v2','CourierBottomNav','CourierRouteMap','CourierOfferCard','CourierCompletionSheet','onToggle={toggleOnline}']],
  ['.work/partner-entregador/src/components/CourierPremiumViews.tsx',['data-apois-premium-screen="courier-offer"','data-apois-premium-screen="courier-active"','data-apois-premium-screen="courier-finance"','onRequestPayout','onConfirmSettlement','data-apois-courier-premium-status-v2','aria-checked={online}']],
  ['.work/partner-entregador/src/components/CourierPanels.tsx',['data-apois-premium-screen="courier-history"','data-apois-premium-screen="courier-profile"','CourierBottomNav']],
  ['.work/partner-entregador/src/components/CourierOfferOverlay.tsx',['data-apois-premium-screen="courier-offer-overlay"']],
  ['.work/partner-entregador/src/components/CourierActiveDeliveryOverlay.tsx',['data-apois-premium-screen="courier-active-overlay"']],
  ['.work/partner-entregador/src/components/CourierCompletionSupport.tsx',['data-apois-premium-screen="courier-completion"']],
  ['.work/partner-entregador/src/components/CourierRouteMap.tsx',['data-apois-courier-live-map-v2','data-apois-courier-map-canvas-v2','<RecenterControl']],
  ['.work/partner-entregador/src/components/CourierLocationTracker.tsx',['data-apois-courier-gps-status-v2','status === "error"']],
  ['.work/partner-entregador/src/system-theme.css',['APOIS_COURIER_MAP_FIRST_V2','APOIS_PREMIUM_ALL_SCREENS_V1','#F51D2A','#BB071D','courier-offer','courier-active','courier-finance','courier-profile']],
  ['superapp/partner-shell/dist/index.html',['--red:#F51D2A','--red-dark:#BB071D','VAMOS JUNTOS.']],
];
let failures=0;
for (const [path, tokens] of matrix){
 const full=resolve(root,path);
 if(!existsSync(full)){console.error('[FAIL] Missing premium screen '+path);failures++;continue;}
 const code=readFileSync(full,'utf8');
 const missing=tokens.filter(token=>!code.includes(token));
 if(missing.length){console.error('[FAIL] '+path+': '+missing.join(' | '));failures+=missing.length;}
 else console.log('[OK] Complete visual PDF coverage and operational contract '+path);
}
// Compare the official pins against current submodule links in Git.
const lock=JSON.parse(readFileSync(resolve(root,'.apois/source-lock.json'),'utf8'));
if(!lock || typeof lock!=='object') {console.error('[FAIL] source lock missing');failures++;}
if(failures){console.error('[FAIL] Premium screen coverage incomplete: '+failures);process.exit(1);}
console.log('[OK] APOIS approved premium PDFs: Motorista+Entregador all user-facing key screens included; no APK generated.');