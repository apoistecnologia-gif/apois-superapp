import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

let failed = false;
const read = (path) => readFileSync(resolve(path), 'utf8');
const ok = (m) => console.log('[OK] APOIS reference UI V3: ' + m);
const fail = (m) => { console.error('[FAIL] APOIS reference UI V3: ' + m); failed = true; };

const wordmark = read('superapp/branding/apois-wordmark-v3.svg');
for (const marker of ['viewBox="0 0 760 190"','#F5222D','#FFFFFF','#D9A520','APOIS, VAMOS?']) {
  if (!wordmark.includes(marker)) fail('wordmark sem marcador ' + marker);
}
if (!failed) ok('wordmark horizontal dedicado preserva vermelho, branco e dourado');

const mark = read('superapp/branding/apois-mark-v3.svg');
for (const marker of ['viewBox="0 0 512 512"','#F5222D','#F4C44E']) {
  if (!mark.includes(marker)) fail('mark do app sem marcador ' + marker);
}
if (!failed) ok('mark quadrado dedicado não reutiliza wordmark horizontal no launcher');

const shell = read('superapp/shell/index.html');
for (const marker of ['./assets/apois-wordmark-v3.svg','object-fit:contain','O seu caminho.','Do seu jeito.','Entrar em Corridas','Entrar em Entregas']) {
  if (!shell.includes(marker)) fail('shell sem marcador ' + marker);
}
if (!failed) ok('seletor cliente segue referência premium com logo inteira');

const brand = read('scripts/apply-apois-brand-v2.mjs');
for (const marker of ['superapp/branding/apois-wordmark-v3.svg','data:image/svg+xml;base64']) {
  if (!brand.includes(marker)) fail('Brand V2 sem wordmark SVG: ' + marker);
}
if (brand.includes("BRAND_SOURCE = resolve(root, 'superapp/branding/apois-launcher.png')")) {
  fail('Brand V2 voltou a usar launcher como logo de tela');
} else ok('logo de tela está separada do launcher');

const launcher = read('scripts/install-superapp-launcher.mjs');
for (const marker of ['apois_launcher_mark.xml','@drawable/apois_launcher_mark','mipmap-anydpi-v26','#F5222D','#F4C44E']) {
  if (!launcher.includes(marker)) fail('launcher sem marcador ' + marker);
}
if (!failed) ok('launcher e splash usam mark vetorial próprio');

const modules = read('.apois/modules.json');
for (const marker of ['harden-corridas-search-anchor-v4.mjs','harden-corridas-reference-login-v3.mjs']) {
  if (!modules.includes(marker)) fail('pipeline Corridas sem ' + marker);
}
if (!failed) ok('pipeline aplica busca ancorada e login de referência');

const search = read('scripts/harden-corridas-search-anchor-v4.mjs');
for (const marker of ['data-apois-search-fullscreen-v3="true"','data-apois-search-anchor-v4="true"','height: 100dvh !important','padding-top: max(42px, env(safe-area-inset-top)) !important']) {
  if (!search.includes(marker)) fail('search anchor sem marcador ' + marker);
}
if (!failed) ok('busca mantém fullscreen sem pan excessivo do teclado');

const login = read('scripts/harden-corridas-reference-login-v3.mjs');
for (const marker of ['data-apois-reference-login-v3="true"','object-fit: contain !important','Entrar na APOIS','Continuar com Google']) {
  if (!login.includes(marker)) fail('login V3 sem marcador ' + marker);
}
if (!failed) ok('login preserva autenticação e força logo inteira');

process.exit(failed ? 1 : 0);
