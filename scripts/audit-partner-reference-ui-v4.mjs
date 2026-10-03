import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

let failed = false;
const fail = (message) => { console.error('[FAIL] Partner reference V4: ' + message); failed = true; };
const ok = (message) => console.log('[OK] Partner reference V4: ' + message);
const read = (path) => {
  const full = resolve(path);
  if (!existsSync(full)) { fail('arquivo ausente: ' + path); return ''; }
  return readFileSync(full, 'utf8');
};

function requireAll(path, markers, label) {
  const source = read(path);
  if (!source) return;
  const missing = markers.filter((marker) => !source.includes(marker));
  if (missing.length) fail(label + ': ' + missing.join(' | '));
  else ok(label);
}

function forbidAll(path, markers, label) {
  const source = read(path);
  if (!source) return;
  const found = markers.filter((marker) => source.includes(marker));
  if (found.length) fail(label + ': ' + found.join(' | '));
  else ok(label);
}

requireAll('superapp/partner-shell/index.html', [
  'data-apois-partner-reference-v4="true"',
  '__APOIS_MARK_DATA_URL__',
  '__APOIS_BRAND_DATA_URL__',
  'class="partner-mark"',
  'class="partner-wordmark"',
  'APOIS <span>Parceiro</span>',
  'Sou <span>Motorista</span>',
  'Sou <span>Entregador</span>',
  'Entrar como motorista',
  'Entrar como entregador',
  'data-module="motorista"',
  'data-module="entregador"',
  '@media(max-height:780px)',
  '@media(max-width:380px)',
  'function routeRole(requestedRole,target)',
  'async function bootPartnerShell()',
], 'shell fonte segue referência e preserva roteamento');

forbidAll('superapp/partner-shell/index.html', [
  'class="logo"',
  'object-fit:cover',
], 'shell fonte não reintroduz logo circular/cortada');

requireAll('superapp/partner-shell/build.mjs', [
  "resolve(root, '../branding/apois-wordmark-v3.svg')",
  "resolve(root, '../branding/apois-mark-v3.svg')",
  'markDataUrl',
  'data:image/svg+xml;base64',
  ".replace('__APOIS_MARK_DATA_URL__', markDataUrl)",
  "resolve(dist, 'assets/apois-wordmark-v3.svg')",
  "resolve(dist, 'assets/apois-mark-v3.svg')",
  'data-apois-partner-reference-v4="true"',
  "forbidMarker(finalShell, '__APOIS_MARK_DATA_URL__'",
], 'build empacota símbolo + wordmark e valida o shell final');

requireAll('scripts/harden-partner-shell-mobile-ui.mjs', [
  'data-apois-partner-reference-v4',
  'class="role-card motorista"',
  'class="role-card entregador"',
  '@media(max-height:780px)',
  '@media(max-width:380px)',
], 'hardener móvel reconhece a referência V4');

process.exit(failed ? 1 : 0);
