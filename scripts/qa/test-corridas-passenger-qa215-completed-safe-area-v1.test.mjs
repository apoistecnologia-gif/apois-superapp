import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
const s=readFileSync(resolve(process.env.APOIS_CORRIDAS_WORKSPACE||".work/corridas","src/routes/_authenticated.corrida.$rideId.tsx"),"utf8");
test("QA215 V2: Android navigation cannot cover permanent completed-ride CTA",()=>{
 for(const marker of [
  'data-apois-completed-summary-v2',
  'data-apois-completed-safe-area-qa215="true"',
  'className="flex h-full min-h-0 flex-col overflow-hidden',
  'data-apois-completed-scroll-region="true"',
  'overflow-y-auto overscroll-contain',
  'data-apois-completed-fixed-action-qa215="true"',
  'shrink-0 border-t',
  'paddingBottom: "max(64px, env(safe-area-inset-bottom, 0px))"',
  'onClick={handleReturnHome}', 'Voltar ao início'
 ])assert.ok(s.includes(marker),marker);
 const start=s.indexOf('data-apois-completed-scroll-region="true"');
 const close=s.indexOf('</div>',s.indexOf('<PassengerDriverRating',start));
 const footer=s.indexOf('data-apois-completed-fixed-action-qa215="true"');
 assert.ok(start>=0&&footer>start&&close< footer,"rating region precedes fixed footer");
});
test("QA215 V2: rating, optional skip and server-confirmed lifecycle are unchanged",()=>{
 for(const x of [
  'screenState === "completed"',
  '<PassengerDriverRating rideId={ride.id}',
  'onRated={() => {setRatingDecision(true);void refreshRide();}}',
  'onSkip={() => setRatingDecision(true)}',
  '3200', 'finishHomeActionRef.current()', 'resetFinishedTripUi();',
  'clearDestination();', 'clearRoute();', 'clearStops();'
 ])assert.ok(s.includes(x),x);
});
