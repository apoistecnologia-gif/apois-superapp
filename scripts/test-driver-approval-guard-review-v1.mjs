// APOIS_DRIVER_APPROVAL_GUARD_REVIEW_TEST_V1 — contract-only, not a live DB test.
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const path='database/review/20261102_driver_complete_registration_v3_approved_guard_REVIEW_ONLY.sql';
const source=readFileSync(path,'utf8');
const once=marker=>{const n=source.split(marker).length-1;assert.equal(n,1,marker+' should occur once');return source.indexOf(marker)};
assert.ok(source.startsWith('-- REVIEW ONLY, NOT APPLIED TO PRODUCTION.'),'Never label this as deployed');
const auth=once('if auth.uid() is null then');
const rowLock=once('select * into v_driver from public.drivers d where d.user_id=v_user.id for update;');
const guard=once("if found and v_driver.approval_status in ('aprovado','suspenso','bloqueado') then");
const failClosed=once("raise exception 'driver_registration_closed' using errcode='42501';");
const updateUser=once('update public.users');
const driverInsert=once('insert into public.drivers');
const upsert=once('on conflict(user_id) do update set');
assert.ok(auth<rowLock && rowLock<guard && guard<failClosed && failClosed<updateUser && updateUser<driverInsert && driverInsert<upsert,'Guard must be under row lock and precede all mutable profile and driver writes');
for(const token of ['_selfie_path','_cnh_path','_cnh_back_path','_vehicle_document_path','_vehicle_photo_path','invalid_document_path','return to_jsonb(v_driver);']){
  assert.ok(source.includes(token),'Original business contract missing: '+token);
}
assert.ok(!/\b(?:truncate|drop table|delete from)\b/i.test(source),'Unexpected destructive SQL');
console.log('[OK] REVIEW ONLY: approved/suspended/blocked driver update protection follows auth+row lock and precedes writes. NOT applied to production.');
