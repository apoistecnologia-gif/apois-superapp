// QA238 — prevent regressions of the user's QA219-approved passenger home.
// No backend, fare, wallet, map, or dispatch rules changed by this visual fix.
import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";

const root=resolve(process.env.APOIS_CORRIDAS_WORKSPACE||".work/corridas");
const read=(p)=>readFileSync(resolve(root,p),"utf8");
const home=read("src/routes/_authenticated.inicio.tsx");
const presence=read("src/components/map/PassengerDemandSharing.tsx");
const profile=read("src/routes/_authenticated.perfil.tsx");
const map=read("src/components/map/PassengerMap.tsx");

test("QA219 approved: never overlay a large region-sharing card over the passenger map",()=>{
 assert.ok(home.includes("<PassengerDemandSharing authUserId={demandUser?.id}"));
 assert.ok(presence.includes("return null;"),"presence widget remains mounted but renders nothing");
 assert.doesNotMatch(presence,/Compartilhar minha região|data-apois-qa218-consent|pointer-events-auto absolute left-3/);
 assert.doesNotMatch(home,/showControl=\{!hasDestination\}/,"map control should not be mounted");
});
test("QA219 approved: no nearby-driver status pill/banner; real markers still rendered",()=>{
 for(const forbidden of [
   "Nenhum motorista próximo agora",
   "Buscando motoristas próximos...",
   "Motoristas próximos indisponíveis",
   "data-apois-qa217-nearby-label",
 ])
  assert.ok(!home.includes(forbidden),"forbidden home overlay "+forbidden);
 assert.ok(home.includes("useNearbyPassengerDrivers("));
 assert.ok(home.includes("nearbyDrivers={nearby.points}"));
 assert.ok(map.includes("nearbyDrivers"),"real nearby driver points remain supported");
});
test("QA219 approved: foreground sharing defaults on, explicit off stays in Profile",()=>{
 for(const must of [
   'return localStorage.getItem(preferenceKey(authUserId)) !== "0"',
   'apois_passenger_presence_ping',
   'apois_passenger_presence_stop',
   'document.visibilityState !== "visible"',
   'window.setInterval(send, 60_000)',
   'return null;',
 ])
  assert.ok(presence.includes(must),"automatic anonymous presence "+must);
 for(const must of [
   "APOIS_PASSENGER_QA219_PRIVACY_V1",
   "<PassengerDemandPrivacySettings authUserId={user?.id} />",
   "<PassengerAccountDeletion",
 ])
  assert.ok(profile.includes(must),"passenger privacy controls "+must);
});
test("QA237 follow-up: no 'blocked wallet' banner or refresh button before destination is selected",()=>{
 assert.ok(home.includes('hasDestination && (!checkout.readiness || !!routeError)'),
  "request gate card only after passenger selects a destination");
 assert.ok(home.includes('data-apois-qa237-request-gate="true"'));
 assert.ok(home.includes('data-apois-qa237-retry="true"'));
 assert.ok(home.includes('disabled={!checkout.readiness || !!routeError}'),
  "the original disabled request safety gate remains intact");
 assert.ok(home.includes('qa237Reasons.includes("passenger_debt_block")'),
  "a genuine financial block must still be enforced with a destination");
 assert.ok(home.includes("Atualizar percurso e valor"));
});

test("QA238: recalculation cannot bypass a financial or authentication blocker",()=>{
 for(const s of [
  "qa237HasNonRouteBlock",
  '["passenger_debt_block","insufficient_balance","payment_method_missing","category_missing","user_not_authenticated"].includes(reason)',
  "qa237Recoverable=!qa237HasNonRouteBlock && (qa237RouteProblem || qa237PricingProblem)",
  'disabled={!checkout.readiness || !!routeError}',
 ])assert.ok(home.includes(s),s);
});
test("QA238: illustrated Moto category has singular and plural code aliases",()=>{
 const category=read("src/components/pricing/CategorySelector.tsx");
 for(const s of ['carro: "0%"','carros: "0%"','moto: "25%"','motos: "25%"','fretes: "50%"','guincho: "75%"','envios: "100%"'])
  assert.ok(category.includes(s),s);
 assert.ok(category.includes('servicePosition[String(cat.key ?? cat.code ?? "").toLowerCase()]'));
 assert.ok(category.includes('backgroundSize: "500% 100%"'));
});
