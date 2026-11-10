// APOIS_CLIENT_HOME_VIEWPORT_V2 — examine the real selector HTML, including
// the copy embedded inside the Android APK. Fail closed on missing scroll rails.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
const file=resolve(process.argv[2]||'superapp/shell/dist/index.html');
const html=readFileSync(file,'utf8');
const marker='/* APOIS_CLIENT_HOME_VIEWPORT_V2 */';
assert.equal(html.split(marker).length-1,1,'Only one initial-screen viewport guard');
const start=html.indexOf(marker),end=html.indexOf('</style>',start);
assert.ok(start>0&&end>start,'Home guard must exist inside CSS');
const guard=html.slice(start,end);
for(const required of [
 'html{height:100%;overflow:hidden;overscroll-behavior:none}',
 'body{height:100dvh;min-height:0;overflow:hidden;overscroll-behavior:none}',
 '.screen{height:100dvh;min-height:0;display:flex;flex-direction:column;overflow:hidden}',
 '.content{flex:1;min-height:0;min-width:0;overflow:hidden}',
 '.top,.hero,.footer-copy{flex-shrink:0}',
 '.services{flex:1 1 auto;min-height:0;min-width:0;align-items:start;overflow-x:hidden;overflow-y:auto;overscroll-behavior-y:contain;',
 '.footer-copy{margin-top:0;',
]) assert.ok(guard.includes(required),'Home viewport contract missing: '+required);
assert.ok(!guard.includes('touch-action:none')&&!guard.includes('pointer-events:none'),'Touch and buttons must remain available');
for(const preserved of [
 '<main class="screen">','<div class="content">','<div class="top">',
 '<section class="hero">','<section class="services"','<div class="footer-copy">',
 'data-module="corridas"','data-module="entregas"',
 'aria-label="Acessar Corridas"','aria-label="Acessar Entregas"',
 'function openModule(moduleName)','window.location.replace(destination)',
 'function relayAuthDeepLink(rawUrl)','APOIS • VAMOS?',
]) assert.ok(html.includes(preserved),'Selector navigation or branding removed: '+preserved);
assert.ok(html.includes('alt="APOIS"')&&html.includes('O seu caminho,')&&html.includes('do seu jeito.'),'Brand/header missing');
console.log('[OK] Cliente selector: heading/logo/footer anchored; only services scroll; both buttons, auth callbacks, brand intact: '+file);
