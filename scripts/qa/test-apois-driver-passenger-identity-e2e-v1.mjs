// Contrato do perfil minimo do passageiro, somente leitura de fonte SQL.
// Este teste nao executa migrations nem consulta dados pessoais.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const source=readFileSync("supabase/corridas-forward-migrations/20261029_driver_assigned_passenger_profile_readonly.sql","utf8");
for (const marker of [
  "public.mobility_user_id()", "auth.uid() is not null", "r.driver_id = d.id",
  "r.status = 'procurar_motorista'", "r.offered_driver_ids",
  "case when r.driver_id = d.id then u.phone else null end",
  "revoke all on function public.apois_driver_assigned_passenger(uuid) from public, anon;",
  "grant execute on function public.apois_driver_assigned_passenger(uuid) to authenticated;"
]) assert.ok(source.includes(marker),"missing authorization contract: "+marker);
assert.ok(!source.includes("d.user_id = auth.uid()"),"auth ID must not be confused with domain ID");
assert.ok(!/\btruncate\b|\bdrop table\b|\bdelete from\b/i.test(source),"migration must not destroy data");
console.log("[OK] Corridas: driver/passenger identity scoped to offer or assigned ride. Review only, NOT deployed.");
