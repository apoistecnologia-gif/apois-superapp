import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";

const sql = readFileSync("supabase/entregas-forward-migrations/20261108_storage_uploads_scoped_STAGE_ONLY.sql", "utf8");

test("Storage: todos os 5 buckets possuem dono e políticas específicas", () => {
  const buckets=["product-images","merchant-assets","merchant-documents","courier-documents","support-attachments"];
  for(const bucket of buckets) assert.ok(sql.includes("'"+bucket+"'"),bucket);
  assert.equal((sql.match(/create policy "/gi)??[]).length,12);
  assert.equal((sql.match(/drop policy if exists "/gi)??[]).length,12);
  assert.match(sql,/on conflict \(id\) do nothing/i);
  assert.doesNotMatch(sql,/(\busing\s*\(\s*true\s*\)|\bwith check\s*\(\s*true\s*\))/i);
  assert.doesNotMatch(sql,/for\s+all\s+to\s+authenticated/i);
});
test("Storage: vinculações da loja e do entregador impedem acesso cruzado", () => {
  assert.match(sql,/current_user_is_merchant_manager\(m\.id\)/);
  assert.match(sql,/m\.id::text\s*=\s*\(storage\.foldername\(name\)\)\[1\]/);
  assert.match(sql,/current_user_courier_id\(\) is not null/);
  assert.match(sql,/\(storage\.foldername\(name\)\)\[1\]\s*=\s*\(select auth\.uid\(\)\)::text/);
  assert.match(sql,/t\.requester_user_id = \(select auth\.uid\(\)\)/);
  assert.match(sql,/t\.status in \('open','in_progress'\)/);
});
test("Storage: documentos e anexos permanecem privados, avatares intocados", () => {
  assert.match(sql,/\('merchant-documents','merchant-documents',false/);
  assert.match(sql,/\('courier-documents','courier-documents',false/);
  assert.match(sql,/\('support-attachments','support-attachments',false/);
  assert.doesNotMatch(sql,/bucket_id\s*=\s*'avatars'/);
  assert.match(sql,/public\.current_user_is_admin\(\)/);
});
