// Node fixture tests: generated workspaces, not authenticated E2E or real Supabase.
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const scriptsDir = fileURLToPath(new URL("../", import.meta.url));
function fixture(name, sources, checks) {
  const cwd = mkdtempSync(join(tmpdir(), "apois-cases-"));
  try {
    for (const [path, source] of Object.entries(sources)) {
      const target = join(cwd, path);
      mkdirSync(resolve(target, ".."), { recursive: true });
      writeFileSync(target, source, "utf8");
    }
    const script = join(scriptsDir, name);
    const first = spawnSync(process.execPath, [script], { cwd, encoding: "utf8" });
    assert.equal(first.status, 0, first.stderr || first.stdout);
    checks(cwd);
    const second = spawnSync(process.execPath, [script], { cwd, encoding: "utf8" });
    assert.equal(second.status, 0, second.stderr || second.stdout);
    checks(cwd);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
}

const rider = [
  'import { Button } from "@/components/ui/button";',
  'function Trip(){',
  '  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);',
  '  return <main>',
  '        {actionAvailability?.canCancel && (',
  '          <button>Cancelar</button>',
  '        )}',
  '      <CancellationDialog',
  '      />',
  '  </main>;',
  '}',
].join("\n");
const history = [
  'import { createFileRoute } from "@tanstack/react-router";',
  'function CorridasPage(){return <main>',
  '        <nav aria-label="Filtrar histórico de corridas">',
  '        </nav>',
  '  </main>}',
].join("\n");

function contrast(hexA,hexB){
  const luminance = hex => {
    const rgb = hex.match(/[a-f0-9]{2}/gi).map(ch => parseInt(ch,16)/255);
    const linear = rgb.map(v=>v<=0.04045?v/12.92:((v+0.055)/1.055)**2.4);
    return 0.2126*linear[0]+0.7152*linear[1]+0.0722*linear[2];
  };
  const a=luminance(hexA),b=luminance(hexB);
  return (Math.max(a,b)+0.05)/(Math.min(a,b)+0.05);
}

test("Passageiro: atalho de protocolo é inserido após restaurar histórico e não duplica",()=>{
  fixture("harden-corridas-case-center-v1.mjs",{
    ".work/corridas/src/routes/_authenticated.corrida.$rideId.tsx":rider,
    ".work/corridas/src/routes/_authenticated.corridas.tsx":history,
  }, cwd=>{
    const root=join(cwd,".work/corridas/src");
    const archive=readFileSync(join(root,"routes/_authenticated.corridas.tsx"),"utf8");
    const trip=readFileSync(join(root,"routes/_authenticated.corrida.$rideId.tsx"),"utf8");
    const center=readFileSync(join(root,"components/ApoisCaseCenter.tsx"),"utf8");
    assert.equal(archive.split('<Link to="/ocorrencias"').length-1,1);
    assert.ok(archive.includes("APOIS_CASES_ARCHIVE_V2"));
    assert.equal(trip.split("Reportar problema com esta corrida").length-1,1);
    assert.ok(trip.includes("bg-[#FFF1F2]") && trip.includes("text-[#991B1B]"));
    assert.ok(center.includes("APOIS_CASE_CENTER_CONTEXT_SAFE_V2"));
    assert.ok(center.includes("detailSequence.current===sequence"));
    assert.ok(center.includes("setNewCaseFiles("));
  });
  assert.ok(contrast("991B1B","FFF1F2")>=4.5);
});

test("Motorista/staff: gerador preserva contexto, descarte de resposta antiga e anexo não clicável",()=>{
  fixture("fix-partner-support-case-workroom-v1.mjs",{
    ".work/partner-motorista/src/routes/motorista.suporte.tsx": [
      'import { HelpCenterView } from "@/components/support/HelpCenterView";',
      'function Driver(){return <SettingsPageShell>',
      '        </SettingsPageShell>',
      '}',
    ].join("\n"),
    ".work/partner-motorista/src/routes/admin.suporte.tsx": [
      'import { AdminLayout } from "@/components/admin/AdminLayout";',
      'function Admin(){return <AdminLayout>',
      '    </AdminLayout>',
      '}',
    ].join("\n"),
  },cwd=>{
    const root=join(cwd,".work/partner-motorista/src");
    const component=readFileSync(join(root,"components/ApoisCaseWorkroom.tsx"),"utf8");
    assert.ok(component.includes("APOIS_CASE_CONTEXT_SAFE_V2"));
    assert.ok(component.includes("detailSequence.current===sequence"));
    assert.ok(component.includes("draftsRef.current.set(previous"));
    assert.ok(component.includes("Anexo indisponível."));
    assert.ok(!component.includes("href={file.url??undefined}"));
    assert.ok(component.includes("apois_request_driver_statement"));
    assert.ok(readFileSync(join(root,"routes/motorista.suporte.tsx"),"utf8").includes("ApoisCaseWorkroom"));
    assert.ok(readFileSync(join(root,"routes/admin.suporte.tsx"),"utf8").includes("ApoisCaseWorkroom"));
  });
});
