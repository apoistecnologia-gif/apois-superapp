// Read-only fixture tests and source inspection. Never approves a driver.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {resolve} from "node:path";
const root=resolve(process.env.APOIS_MOTORISTA_WORKSPACE||".work/partner-motorista");
const src=readFileSync(resolve(root,"src/routes/admin.motoristas.tsx"),"utf8");
for(const key of [
  "APOIS_DRIVER_KYC_APPROVAL_UI_GUARD_V1",
  'if (status === "aprovado") await assertCarVehicleInspected(driver);',
  'getDocs({ data: { driverId: driver.id } })',
  'year < new Date().getFullYear() - 10',
  'const latest = new Map<string,string>()',
  'latest.get(slot) !== "approved"',
  'await setAdminDriverApproval(driver.id, status, reason);'
])assert.ok(src.includes(key),"Admin guard missing: "+key);
assert.ok(!src.includes('.from("apois_vehicle_inspection_photos")'),"No direct client read of privileged gallery");
const slots=["front","right","left","dashboard","front_seats","rear_seats","tire_fl","tire_fr","tire_rl","tire_rr","belt_front","belt_rear","headlights_on"];
function validPhotos(rows) {
 const latest = new Map();
 for(const p of rows) if(slots.includes(p.slot)&&!latest.has(p.slot))latest.set(p.slot,p.review_status);
 return slots.every(slot=>latest.get(slot)==="approved");
}
assert.equal(validPhotos([]),false,"0/13 must block");
assert.equal(validPhotos(slots.slice(0,12).map(slot=>({slot,review_status:"approved"}))),false,"12/13 must block");
assert.equal(validPhotos(slots.map(slot=>({slot,review_status:"approved"}))),true,"13/13 passes photo count");
assert.equal(validPhotos([{slot:"front",review_status:"pending"},...slots.map(slot=>({slot,review_status:"approved"}))]),false,"newer submitted front photo invalidates old approval");
console.log("[PASS] Admin KYC UI fixture: 0/12 photos blocked; 13 approved; latest revision governs.");
