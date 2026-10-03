import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

let failed = false;
const read = (path) => readFileSync(resolve(path), 'utf8');
const ok = (m) => console.log('[OK] APOIS reference UI V3: ' + m);
const fail = (m) => { console.error('[FAIL] APOIS reference UI V3: ' + m); failed = true; };

const wordmark = read('superapp/branding/apois-wordmark-v3.svg');
for (const marker of ['viewBox="0 0 760 190"','#E51B23','#C9141B','#111111','APOIS, VAMOS?']) {
  if (!wordmark.includes(marker)) fail('wordmark sem marcador ' + marker);
}
for (const legacy of ['#F5222D','#FF1F2D','#D9A520','#F4C44E','#A97808']) {
  if (wordmark.includes(legacy)) fail('wordmark ainda contém cor antiga ' + legacy);
}
if (!failed) ok('wordmark horizontal preserva geometria oficial e usa vermelho/preto');

const mark = read('superapp/branding/apois-mark-v3.svg');
for (const marker of ['viewBox="0 0 512 512"','#E51B23','#C9141B','#111111']) {
  if (!mark.includes(marker)) fail('mark do app sem marcador ' + marker);
}
if (!failed) ok('mark quadrado dedicado usa a mesma identidade vermelho/preto');

const shell = read('superapp/shell/index.html');
for (const marker of ['./assets/apois-mark-v3.svg','class="brand-lockup"','--bg:#F7F7F8','--red:#E51B23','O seu caminho.','Do seu jeito.','Entrar em Corridas','Entrar em Entregas']) {
  if (!shell.includes(marker)) fail('shell sem marcador ' + marker);
}
if (!failed) ok('seletor cliente segue referência V4 com base clara e marca íntegra');

const brand = read('scripts/apply-apois-brand-v2.mjs');
for (const marker of ['superapp/branding/apois-wordmark-v3.svg','superapp/branding/apois-mark-v3.svg','data:image/svg+xml;base64','color-scheme: light']) {
  if (!brand.includes(marker)) fail('aplicador central sem marcador: ' + marker);
}
if (brand.includes("BRAND_SOURCE = resolve(root, 'superapp/branding/apois-launcher.png')")) {
  fail('aplicador voltou a usar launcher como logo de tela');
} else ok('logo de tela continua separada do launcher');

const launcher = read('scripts/install-superapp-launcher.mjs');
for (const marker of ['apois_launcher_mark.xml','@drawable/apois_launcher_mark','mipmap-anydpi-v26','#FFFFFF','#E51B23','#111111']) {
  if (!launcher.includes(marker)) fail('launcher sem marcador ' + marker);
}
if (!failed) ok('launcher e splash usam mark vetorial vermelho/preto sobre branco');

const modules = read('.apois/modules.json');
for (const marker of ['harden-corridas-reference-login-v3.mjs','harden-corridas-reference-ui-v4.mjs','apply-apois-brand-v2.mjs corridas']) {
  if (!modules.includes(marker)) fail('pipeline Corridas sem ' + marker);
}
if (modules.includes("search-anchor-v4' && node scripts/harden-corridas-search-anchor-v4.mjs")) {
  fail('pipeline voltou a executar o search-anchor legado conflitante');
}
const uiIndex = modules.indexOf('harden-corridas-reference-ui-v4.mjs');
const brandIndex = modules.indexOf('apply-apois-brand-v2.mjs corridas');
if (!(uiIndex >= 0 && brandIndex > uiIndex)) fail('identidade central não é a última camada visual de Corridas');
else ok('pipeline aplica UI de referência e depois a identidade central sem tocar no fluxo');

const referenceUi = read('scripts/harden-corridas-reference-ui-v4.mjs');
for (const marker of [
  'data-apois-reference-login-v4="true"',
  'data-apois-logo-mark-v4="true"',
  'Entrar na APOIS',
  '<PassengerGoogleLoginButton />',
  'to="/recuperar-senha"',
  'onSubmit={handleLogin}',
  'APOIS_SEARCH_VIEWPORT_V4',
  'data-apois-search-fullscreen-v3="true"',
]) {
  if (!referenceUi.includes(marker)) fail('reference UI V4 sem marcador ' + marker);
}
if (!failed) ok('login e busca preservam contratos funcionais enquanto a camada visual muda');

const googleButtonGate = read('scripts/harden-corridas-reference-login-v3.mjs');
for (const marker of ['PassengerGoogleLoginButton','googleButton.includes(\'Continuar com Google\')']) {
  if (!googleButtonGate.includes(marker)) fail('gate do login Google ausente: ' + marker);
}
if (!failed) ok('login Google continua validado no componente canônico');

process.exit(failed ? 1 : 0);
