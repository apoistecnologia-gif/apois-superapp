import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { checkCorridasBuildEnv, CORRIDAS_URL } from "../verify-corridas-build-env.mjs";
const fake = "sb_publishable_thisisafaketestkey1234567";

test("Corridas usa URL oficial sem aceitar histórico/Entregas", () => {
  assert.equal(checkCorridasBuildEnv(CORRIDAS_URL, fake).format, "publishable");
  for (const url of ["https://vqtucstyduxrqjgyigfk.supabase.co", "https://ptgkwyyolrdgnqketkjj.supabase.co", "https://tbbzkrfupmqdywnzgnms.supabase.co.attacker.test"]) {
    assert.throws(() => checkCorridasBuildEnv(url, fake), /projeto canônico/);
  }
});
test("Corridas rejeita chaves históricas e secretas", () => {
  assert.throws(() => checkCorridasBuildEnv(CORRIDAS_URL, fake, fake), /chave antiga/);
  assert.throws(() => checkCorridasBuildEnv(CORRIDAS_URL, "sb_secret_not_allowed"), /credencial secreta/);
  const jwt=(ref,role)=>"x."+Buffer.from(JSON.stringify({ref,role})).toString("base64url")+".x";
  assert.throws(() => checkCorridasBuildEnv(CORRIDAS_URL, jwt("ptgkwyyolrdgnqketkjj","anon")), /outro projeto/);
  assert.throws(() => checkCorridasBuildEnv(CORRIDAS_URL, jwt("tbbzkrfupmqdywnzgnms","service_role")), /papel não público/);
  assert.equal(checkCorridasBuildEnv(CORRIDAS_URL, jwt("tbbzkrfupmqdywnzgnms","anon")).keyProjectVerified, false);
});
test("Os dois caminhos do Motorista verificam o mesmo ambiente canônico", () => {
  const standalone=readFileSync("scripts/build-motorista-module.mjs","utf8");
  const partner=readFileSync("scripts/build-partner-modules.sh","utf8");
  assert.match(standalone, /verify-corridas-build-env\.mjs/);
  assert.match(partner, /verify-corridas-build-env\.mjs/);
  assert.doesNotMatch(partner, /CORRIDAS_KEY_FROM_SOURCE|require_contains 'vqtucstyduxrqjgyigfk\.supabase\.co'/);
  assert.match(partner, /require_contains 'tbbzkrfupmqdywnzgnms\.supabase\.co'/);
  assert.doesNotMatch(standalone,/corridasUrl\.includes\('vqtucstyduxrqjgyigfk/);
});
