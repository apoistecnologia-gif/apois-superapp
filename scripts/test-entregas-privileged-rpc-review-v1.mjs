// QA-only regression contract. Does NOT connect to Supabase and does NOT apply SQL.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const sql=readFileSync('database/review/20261102_entregas_privileged_rpc_least_privilege_REVIEW_ONLY.sql','utf8');
assert.match(sql,/^-- REVIEW ONLY \/ NÃO APLICADO/);
const functions=[
 'public.dispatch_delivery_job_offers(uuid)',
 'public.ensure_cancelled_paid_order_refund(uuid)',
 'public.reserve_paid_order_merchant_net(uuid)',
 'public.reverse_paid_order_merchant_reserve(uuid)',
];
assert.equal((sql.match(/^REVOKE ALL ON FUNCTION /gm)||[]).length,functions.length);
assert.equal((sql.match(/^GRANT EXECUTE ON FUNCTION /gm)||[]).length,functions.length);
for(const fn of functions) {
 assert.ok(sql.includes('REVOKE ALL ON FUNCTION '+fn+' FROM PUBLIC, anon, authenticated;'),
   'Public grant survives individual role revocation: '+fn);
 assert.ok(sql.includes('GRANT EXECUTE ON FUNCTION '+fn+' TO service_role;'),
   'Trusted service_role Edge Functions must remain callable: '+fn);
 assert.ok(sql.includes("'"+fn+"'"),'Preflight function contract absent: '+fn);
}
assert.match(sql,/has_function_privilege\('anon',to_regprocedure\(item\),'EXECUTE'\)/);
assert.match(sql,/has_function_privilege\('authenticated',to_regprocedure\(item\),'EXECUTE'\)/);
assert.match(sql,/has_function_privilege\('service_role',to_regprocedure\(item\),'EXECUTE'\)/);
assert.ok(sql.indexOf('BEGIN;') < sql.indexOf('REVOKE ALL ON FUNCTION'),'Must use transaction');
assert.ok(sql.indexOf('$postflight$;') < sql.lastIndexOf('COMMIT;'),'Post-check must precede commit');
assert.doesNotMatch(sql,/GRANT EXECUTE ON FUNCTION [^\n]+ TO (?:PUBLIC|anon|authenticated)\s*;/);
console.log('[OK] Entregas privileged RPC SQL review guarded: preflight, PUBLIC/anon/authenticated revoke, service_role retention and postflight. NOT DEPLOYED.');
