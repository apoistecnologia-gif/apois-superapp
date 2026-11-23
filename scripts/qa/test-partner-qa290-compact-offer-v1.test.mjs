import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const source=readFileSync(".work/partner-motorista/src/routes/motorista.app.tsx","utf8");
const css=readFileSync(".work/partner-motorista/src/apois-ui-hardening-round3.css","utf8");
const a=source.indexOf("function IncomingOffer("),b=source.indexOf("\nfunction InfoCard(",a);
assert.ok(a>=0&&b>a,"QA290 IncomingOffer component missing");
const offer=source.slice(a,b);
test("QA290: incoming offer shows all essential information before acceptance without an expand button",()=>{
 for(const token of [
  "APOIS_PARTNER_QA290_COMPACT_INCOMING_OFFER_V1",
  'data-apois-qa290-compact-offer="true"',
  'data-apois-premium-screen="driver-offer"',
  'data-apois-premium-offer-heading',
  'maxHeight: "min(80dvh, 550px)"',
  'Valor previsto da corrida',
  'paymentLabelFor(ride.payment_method)',
  'Até coleta','Embarque','Corrida','Categoria',
  'passengerFirstName(passenger?.name)',
  'Ver perfil e preferências do passageiro',
  'passengerRatingSummary(passenger)',
  'name={ride.pickup_label || ride.origin_name}',
  'name={ride.destination_name}',
  'Deslocamento estimado total',
  'onConfirm={onAccept}',
  'onClick={onReject}',
  'CountdownRing seconds={countdown}',
  'startRideRingtone();','stopRideRingtone();',
 ])assert.ok(source.includes(token),"QA290 missing essential content: "+token);
 assert.ok(!offer.includes("Ver passageiro e preferências"),"redundant expandable button still obscures locations");
 assert.ok(!offer.includes("Recolher detalhes"),"drawer state not required to view addresses");
 const essential=[
  "data-apois-premium-offer-heading",
  "Valor previsto da corrida",
  "data-apois-qa290-offer-metrics",
  "passengerFirstName(passenger?.name)",
  "data-apois-qa290-offer-routes",
  "name={ride.destination_name}",
  "data-apois-qa290-offer-actions",
 ];
 for(let i=1;i<essential.length;i++)
  assert.ok(offer.indexOf(essential[i])>offer.indexOf(essential[i-1]),
   "Essential content must be before persistent footer: "+essential[i]);
 assert.equal(offer.match(/onConfirm=\{onAccept\}/g)?.length,1);
 assert.equal(offer.match(/onClick=\{onReject\}/g)?.length,1);
});
test("QA290: compact layout scoped to offer and leaves rider flow/ringtone unchanged",()=>{
 assert.ok(css.includes("APOIS_QA290_INCOMING_OFFER_CSS"));
 assert.ok(css.includes("[data-apois-qa290-compact-offer] [data-apois-qa290-offer-routes]"));
 assert.ok(css.includes("-webkit-line-clamp:2"));
 for(const s of [
   "APOIS_PARTNER_QA289_DRIVER_OFFER_VISIBLE_FALLBACK_V1",
   "const qa289OfferPoll = window.setInterval",
   "if (fresh) presentOffer(fresh)",
   'const presentOffer = (r: RideRow) => {',
   'const callAccept   = aceitarCorridaMobile;',
   'const callReject   = recusarCorridaMobile;',
   'const callStart    = iniciarCorridaMobile;',
   'const callComplete = finalizarCorridaMobile;',
   "const resyncDriverRides = async () => {",
   'ApoisExternalNavigation',
   "startRideRingtone();",
   "stopRideRingtone();",
 ])assert.ok(source.includes(s),"Protected lifecycle lost: "+s);
 const patch=readFileSync("scripts/fix-partner-qa290-compact-offer-v1.mjs","utf8");
 for(const forbidden of [
  "driver_set_presence(","UPDATE public.rides","INSERT INTO","payment_status =",
  "service_role","ALTER TABLE","CREATE POLICY",
 ]) assert.ok(!patch.includes(forbidden),"QA290 must not modify backend or finance: "+forbidden);
});
