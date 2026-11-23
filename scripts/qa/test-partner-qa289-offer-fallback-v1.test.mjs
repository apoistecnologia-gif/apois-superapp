import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const source=readFileSync(".work/partner-motorista/src/routes/motorista.app.tsx","utf8");
const marker="APOIS_PARTNER_QA289_DRIVER_OFFER_VISIBLE_FALLBACK_V1";
const pollStart=source.indexOf("const qa289OfferPoll = window.setInterval");
const pollEnd=source.indexOf("    return () => {\n      supabase.removeChannel(ch)",pollStart);
const block=source.slice(pollStart,pollEnd);
test("QA289: driver recovers dispatched, authorized incoming offers while visible and ONLINE",()=>{
 assert.ok(source.includes(marker),"build did not apply QA289");
 assert.ok(pollStart>=0 && pollEnd>pollStart,"missing bounded offer polling");
 for(const expected of [
  '!online || !driverId',
  'document.visibilityState !== "visible"',
  'ratingRef.current || incomingRef.current || queuedRideRef.current',
  'qa289OfferPollInFlight',
  'existingRide.status !== "em_viagem"',
  '.contains("candidate_driver_ids", [userId as string])',
  '.eq("status", "procurar_motorista")',
  '.is("driver_id", null)',
  '.gte("created_at", since)',
  '.limit(3)',
  'computeOfferCountdown(r) > 0',
  '!handledRidesRef.current.has(r.id)',
  'if (fresh) presentOffer(fresh)',
  '7000'
 ])assert.ok(block.includes(expected),"QA289 missing safe offer recovery: "+expected);
 assert.equal(source.split("const qa289OfferPoll = window.setInterval").length-1,1,
  "one fallback only");
});
test("QA289: no offer writes, other business flows and subscribed Realtime intact",()=>{
 for(const forbidden of [
  '.insert(','.update(','.delete(','.upsert(','.rpc(','.send(',
  'driver_set_presence','accept_ride','finalizarCorridaMobile'
 ])assert.ok(!block.includes(forbidden),"fallback must be read-only: "+forbidden);
 for(const required of [
  'const resyncDriverRides = async () => {',
  'const poll = window.setInterval(async () => {',
  'window.clearInterval(poll);',
  'qa289OfferPollClosed = true;',
  'window.clearInterval(qa289OfferPoll);',
  '  }, [userId, driverId, loadTodayStats, featureFlags, online]);',
  '.on("postgres_changes",',
  '.subscribe(async (status) => {',
  'const presentOffer = (r: RideRow) => {',
  'startRideRingtone();',
  'stopRideRingtone();',
  'aceitarCorridaMobile',
  'iniciarCorridaMobile',
  'finalizarCorridaMobile',
  'cancelarPeloMotoristaMobile',
 ])assert.ok(source.includes(required),"QA289 lost preexisting feature: "+required);
});
