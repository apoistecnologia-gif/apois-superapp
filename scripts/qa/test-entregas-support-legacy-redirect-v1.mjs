import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";

const fileName = "src/routes/chamado-suporte.$ticketId.tsx";
const hardener = resolve("scripts/harden-entregas-support-legacy-route.mjs");
test("Suporte: rota antiga vira alias idempotente para conversa canônica", () => {
  const cwd=mkdtempSync(resolve(tmpdir(),"apois-support-"));
  const path=resolve(cwd,fileName);
  mkdirSync(dirname(path),{recursive:true});
  try{
    writeFileSync(path,[
      'export const Route = createFileRoute("/chamado-suporte/$ticketId")({',
      '  beforeLoad: async () => {}',
      '});',
      'supabase.functions.invoke("customer-support", {body:{action:"list"}});',
      'const canReply = ticket.status !== "closed";',
    ].join("\n"),"utf8");
    const run=()=>execFileSync(process.execPath,[hardener],{cwd:resolve("."),env:{...process.env,APOIS_ENTREGAS_WORKSPACE:cwd}});
    run();
    const next=readFileSync(path,"utf8");
    assert.match(next,/APOIS_SUPPORT_LEGACY_REDIRECT_V1/);
    assert.match(next,/to: "\/perfil\/ajuda\/chamado\/\$ticketId"/);
    assert.match(next,/params: \{ ticketId: params.ticketId \}/);
    assert.match(next,/replace: true/);
    assert.doesNotMatch(next,/customer-support|ticket\.status/);
    run();
    assert.equal(readFileSync(path,"utf8"),next);
  }finally{rmSync(cwd,{recursive:true,force:true});}
});
test("Suporte: nenhum build deixa a rota legada sem normalização", () => {
  const iso=readFileSync("scripts/build-isolated-module.mjs","utf8");
  const partner=readFileSync("scripts/build-partner-modules.sh","utf8");
  assert.match(iso,/harden-entregas-support-legacy-route\.mjs/);
  assert.match(partner,/harden-entregas-support-legacy-route\.mjs/);
  assert.ok(iso.indexOf("harden-entregas-support-legacy-route.mjs")<iso.indexOf("const config = manifest.modules[name];"));
  assert.ok(partner.indexOf("harden-entregas-support-legacy-route.mjs")<partner.indexOf("bun run build"));
});
