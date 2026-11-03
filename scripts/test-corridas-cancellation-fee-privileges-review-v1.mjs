// APOIS_CORRIDAS_CANCELLATION_FEE_P0 — review-only SQL structure test; NEVER connects to production.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const sql=readFileSync('database/review/20261102_corridas_cancellation_fee_privileges_REVIEW_ONLY.sql','utf8');
assert.match(sql,/^-- REVIEW ONLY /);
const functions=[
 'public.settle_cancellation_fee(uuid)',
 'public.reverse_cancellation_fee_settlement(uuid)',
];
assert.equal((sql.match(/^REVOKE ALL ON FUNCTION /gm)||[]).length,functions.length);
assert.equal((sql.match(/^GRANT EXECUTE ON FUNCTION /gm)||[]).length,functions.length);
for(const fn of functions){
 assert.ok(sql.includes('REVOKE ALL ON FUNCTION '+fn+' FROM PUBLIC, anon, authenticated;'),'PUBLIC/anon/auth grants must all be removed');
 assert.ok(sql.includes('GRANT EXECUTE ON FUNCTION '+fn+' TO service_role;'),'Service-role webhook must keep execution');
 assert.ok(sql.includes("'"+fn+"'"),'Signature guard missing: '+fn);
}
for(const role of ['anon','authenticated','service_role'])assert.ok(sql.includes("has_function_privilege('"+role+"',to_regprocedure(item),'EXECUTE')"),'Postcheck absent for '+role);
assert.ok(sql.indexOf('BEGIN;')<sql.indexOf('$preflight$;'));
assert.ok(sql.indexOf('$postflight$;')<sql.lastIndexOf('COMMIT;'));
assert.doesNotMatch(sql,/GRANT EXECUTE ON FUNCTION [^\n]+ TO (?:PUBLIC|anon|authenticated)\s*;/);
console.log('[OK] REVIEW ONLY P0 cancellation-fee RPC grant contract: no public/auth access, service_role retained, transaction/preflight/postflight. SQL execution is outside this test; check Supabase migration history for production status.');
