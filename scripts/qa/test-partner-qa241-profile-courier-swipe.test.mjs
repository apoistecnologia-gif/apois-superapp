// APOIS_PARTNER_QA241_PROFILE_COURIER_SWIPE_V1
import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,existsSync} from "node:fs";
const role=process.env.APOIS_QA241_ROLE||"motorista";
const root=".work/partner-"+role;
const swipe=readFileSync("superapp/partner-shell/shared/ApoisSwipeControls.tsx","utf8");
const bubble=readFileSync("scripts/android/APOISReturnBubble.java","utf8");
const installer=readFileSync("scripts/install-partner-qa239-native-bubble.mjs","utf8");
function generated(path){const file=root+"/"+path;assert.ok(existsSync(file),file);return readFileSync(file,"utf8");}

test("QA241: approved swipe callbacks and 79% gesture untouched; visual finish standardized",()=>{
 for(const marker of ["threshold=0.79","onPointerDown={onDown}","onPointerMove={onMove}","onPointerUp={onUp}",
  "onConfirm()","ArrowRight","ArrowLeft","bg-[linear-gradient(110deg,#E51B23",
  "rounded-[20px]","onAccept","onReject","dir===1?onAccept:onReject","onKeyDown={key}"]){
  // onConfirm is a typed callback in the shared component, not an invented RPC.
  if(marker==="onConfirm()")assert.ok(swipe.includes("await onConfirm();"));
  else assert.ok(swipe.includes(marker),marker);
 }
 assert.ok(!swipe.includes("onClick={onAccept}"));
 assert.equal(generated("src/components/ApoisSwipeControls.tsx"),swipe);
});

test("QA241: return bubble is native, branded, and points to the active role",()=>{
 for(const s of ['"activeRole"','"motorista"','"entregador"',
  '"br.com.apois.parceiro://module/motorista"','"br.com.apois.parceiro://module/entregador"',
  "R.drawable.apois_return_logo","Settings.canDrawOverlays(context)",
  "new Intent(app, MainActivity.class)","app.startActivity(back)","externalNavigatorVisible",
  "getBoolean(\"rideActive\", false)"])
   assert.ok(bubble.includes(s),"bubble "+s);
 assert.ok(installer.includes("APOISReturnBubble.active(getContext(),role,active)"));
 assert.ok(!bubble.includes('setText("A")'));
});

if(role==="motorista"){
 test("QA241: offer passenger profile uses existing authorized ride RPC; never permanent skeleton",()=>{
  const rootCode=generated("src/routes/motorista.app.tsx");
  const component=generated("src/components/ApoisDriverOfferPassengerProfile.tsx");
  for(const s of [
   'import { ApoisDriverOfferPassengerProfile }',
   'onOpenProfile={() => incoming.id && setProfilePassengerId(incoming.id)}',
   'rideId={profilePassengerId}','initial={passenger}',
   'onAccept={handleAccept}','onReject={handleReject}',
   'onStartPin={()=>setQa236PinOpen(true)}',
   'onConfirm={handleComplete}',
   'showDemandZones && demandZones.map'
  ])assert.ok(rootCode.includes(s),s);
  for(const s of ['rpc("apois_driver_offer_passenger",{p_ride_id:rideId})',
   'window.setTimeout(', '6500', '.catch(()=>', 'setPhase("ready")',
   'setPhase(hasOffer?"partial":"unavailable")','role="status"',
   'public', 'Tentar novamente', 'Exibindo as informações já disponíveis'])
   assert.ok(component.includes(s),s);
  assert.ok(!component.includes('rpc("get_passenger_public_profile"'),"nonexistent RPC may not be called");
  assert.ok(!component.includes('.from("users")'),"no broad profile query");
  assert.ok(!rootCode.includes("<PassengerProfessionalProfileDialog"));
 });
}
if(role==="entregador"){
 test("QA241: courier setup and navigation mirror driver without altering delivery flow",()=>{
  const courierRoot=generated("src/routes/__root.tsx");
  const map=generated("src/components/CourierRouteMap.tsx");
  const courier=generated("src/routes/courier.tsx");
  const gate=generated("src/components/ApoisBubblePermissionGate.tsx");
  assert.ok(courierRoot.includes('<ApoisBubblePermissionGate role="entregador" />'));
  assert.ok(courierRoot.includes('<ApoisLaunchSplash />'));
  assert.ok(courierRoot.includes('<AuthSessionIsolation>'));
  assert.ok(gate.includes('Configuração inicial do entregador'));
  assert.ok(gate.includes('appStateChange'));
  for(const s of ['<ApoisQuickMapButton latitude={target.lat} longitude={target.lng} />',
   'ApoisExternalNavigation latitude={target.lat}',"update_courier_delivery_route_metrics",
   "job.pickup_latitude","job.delivery_latitude"])assert.ok(map.includes(s),s);
  for(const s of ['useApoisOperationalNotification("entregador", Boolean(activeJob))',
   'onTransition={transitionDelivery}','onComplete={completeDelivery}'])
   assert.ok(courier.includes(s),s);
  assert.ok(existsSync(root+"/src/assets/apois-return-logo.png"));
 });
}
