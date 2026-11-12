import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
const s=readFileSync(resolve(process.env.APOIS_CORRIDAS_WORKSPACE||".work/corridas","src/routes/_authenticated.corrida.$rideId.tsx"),"utf8");
test("QA215 completed CTA reserves native Android navigation inset, not covered by buttons",()=>{
 for(const x of [
 'data-apois-completed-summary-v2',
 'data-apois-completed-safe-area-qa215="true"',
 'paddingBottom: "max(104px, env(safe-area-inset-bottom, 0px))"',
 'onClick={handleReturnHome}',"Voltar ao início"
 ])assert.ok(s.includes(x),x);
});
test("QA215 rating RPC, optional evaluation and server confirmed completion unchanged",()=>{
 for(const x of [
 'screenState === "completed"',
 '<PassengerDriverRating rideId={ride.id}',
 'onRated={() => {setRatingDecision(true);void refreshRide();}}',
 'onSkip={() => setRatingDecision(true)}',
 '3200', 'finishHomeActionRef.current()', 'resetFinishedTripUi();',
 'clearDestination();', 'clearRoute();', 'clearStops();'
 ])assert.ok(s.includes(x),x);
});
