import test from "node:test";
import assert from "node:assert/strict";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root=resolve(dirname(fileURLToPath(import.meta.url)),"../..");
const source=resolve(root,"sources/apois-entregas/src/integrations/supabase/types.ts");
const generated=resolve(root,"schemas/entregas-production-public.types.ts");
const installer=resolve(root,"scripts/install-entregas-current-db-types-v1.mjs");
const critical=["couriers","delivery_jobs","merchant_members","platform_settings",
  "customer_addresses","reviews","notification_preferences"];

test("live 67-table public schema replaces incomplete types only in temporary workspace",()=>{
  const copy=readFileSync(source,"utf8"),full=readFileSync(generated,"utf8");
  const tmp=mkdtempSync(join(tmpdir(),"apois-types-"));
  try {
    const target=resolve(tmp,"src/integrations/supabase/types.ts");
    mkdirSync(dirname(target),{recursive:true});
    copyFileSync(source,target);
    const execute=()=>spawnSync(process.execPath,[installer],{
      cwd:root,encoding:"utf8",
      env:{...process.env,APOIS_ENTREGAS_WORKSPACE:tmp},
    });
    const first=execute();
    assert.equal(first.status,0,first.stderr||first.stdout);
    assert.equal(readFileSync(target,"utf8"),full);
    for(const table of critical) assert.match(full,new RegExp("^      "+table+": \\\\{$","m"));
    assert.ok([...full.matchAll(/^      [a-z_]+: \{$/gm)].length>=67);
    const second=execute();
    assert.equal(second.status,0,second.stderr||second.stdout);
    assert.equal(readFileSync(target,"utf8"),full);
    assert.equal(readFileSync(source,"utf8"),copy,"immutable source types must not change");
  }finally{rmSync(tmp,{recursive:true,force:true})}
});
