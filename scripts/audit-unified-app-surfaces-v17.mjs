import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

let failed = false;
const fail = (message) => { console.error(`[FAIL] Unified surfaces v17: ${message}`); failed = true; };
const ok = (message) => console.log(`[OK] Unified surfaces v17: ${message}`);

const codemagicPath = resolve('codemagic.yaml');
if (!existsSync(codemagicPath)) fail('codemagic.yaml ausente');
else {
  const codemagic = readFileSync(codemagicPath, 'utf8');
  for (const marker of ['android-superapp-experimental:', 'android-partner-superapp:', 'APOIS-Superapp.apk', 'APOIS-Parceiro.apk']) {
    if (!codemagic.includes(marker)) fail(`workflow/artefato unificado ausente (${marker})`);
  }
  for (const forbidden of [
    'android-field-apps-test:',
    'APOIS-Motorista.apk',
    'APOIS-Entregador.apk',
    'Build signed Motorista APK',
    'Build signed Entregador APK',
  ]) {
    if (codemagic.includes(forbidden)) fail(`workflow separado legado reapareceu (${forbidden})`);
  }
  const workflowKeys = [...codemagic.matchAll(/^  ([a-z0-9-]+):$/gm)].map((match) => match[1]);
  const required = ['android-superapp-experimental', 'android-partner-superapp'];
  const allowed = new Set([
    'android-superapp-experimental',
    'android-superapp-homologacao',
    'android-partner-superapp',
  ]);
  const unexpected = workflowKeys.filter((key) => !allowed.has(key));
  if (required.some((key) => !workflowKeys.includes(key))) {
    fail(`Codemagic perdeu um dos dois apps unificados; encontrados: ${workflowKeys.join(', ') || 'nenhum'}`);
  } else if (unexpected.length) {
    fail(`Codemagic expõe workflow fora dos dois apps unificados: ${unexpected.join(', ')}`);
  } else {
    ok('Codemagic expõe somente APOIS Superapp (produção/homologação) e APOIS Parceiro');
  }
}

for (const path of ['scripts/build-test-motorista.sh', 'scripts/build-test-entregador.sh']) {
  if (existsSync(resolve(path))) fail(`script de APK separado legado ainda existe (${path})`);
}
if (!existsSync(resolve('scripts/build-test-motorista.sh')) && !existsSync(resolve('scripts/build-test-entregador.sh'))) {
  ok('atalhos de build dos APKs separados foram removidos');
}

const packageJson = JSON.parse(readFileSync(resolve('package.json'), 'utf8'));
const scriptsText = JSON.stringify(packageJson.scripts ?? {});
for (const forbidden of ['build-test-motorista', 'build-test-entregador', 'android-field-apps-test']) {
  if (scriptsText.includes(forbidden)) fail(`package.json voltou a referenciar fluxo separado (${forbidden})`);
}
if (!failed) ok('não há caminho oficial para reinstalar Motorista/Entregador como APKs separados');

process.exit(failed ? 1 : 0);
