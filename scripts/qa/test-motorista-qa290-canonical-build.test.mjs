import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(p,'utf8');
test('Android and web QA share QA290 canonical chain; APK remains manual',()=>{
 const apk=read('.github/workflows/apois-motorista-only-qa-apk.yml');
 const web=read('.github/workflows/apois-motorista-approved-visual-web-qa.yml');
 for(const s of [apk,web]){
  assert.ok(s.includes('bash scripts/recover-motorista-qa290-web.sh'));
  assert.ok(!s.includes('node scripts/run-bash.mjs scripts/build-partner-modules.sh'));
 }
 assert.ok(!apk.includes('  push:\n'));
 assert.ok(apk.includes("github.event_name == 'workflow_dispatch'"));
});
test('historical pinned QA290, visual overlay before typecheck, isolated export and shell',()=>{
 const s=read('scripts/recover-motorista-qa290-web.sh');
 for(const m of ['6b0d31dcad5be9b7c7b9a8c651deeca98104b65f','9fc171050d8b5703540c49d19a8f1e9f5162775f','git worktree add --detach','fix-partner-qa290-compact-offer-v1.mjs','bun run typecheck','reconcile-motorista-qa290-visual.mjs','APOIS_PARCEIRO_QA283_PROFILE_COMPLETED_RIDES_V1','APOIS_PARCEIRO_QA284_DRIVER_HISTORY_UI_V1','export APOIS_MOTORISTA_ONLY=1','node superapp/partner-shell/build.mjs','test ! -e superapp/partner-shell/dist/modules/entregador','test -s superapp/partner-shell/dist/motorista-welcome.html'])assert.ok(s.includes(m),m);
 assert.ok(!s.includes('assembleDebug'));
 assert.ok(!s.includes('cap sync'));
 assert.ok(!s.includes('cp -a .work/partner-motorista/.env'));
});
