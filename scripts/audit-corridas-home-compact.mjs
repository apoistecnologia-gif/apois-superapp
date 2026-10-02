import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

let failed = false;
const fail = (message) => { console.error('[FAIL] Corridas Home compacta: ' + message); failed = true; };
const ok = (message) => console.log('[OK] Corridas Home compacta: ' + message);

function read(path) {
  const full = resolve(path);
  if (!existsSync(full)) { fail('arquivo ausente: ' + path); return ''; }
  return readFileSync(full, 'utf8');
}

const hardener = read('scripts/harden-corridas-home-compact.mjs');
for (const marker of [
  'APOIS_HOME_COMPACT_V2',
  'apois-home-compact-header',
  'apois-home-compact-header-card',
  'apois-home-avatar',
  'apois-home-compact-panel',
  'apois-home-current-location',
  'apois-home-search-compact',
  'apois-home-shortcut-premium',
  'apois-home-bottom-nav',
  'min-h-[64px]',
  'text-[28px]',
  'min-h-11',
  '<PassengerMap',
  'navigate({ to: "/buscar-destino"',
  '<HomeWorkShortcuts />',
  '<CategorySelector />',
]) {
  if (!hardener.includes(marker)) fail('hardener sem marcador: ' + marker);
}
if (!failed) ok('hardener preserva mapa/fluxos e aplica composição compacta');

const profileChain = read('scripts/harden-corridas-superapp-profile-ui.mjs');
if (!profileChain.includes("await import('./harden-corridas-kit-visual.mjs');")) {
  fail('kit visual de Corridas deixou de ser aplicado antes da Home compacta');
}

const modules = read('.apois/modules.json');
const visualIndex = modules.indexOf('harden-superapp-module-mobile-ui.mjs corridas');
const compactIndex = modules.indexOf('harden-corridas-home-compact.mjs');
if (visualIndex < 0 || compactIndex <= visualIndex) {
  fail('Home compacta precisa rodar diretamente depois da cadeia visual de Corridas');
} else {
  ok('ordem do build é kit visual -> Home compacta por execução direta');
}

const packageJson = JSON.parse(read('package.json') || '{}');
if (!String(packageJson.scripts?.['audit:ui'] || '').includes('audit-corridas-home-compact.mjs')) {
  fail('audit:ui não inclui o gate da Home compacta');
} else {
  ok('gate da Home compacta encadeado em audit:ui');
}

process.exit(failed ? 1 : 0);
