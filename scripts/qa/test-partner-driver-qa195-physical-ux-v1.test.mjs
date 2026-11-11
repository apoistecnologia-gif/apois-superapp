import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
const root=resolve(process.env.APOIS_MOTORISTA_WORKSPACE||".work/partner-motorista");
const ride=readFileSync(resolve(root,"src/routes/motorista.app.tsx"),"utf8");
const css=readFileSync(resolve(root,"src/styles.css"),"utf8");
const sql=readFileSync(resolve(process.cwd(),"supabase/corridas-forward-migrations/20261111_apois_driver_offer_passenger_photo_scope.sql"),"utf8");
test("QA195 offer compact with scroll and original accept/reject flow",()=>{
 const a=ride.indexOf("function IncomingOffer("),b=ride.indexOf("\nfunction InfoCard(",a),offer=ride.slice(a,b);
 for(const s of ["min(48dvh, 440px)","data-apois-driver-offer-qa195","overflow-y-auto overscroll-contain","onClick={onAccept}","onClick={onReject}","CountdownRing","AddressRow","estimated_price","passengerRatingSummary(passenger)"])assert.ok(offer.includes(s),s);
});
test("QA195 first name and real assigned/offer identity, photo and ratings",()=>{
 for(const s of ["function passengerFirstName(","function passengerRatingSummary(","apois_driver_offer_passenger","apois_driver_assigned_passenger","incoming?.id]);","avatar_url ??","setPassenger(null);"])assert.ok(ride.includes(s),s);
 assert.ok(!ride.includes('{passenger?.name ?? "Nome indisponível"}'));
});
test("QA195 PIN explicit touch, active digit and original validation",()=>{
 const a=ride.indexOf("function ActiveRidePanel("),b=ride.indexOf("\nfunction ActionButton(",a),panel=ride.slice(a,b);
 for(const s of ["apois-qa195-pin-hint","Toque em qualquer quadradinho","position === Math.min(pinCode.length, 3)","document.getElementById(\"apois-motorista-pin-v4\")?.focus()","onStart(pinCode)","maxLength={4}","onClick={() => void submitPin()}"])assert.ok(panel.includes(s),s);
});
test("QA195 scoped HUD CSS and operational callbacks",()=>{
 for(const s of ["APOIS_DRIVER_QA195_PHYSICAL_UX_V1","[data-apois-pickup-top-v4]>div","[data-apois-trip-top-v6]>div"])assert.ok(css.includes(s),s);
 for(const s of ["DriverMapErrorBoundary","callRoute({ data: { origin: pos, destination: dest } })","onClick={handleComplete}"])assert.ok(ride.includes(s),s);
});
test("QA195 offer SQL is narrow, avatars remain private",()=>{
 for(const s of ["CREATE FUNCTION public.apois_driver_offer_passenger","SECURITY DEFINER","offered_driver_ids","rejected_driver_ids","request_expires_at","public.mobility_user_id()","apois_driver_may_view_passenger_avatar","storage.objects","bucket_id = 'profile-photos'","REVOKE ALL ON FUNCTION"])assert.ok(sql.includes(s),s);
 assert.ok(sql.includes("storage.allow_only_operation('object.sign')"),"Signed URL only, never list objects");
 assert.ok(!sql.includes("ALTER TABLE public.users"));
 assert.ok(!sql.includes("GRANT SELECT ON public.users"));
});
