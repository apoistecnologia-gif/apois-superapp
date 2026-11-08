import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
const patcher=resolve("scripts/harden-motorista-history-recovery.mjs");
const original=[
 'function DriverRidesPage() {',
 '  const [query, setQuery] = useState("");',
 '  useEffect(() => {',
 '    let active = true;',
 '    void (async () => {',
 '      const profile = await loadDriverProfile();',
 '      setRides(profile);',
 '    })();',
 '    return () => {',
 '      active = false;',
 '    };',
 '  }, []);',
 '          {error && (',
 '            <DSCard className="min-w-0 p-3" role="alert">',
 '              <Body className="break-words text-destructive">{error}</Body>',
 '            </DSCard>',
 '          )}',
 '}',
].join("\n");
test("Histórico Motorista: erro inesperado termina loading e oferece retry",()=>{
 const wd=mkdtempSync(resolve(tmpdir(),"apois-history-"));
 const file=resolve(wd,"src/routes/motorista.corridas.tsx");
 mkdirSync(dirname(file),{recursive:true});
 try{
  writeFileSync(file,original);
  const run=()=>execFileSync(process.execPath,[patcher],{cwd:resolve("."),env:{...process.env,APOIS_MOTORISTA_WORKSPACE:wd}});
  run();const content=readFileSync(file,"utf8");
  for(const snippet of [").catch((cause) => {","if (!active) return;","setRides([]);","[retryNonce]","Tentar novamente","setRetryNonce((n) => n + 1)"]){
    assert.ok(content.includes(snippet),snippet);
  }
  run();assert.equal(readFileSync(file,"utf8"),content,"idempotente");
 }finally{rmSync(wd,{recursive:true,force:true});}
});
test("Histórico Motorista: patch aplicado nos dois builds embutidos",()=>{
 const solo=readFileSync("scripts/build-motorista-module.mjs","utf8");
 const partner=readFileSync("scripts/build-partner-modules.sh","utf8");
 assert.match(solo,/harden-motorista-history-recovery\.mjs/);
 assert.match(partner,/harden-motorista-history-recovery\.mjs/);
 assert.ok(solo.indexOf("harden-motorista-history-recovery.mjs")<solo.indexOf("run('bun', ['install']"));
 assert.ok(partner.indexOf("harden-motorista-history-recovery.mjs")<partner.indexOf("npm run build:motorista"));
});
