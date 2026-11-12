// APOIS_PASSENGER_QA215_COMPLETED_SAFE_AREA_V1.
// 211747.mp4: finished-ride return button is behind Android navigation bar.
// Change only isolated Corridas finished summary layout. Keep rating RPC,
// deliberate rating/skip choice, 3.2s timed return and all ride/server state.
import {readFileSync,writeFileSync} from "node:fs";
import {resolve} from "node:path";
const file=resolve(process.env.APOIS_CORRIDAS_WORKSPACE||".work/corridas","src/routes/_authenticated.corrida.$rideId.tsx");
let s=readFileSync(file,"utf8");
const marker="data-apois-completed-safe-area-qa215";
if(s.includes(marker))throw Error("[FAIL] QA215 completed safe-area duplicate");
const anchor='data-apois-completed-summary-v2 className="flex min-h-[100dvh] flex-col';
if(s.split(anchor).length!==2)throw Error("[FAIL] QA215 dedicated completed summary anchor missing");
s=s.replace(anchor,
 'data-apois-completed-summary-v2 '+marker+'="true" '+
 'style={{ paddingBottom: "max(104px, env(safe-area-inset-bottom, 0px))" }} '+
 'className="flex min-h-[100dvh] flex-col');
for(const must of [
 marker,'screenState === "completed"','<PassengerDriverRating rideId={ride.id}',
 'onRated={() => {setRatingDecision(true);void refreshRide();}}',
 'onSkip={() => setRatingDecision(true)}',
 'finishHomeActionRef.current()', '3200',
 'onClick={handleReturnHome}','Voltar ao início'
])if(!s.includes(must))throw Error("[FAIL] QA215 completed screen lost "+must);
writeFileSync(file,s,"utf8");
console.log("[OK] QA215 terminal CTA clears Android gesture/navigation bar; passenger rating, skip and backend unchanged.");
