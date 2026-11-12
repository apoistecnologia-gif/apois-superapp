// APOIS_PASSENGER_QA215_COMPLETED_SAFE_AREA_V2.
// Physical Android: the full-height terminal screen is clipped by the native
// navigation region once the optional rating card grows. Put ONLY the optional
// summary/rating in the internal scroll region; keep "Voltar ao início"
// permanently in a separate, native-safe footer. No changes to ride/RPC/timer.
import {readFileSync,writeFileSync} from "node:fs";
import {resolve} from "node:path";
const file=resolve(process.env.APOIS_CORRIDAS_WORKSPACE||".work/corridas","src/routes/_authenticated.corrida.$rideId.tsx");
let s=readFileSync(file,"utf8");
function once(oldText,newText,label){
  const count=s.split(oldText).length-1;
  if(count!==1)throw Error("[FAIL] QA215 V2 "+label+" count="+count);
  s=s.replace(oldText,newText);
}
if(s.includes("data-apois-completed-fixed-action-qa215"))throw Error("[FAIL] QA215 V2 duplicate");
once(
 'data-apois-completed-summary-v2 className="flex min-h-[100dvh] flex-col',
 'data-apois-completed-summary-v2 data-apois-completed-safe-area-qa215="true" className="flex h-full min-h-0 flex-col overflow-hidden',
 "terminal bounded by authenticated viewport"
);
once(
 'text-[#111827]">\n        <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 text-center">',
 'text-[#111827]">\n        <div data-apois-completed-scroll-region="true" className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain pb-4">\n        <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 text-center">',
 "scrollable completion and rating"
);
once(
 '        </div>\n        <button type="button" onClick={handleReturnHome}',
 '        </div>\n        </div>\n        <footer data-apois-completed-fixed-action-qa215="true" className="z-20 shrink-0 border-t border-[#E2E4E8] bg-[#F7F7F8] pt-3" style={{ paddingBottom: "max(64px, env(safe-area-inset-bottom, 0px))" }}>\n        <button type="button" onClick={handleReturnHome}',
 "fixed return action outside scroll"
);
once(
 '          <Home className="h-5 w-5" aria-hidden="true" /> Voltar ao início\n        </button>\n      </main>',
 '          <Home className="h-5 w-5" aria-hidden="true" /> Voltar ao início\n        </button>\n        </footer>\n      </main>',
 "close fixed footer"
);
for(const must of [
 'data-apois-completed-safe-area-qa215="true"',
 'data-apois-completed-scroll-region="true"',
 'data-apois-completed-fixed-action-qa215="true"',
 'screenState === "completed"','<PassengerDriverRating rideId={ride.id}',
 'onRated={() => {setRatingDecision(true);void refreshRide();}}',
 'onSkip={() => setRatingDecision(true)}',
 'finishHomeActionRef.current()', '3200', 'onClick={handleReturnHome}','Voltar ao início'
])if(!s.includes(must))throw Error("[FAIL] QA215 V2 lost "+must);
writeFileSync(file,s,"utf8");
console.log("[OK] QA215 V2: always-visible Android-safe return CTA; rating, skip, ride server state and timer preserved.");
