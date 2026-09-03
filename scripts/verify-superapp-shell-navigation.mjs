import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve('.');
let failed = false;

function fail(message) {
  failed = true;
  console.error(`[FAIL] ${message}`);
}

function ok(message) {
  console.log(`[OK] ${message}`);
}

function readRequired(path) {
  const full = resolve(root, path);
  if (!existsSync(full)) {
    fail(`arquivo obrigatório ausente: ${path}`);
    return '';
  }
  return readFileSync(full, 'utf8');
}

const buildSource = readRequired('superapp/shell/build.mjs');
if (buildSource) {
  if (buildSource.includes("window.location.replace('/');")) {
    fail('shell ainda injeta navegação absoluta para "/" dentro dos módulos Capacitor');
  } else if (!buildSource.includes("window.location.replace('../../index.html');")) {
    fail('shell não contém retorno relativo explícito ao seletor principal');
  } else {
    ok('fonte do shell usa navegação relativa segura para o seletor');
  }
}

for (const moduleName of ['corridas', 'entregas']) {
  const html = readRequired(`superapp/shell/dist/modules/${moduleName}/index.html`);
  if (!html) continue;

  if (!html.includes('apois-superapp-module-bridge')) {
    fail(`${moduleName}: bridge do alternador de serviços ausente`);
    continue;
  }
  if (html.includes("window.location.replace('/');")) {
    fail(`${moduleName}: bundle final contém retorno absoluto inseguro para "/"`);
    continue;
  }
  if (!html.includes("window.location.replace('../../index.html');")) {
    fail(`${moduleName}: bundle final não retorna ao seletor pelo caminho relativo esperado`);
    continue;
  }
  ok(`${moduleName}: retorno ao seletor é relativo e compatível com o WebView Capacitor`);
}

process.exit(failed ? 1 : 0);
