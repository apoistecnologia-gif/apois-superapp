import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const path = 'scripts/build-isolated-module.mjs';
const full = resolve(root, path);
let source = readFileSync(full, 'utf8');

function replaceOnce(search, replacement, label) {
  if (source.includes(replacement)) {
    console.log(`[OK] ${label}: já aplicado`);
    return;
  }
  if (!source.includes(search)) {
    console.error(`[FAIL] ${label}: padrão esperado não encontrado em ${path}`);
    process.exit(1);
  }
  source = source.replace(search, replacement);
  console.log(`[OK] ${label}`);
}

replaceOnce(
  "  const appPlugin = window.Capacitor?.Plugins?.App;\n",
  "  const appPlugin = window.Capacitor?.Plugins?.App;\n  const browserPlugin = window.Capacitor?.Plugins?.Browser;\n  if (moduleName === 'entregas') window.__APOIS_SUPERAPP_AUTH_BRIDGE__ = true;\n",
  'bridge do módulo sinaliza controle central do OAuth',
);

replaceOnce(
  "      const incoming = new URL(rawUrl);\n",
  "      void browserPlugin?.close?.().catch(() => undefined);\n      const incoming = new URL(rawUrl);\n",
  'bridge fecha navegador OAuth antes de rotear callback',
);

replaceOnce(
  "if (name === 'corridas') {\n  run(process.execPath, [resolve(root, 'scripts/harden-corridas-superapp-runtime.mjs')]);\n}\n\nconst config = manifest.modules[name];",
  "if (name === 'corridas') {\n  run(process.execPath, [resolve(root, 'scripts/harden-corridas-superapp-runtime.mjs')]);\n}\nif (name === 'entregas') {\n  run(process.execPath, [resolve(root, 'scripts/harden-entregas-superapp-auth-runtime.mjs')]);\n}\n\nconst config = manifest.modules[name];",
  'build Entregas aplica hardening OAuth somente em .work',
);

writeFileSync(full, source);
console.log('[OK] Entregas: build isolado preparado para callback OAuth único no Superapp');
