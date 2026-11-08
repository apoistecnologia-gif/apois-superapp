import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const sql=readFileSync("supabase/entregas-forward-migrations/20261108_customer_avatar_upsert_scoped_STAGE_ONLY.sql","utf8");
test("Avatar cliente: upsert possui INSERT/SELECT/UPDATE e owner path exato",()=>{
  assert.equal((sql.match(/create policy "/g)??[]).length,3);
  for(const mode of ["insert","select","update"])
    assert.match(sql,new RegExp("on storage\\.objects for "+mode+" to authenticated"));
  assert.equal((sql.match(/name = \(select auth\.uid\(\)\)::text \|\| '\/avatar'/g)??[]).length,4);
  assert.equal((sql.match(/public\.current_user_is_active\(\)/g)??[]).length,4);
  assert.doesNotMatch(sql,/courier-profile|for delete|using\s*\(\s*true/);
  assert.match(sql,/with check \(/);
});
