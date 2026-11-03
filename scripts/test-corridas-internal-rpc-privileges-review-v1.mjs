// APOIS CORRIDAS INTERNAL RPC P0: static review-only test, no production access.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const sql=readFileSync('database/review/20261102_corridas_internal_rpc_privileges_REVIEW_ONLY.sql','utf8');
assert.match(sql,/^-- REVIEW ONLY /);
const fns=[
 'public.service_cancel_passenger_ride(uuid,uuid,text)',
 'public.settle_asaas_ride_payment(uuid,text,numeric,numeric)',
 'public.ensure_ride_settlement(uuid)',
 'public.activate_due_scheduled_rides(integer,integer)'
];
assert.equal((sql.match(/^REVOKE ALL ON FUNCTION /gm)||[]).length,fns.length);
assert.equal((sql.match(/^GRANT EXECUTE ON FUNCTION /gm)||[]).length,fns.length);
for(const fn of fns){
 assert.ok(sql.includes('REVOKE ALL ON FUNCTION '+fn+' FROM PUBLIC, anon, authenticated;'),'unauthorized execution not revoked: '+fn);
 assert.ok(sql.includes('GRANT EXECUTE ON FUNCTION '+fn+' TO service_role;'),'service role missing: '+fn);
 assert.ok(sql.includes("'"+fn+"'"),'preflight missing '+fn);
}
assert.match(sql,/has_function_privilege\('anon',to_regprocedure\(item\),'EXECUTE'\)/);
assert.match(sql,/has_function_privilege\('authenticated',to_regprocedure\(item\),'EXECUTE'\)/);
assert.match(sql,/has_function_privilege\('service_role',to_regprocedure\(item\),'EXECUTE'\)/);
assert.ok(sql.indexOf('BEGIN;')<sql.indexOf('$preflight$;'));
assert.ok(sql.indexOf('$postflight$;')<sql.lastIndexOf('COMMIT;'));
assert.doesNotMatch(sql,/GRANT EXECUTE ON FUNCTION [^\n]+ TO (?:PUBLIC|anon|authenticated)\s*;/);
assert.ok(sql.includes('public.cancel_own_ride')&&sql.includes('public.driver_confirm_cash_payment'),'protected calls must be considered in review');
console.log('[OK] REVIEW ONLY: internal ride cancellation/settlement/schedule RPC grants require service_role; public adapters preserve users. NOT APPLIED.');
