import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

let failed = false;
function source(path) {
  const full = resolve(path);
  if (!existsSync(full)) {
    console.error(`[FAIL] Motorista marca v4: arquivo ausente ${path}`);
    failed = true;
    return '';
  }
  return readFileSync(full, 'utf8');
}

const policy = source('scripts/harden-partner-motorista-payment-policy.mjs');
const theme = source('scripts/harden-partner-motorista-brand-theme.mjs');
const external = source('scripts/harden-partner-motorista-external-links.mjs');
for (const marker of [
  "import './harden-partner-motorista-brand-theme.mjs';",
  "import './harden-partner-motorista-external-links.mjs';",
]) {
  if (!policy.includes(marker)) {
    console.error(`[FAIL] Motorista marca v4: pipeline não aplica ${marker}`);
    failed = true;
  }
}
for (const marker of [
  'applyThemeClass("dark");',
  'mq.matches ? "dark" : "light"',
  'title="Tema"',
]) {
  if (!theme.includes(marker)) {
    console.error(`[FAIL] Motorista marca v4: proteção ausente ${marker}`);
    failed = true;
  }
}
for (const marker of [
  'void Browser.open({ url })',
  'Capacitor.isNativePlatform()',
  'openPartnerExternal(event, "https://apoisbrasil.com.br/privacidade")',
  'openPartnerExternal(event, "https://apoisbrasil.com.br/excluir-conta")',
]) {
  if (!external.includes(marker)) {
    console.error(`[FAIL] Motorista marca v4: link externo nativo ausente ${marker}`);
    failed = true;
  }
}
if (!failed) console.log('[OK] Motorista marca v4: identidade preto/dourado fica travada em escuro e links externos usam Browser nativo no Android.');
process.exit(failed ? 1 : 0);
