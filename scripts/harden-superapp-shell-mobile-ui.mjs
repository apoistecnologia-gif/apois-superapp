import './harden-superapp-shell-iconography.mjs';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const path = resolve('superapp/shell/index.html');
let source = readFileSync(path, 'utf8');

source = source
  .replace('body{min-height:100dvh;overflow-x:hidden}', 'body{min-height:100dvh;overflow-x:hidden;overflow-y:auto}')
  .replace('padding:max(env(safe-area-inset-top),20px) 18px max(env(safe-area-inset-bottom),24px);overflow:hidden;', 'padding:max(env(safe-area-inset-top),20px) 18px max(52px,env(safe-area-inset-bottom));overflow-x:hidden;overflow-y:auto;');

// APOIS_CLIENT_HOME_VIEWPORT_V2 — the selector was scrolling the entire
// Android WebView and moving the logo/headline into the system status bar.
// Restrict the viewport at the outer shell. On short screens, scroll only the
// two service cards, leaving the logo/heading and footer visible. No changes
// to button handlers, OAuth relay, maps, authentication or protected modules.
const HOME_MARKER = '/* APOIS_CLIENT_HOME_VIEWPORT_V2 */';
const homeViewportCss = `
  ${HOME_MARKER}
  html{height:100%;overflow:hidden;overscroll-behavior:none}
  body{height:100dvh;min-height:0;overflow:hidden;overscroll-behavior:none}
  .screen{height:100dvh;min-height:0;display:flex;flex-direction:column;overflow:hidden}
  .content{flex:1;min-height:0;min-width:0;overflow:hidden}
  .top,.hero,.footer-copy{flex-shrink:0}
  .services{flex:1 1 auto;min-height:0;min-width:0;align-items:start;overflow-x:hidden;overflow-y:auto;overscroll-behavior-y:contain;-webkit-overflow-scrolling:touch;padding:3px 2px 12px}
  .footer-copy{margin-top:0;padding:8px 0 2px}
  @media(max-height:560px){.top{min-height:66px}.logo-mark{width:60px;height:60px}.hero{margin:4px auto 8px}.hero h1{font-size:clamp(23px,6vw,28px)}.hero p{margin-top:6px;font-size:12px}}
`;
if (!source.includes(HOME_MARKER)) {
  if (source.split('</style>').length !== 2) throw new Error('[FAIL] Selector viewport: HTML style closing anchor changed');
  source = source.replace('</style>', homeViewportCss + '\n</style>');
}
if (source.split(HOME_MARKER).length !== 2) throw new Error('[FAIL] Selector viewport: expected one scroll protection');
for (const requirement of [
  'body{height:100dvh;min-height:0;overflow:hidden;',
  '.screen{height:100dvh;min-height:0;display:flex;',
  '.content{flex:1;min-height:0;min-width:0;overflow:hidden}',
  '.services{flex:1 1 auto;min-height:0;',
  'overflow-y:auto;overscroll-behavior-y:contain',
]) {
  if (!source.includes(requirement)) throw new Error('[FAIL] Selector viewport: ' + requirement);
}

for (const marker of [
  '--red:#E51B23',
  '--red-dark:#C9141B',
  'background:linear-gradient(180deg,#fff 0%,#fff8f7 66%,#fff1f2 100%)',
  '<h2>Corridas</h2>',
  '<h2>Entregas</h2>',
  'data-module="corridas"',
  'data-module="entregas"',
  'O seu caminho,',
  'do seu jeito.',
  '@media(max-height:760px)',
  'min-height:126px',
  'aspect-ratio:1/1',
]) {
  if (!source.includes(marker)) throw new Error(`[FAIL] Shell cliente: identidade vermelha ausente (${marker})`);
}
if (/🚘|🚗|🏍️|🛍|🛵|📦/.test(source)) {
  throw new Error('[FAIL] Shell Cliente: emoji de serviço não pode substituir a ilustração visual.');
}

writeFileSync(path, source, 'utf8');
console.log('[OK] Shell cliente: seletor APOIS vermelho/branco, responsivo e com ilustrações próprias.');
