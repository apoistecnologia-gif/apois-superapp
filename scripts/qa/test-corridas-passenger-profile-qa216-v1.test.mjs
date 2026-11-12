import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
const root=resolve(process.env.APOIS_CORRIDAS_WORKSPACE||".work/corridas");
const read=(path)=>readFileSync(resolve(root,path),"utf8");
const profile=read("src/routes/_authenticated.perfil.tsx");
const photo=read("src/components/profile/PassengerProfilePhoto.tsx");
const count=read("src/components/profile/PassengerCompletedRideCount.tsx");
const driver=read("src/components/rides/active/DriverCard.tsx");
const vehicle=read("src/components/rides/active/VehicleCard.tsx");

test("QA216 profile: authorized user can choose a photo; original profile editor remains",()=>{
 for(const x of [
  "APOIS_PASSENGER_PROFILE_QA216_V1",
  "<PassengerProfilePhoto avatarSource={profileAvatarUrl}",
  "authUserId={user?.id} profileId={profile?.id}",
  "onSaved={refreshSession}",
  "<PassengerCompletedRideCount passengerId={profile?.id ?? null} />",
  "<PassengerAccountDeletion",
  "<PassengerProfileEditor",
 ]) assert.ok(profile.includes(x),x);
 for(const x of [
  'data-apois-passenger-profile-photo-qa216="true"',
  'aria-label={imageUrl ? "Trocar foto de perfil" : "Adicionar foto de perfil"}',
  'accept="image/jpeg,image/png,image/webp"',
  'MAX_BYTES = 5 * 1024 * 1024',
  'const objectPath =',
  '.upload(objectPath, file,',
  '.update({ avatar_url: objectPath })',
  '.eq("id", profileId)',
  '.eq("auth_user_id", authUserId)',
  'createSignedUrl(raw, 3600)',
  'upsert: false',
 ]) assert.ok(photo.includes(x),x);
 assert.doesNotMatch(photo,/getPublicUrl|service_role|auth\.admin|\.upsert\(\{\s*auth_user_id/);
});

test("QA216 completed rides: count real passenger finalizada, never blind zero on failed read",()=>{
 for(const x of [
  "APOIS_PASSENGER_COMPLETED_COUNT_QA216_V1",
  '.from("rides").select("id", { count: "exact", head: true })',
  '.eq("passenger_id", passengerId)',
  '.eq("status", "finalizada")',
  'setCount(null);',
  'if (error || total === null',
  '"— corridas"',
 ]) assert.ok(count.includes(x),x);
 assert.ok(!profile.includes("{currentProfile.completedRides} corridas"),
   "never trust denormalized users.completed_rides");
});

test("QA216 accepted driver: name/model/color/plate preserved; no raw private-path <img>",()=>{
 for(const x of [
  "APOIS_CLIENT_QA169_VIDEO_V1",
  'createSignedUrl(path,3600)',
  "src={photoUrl}",
  "onError={() => setFailedUrl(photoUrl)}",
  'ride.driver_name || "Motorista"',
 ])assert.ok(driver.includes(x),x);
 assert.ok(!driver.includes('src={ride.driver_photo}'));
 for(const x of [
  "ride.driver_vehicle_model",
  "ride.driver_vehicle_color",
  "ride.driver_vehicle_plate",
  "Confira a placa",
 ])assert.ok(vehicle.includes(x),x);
});
