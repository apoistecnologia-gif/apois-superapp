import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

let failed = false;
function read(path) {
  const full = resolve(path);
  if (!existsSync(full)) {
    console.error(`[FAIL] Partner shell pending push v14: arquivo ausente ${path}`);
    failed = true;
    return '';
  }
  return readFileSync(full, 'utf8');
}

const hardener = read('scripts/harden-partner-shell-startup.mjs');
for (const marker of [
  'const launch=await appPlugin.getLaunchUrl();',
  'if(launch?.url&&relayDeepLink(launch.url))return;',
  'if(consumePendingPartnerPush())return;',
  'const lockedOnLaunch=operationalRole();',
  'Push cruzado não fica órfão',
]) {
  if (!hardener.includes(marker)) {
    console.error(`[FAIL] Shell startup sem proteção de Push pendente: ${marker}`);
    failed = true;
  }
}
const launchIndex = hardener.indexOf('const launch=await appPlugin.getLaunchUrl();');
const pendingIndex = hardener.indexOf('if(consumePendingPartnerPush())return;');
const lockIndex = hardener.indexOf('const lockedOnLaunch=operationalRole();');
if (!(launchIndex >= 0 && pendingIndex > launchIndex && lockIndex > pendingIndex)) {
  console.error('[FAIL] Shell startup: ordem precisa ser deep link -> Push pendente -> lock operacional.');
  failed = true;
} else console.log('[OK] Shell startup consome callbacks e Push antes do redirect operacional.');

const template = read('superapp/partner-shell/index.html');
for (const marker of [
  "const PARTNER_PENDING_PUSH_KEY='apois-parceiro:pending-push';",
  'function consumePendingPartnerPush()',
  'sessionStorage.removeItem(PARTNER_PENDING_PUSH_KEY);',
  'return relayPartnerPush(parsed);',
  'function routeRole(requestedRole,target)',
  'if(locked&&locked!==requestedRole)',
]) {
  if (!template.includes(marker)) {
    console.error(`[FAIL] Template do shell sem roteamento seguro de Push: ${marker}`);
    failed = true;
  }
}

const build = read('superapp/partner-shell/build.mjs');
for (const marker of [
  "import '../../scripts/harden-partner-shell-startup.mjs';",
  "requireMarker(finalShell, 'if(consumePendingPartnerPush())return;'",
  "const pendingIndex = finalShell.indexOf('if(consumePendingPartnerPush())return;');",
  'lockIndex > pendingIndex',
]) {
  if (!build.includes(marker)) {
    console.error(`[FAIL] Bundle final não valida ciclo do Push pendente: ${marker}`);
    failed = true;
  }
}

if (!failed) console.log('[OK] Partner shell pending push v14: Push cruzado é consumido sob a trava atual e não fica armazenado para abrir outra função depois do OFFLINE.');
process.exit(failed ? 1 : 0);
