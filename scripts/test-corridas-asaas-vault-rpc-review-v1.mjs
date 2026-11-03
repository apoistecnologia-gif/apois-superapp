// REVIEW ONLY P0: asserts restricted access to credential vault RPCs, never reads actual secrets.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const s=readFileSync('database/review/20261102_corridas_asaas_vault_rpc_privileges_REVIEW_ONLY.sql','utf8');
const functions=['public.get_asaas_subaccount_secret(uuid)','public.store_asaas_subaccount_secret(uuid,text)'];
assert.match(s,/^-- REVIEW ONLY/);
assert.equal((s.match(/^REVOKE ALL ON FUNCTION /gm)||[]).length,2);
assert.equal((s.match(/^GRANT EXECUTE ON FUNCTION /gm)||[]).length,2);
for(const fn of functions){
 assert.ok(s.includes('REVOKE ALL ON FUNCTION '+fn+' FROM PUBLIC, anon, authenticated;'),fn+' open to anon');
 assert.ok(s.includes('GRANT EXECUTE ON FUNCTION '+fn+' TO service_role;'),fn+' lacks service_role');
 assert.ok(s.includes("'"+fn+"'"),fn+' missing preflight');
}
for(const role of ['anon','authenticated','service_role'])assert.ok(s.includes("has_function_privilege('"+role+"',to_regprocedure(item),'EXECUTE')"));
assert.ok(s.includes('BEGIN;')&&s.trimEnd().endsWith('COMMIT;'));
assert.doesNotMatch(s,/GRANT EXECUTE ON FUNCTION [^\n]+ TO (?:PUBLIC|anon|authenticated)\s*;/);
console.log('[OK] REVIEW ONLY: no anonymous/normal-user access to Asaas vault secret read/write RPCs. NOT DEPLOYED.');
