/**
 * QA283: generated Motorista profile displays an authenticated completed ride
 * count rather than treating a missing drivers.completed_rides as zero.
 * Static/regression test; never calls live Supabase or changes data.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const source=readFileSync(".work/partner-motorista/src/routes/motorista.perfil.tsx","utf8");
const patch=readFileSync("scripts/fix-partner-qa283-profile-ride-count-v1.mjs","utf8");
test("profile reads completed count from existing actor-authorized RPC",()=>{
 for(const key of [
  "APOIS_PARCEIRO_QA283_PROFILE_COMPLETED_RIDES_V1",
  'rpc("driver_get_profile")',
  '"get_driver_public_profile", {target_user_id: auth.user.id}',
  "const row=Array.isArray(publicRows) ? publicRows[0] : null;",
  "const value=row?.completed_rides;",
  "setTotalRides(value);",
  "requestId !== requestRef.current",
  "const [totalRides, setTotalRides] = useState<number | null>(null);",
  "const completed = totalRides;",
 ])assert.ok(source.includes(key),"missing profile secure count: "+key);
 assert.ok(!source.includes('setTotalRides(safeCount(nextDriver.completed_rides))'));
 assert.ok(!source.includes('safeCount(driver?.completed_rides ?? totalRides)'));
 assert.ok(!source.includes('from("rides")'),"profile must reuse authorized aggregate RPC, not bypass RLS");
});
test("unknown completion is not fabricated as zero; profile operations stay intact",()=>{
 for(const key of [
  'setTotalRides(null);',
  '{completed === null ? "— corridas" : String(completed)',
  '<StatCard label="Corridas" value={completed === null ? "—" : String(completed)} />',
  '<StatCard label="Avaliação"',
  '<StatCard label="Avaliações"',
  'ApoisPremiumDriverNav active="perfil"',
  "handleLogout","ProfileForm",
 ])assert.ok(source.includes(key),"lost profile feature: "+key);
 assert.ok(!source.includes('completed_rides ?? 0'));
 for(const forbidden of ['update public.rides','update drivers','insert into','delete from','payment_status','wallet_transactions']){
  assert.ok(!patch.toLowerCase().includes(forbidden),"patch must not contain business writes: "+forbidden);
 }
});
