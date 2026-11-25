// Generate the historical Motorista-only web chain, inside RUNNER_TEMP.
// This transforms only the disposable script's environment assertions; all
// historical functional/visual gates remain. No production URL/key or APK.
import {readFileSync,writeFileSync,realpathSync} from "node:fs";
import {join} from "node:path";
import {execFileSync} from "node:child_process";
import assert from "node:assert/strict";
const [stageArg,repoArg]=process.argv.slice(2);
const stage=realpathSync(stageArg),repo=realpathSync(repoArg);
assert.ok(stage.startsWith(realpathSync(process.env.RUNNER_TEMP)+"/"));
const head=p=>execFileSync("git",["-C",p,"rev-parse","HEAD"],{encoding:"utf8"}).trim();
assert.equal(head(stage),"6b0d31dcad5be9b7c7b9a8c651deeca98104b65f");
assert.equal(head(join(stage,"sources/apois-corridas-motorista-admin")),"9fc171050d8b5703540c49d19a8f1e9f5162775f");
assert.equal(head(join(stage,"sources/apois-entregas")),"2f4606e0fb52dffb49f2e6aebbe921ce687ab625");
const source=readFileSync(join(stage,"scripts/build-partner-release.sh"),"utf8");
const halves=source.split("# ---------------- Entregador ----------------");
assert.equal(halves.length,2);
let script=halves[0];
assert.equal((script.match(/npm run build:motorista/g)||[]).length,1);
assert.ok(script.includes("bun run typecheck")&&script.includes("fix-partner-qa290-compact-offer-v1.mjs"));
const old="tbbzkrfupmqdywnzgnms.supabase.co";
assert.equal(script.split(old).length,3);
script=script.replaceAll(old,"apois-navigation-lab.invalid");
const anchor='(cd "$ROOT" && node "$ROOT/scripts/verify-report05-motorista-security-v1.mjs")';
assert.equal(script.split(anchor).length,2);
script=script.replace(anchor,()=> 'node "$APOIS_CURRENT_ROOT/scripts/reconcile-motorista-qa290-visual.mjs"\n'+anchor);
assert.ok(!/npm run build:entregador|gradle |assembleRelease|assembleDebug|supabase (db push|functions deploy)/.test(script));
writeFileSync(join(stage,".navigation-qa290-web.sh"),script);
console.log("[OK] exact historical Motorista chain isolated; synthetic environment gate only; no delivery build");
