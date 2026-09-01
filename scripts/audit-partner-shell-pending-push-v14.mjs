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
  'const newBlock = `    async function bootPartnerShell()',
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

// O hardener preserva blocos antigos apenas como padrões de migração. A ordem
// operacional deve ser medida no newBlock efetivamente escrito no shell, e não
// no arquivo inteiro, pois o oldBlock contém propositalmente a ordem insegura
// que será substituída.
const newBlockStart = hardener.indexOf('const newBlock = `');
// O hardener pode ajustar o whitespace ao redor do template literal. Recorte
// pelo próximo código de aplicação, sem depender da quebra exata de linha.
const newBlockEnd = newBlockStart >= 0 ? hardener.indexOf('if (source.includes(oldBlock))', newBlockStart) : -1;
const runtimeBlock = newBlockStart >= 0 && newBlockEnd > newBlockStart
  ? hardener.slice(newBlockStart, newBlockEnd)
  : '';
const launchIndex = runtimeBlock.indexOf('const launch=await appPlugin.getLaunchUrl();');
const pendingIndex = runtimeBlock.indexOf('if(consumePendingPartnerPush())return;');
const lockIndex = runtimeBlock.indexOf('const lockedOnLaunch=operationalRole();');
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
