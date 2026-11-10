// APOIS_CORRIDAS_AUTH_VIEWPORT_V2 — static contract for screen-scroll repair.
// A real Android touch/keyboard regression still needs on-device homologation.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
const root=resolve(process.env.APOIS_CORRIDAS_WORKSPACE||'.work/corridas');
const read=p=>readFileSync(resolve(root,p),'utf8');
const layout=read('src/routes/_authenticated.tsx');
const profile=read('src/routes/_authenticated.perfil.tsx');
const nav=read('src/components/BottomNavigation.tsx');
assert.equal(layout.split('APOIS_CORRIDAS_AUTH_VIEWPORT_V2').length-1,1,'Global viewport marker unique');
assert.equal(layout.split('data-apois-corridas-auth-viewport-v2').length-1,1,'Global viewport root unique');
assert.ok(layout.includes('className="fixed inset-x-0 top-0 z-0 flex h-[100dvh]'),'Authenticated shell must not scroll as document');
assert.ok(!layout.includes('min-h-[100dvh] bg-zinc-950 flex justify-center'),'Old unbounded shell must not survive');
assert.ok(layout.includes('const scrollAuthContent ='),'Route-aware scroll policy required');
for(const route of ['/inicio','/perfil','/buscar-destino','/revisar-solicitacao','/corrida/'])
  assert.ok(layout.includes(route),'Map, Profile and fullscreen exception lost: '+route);
assert.ok(layout.includes('className={scrollAuthContent ?'),'Long list routes need their own scrollable content');
assert.ok(layout.includes('overflow-x-hidden overflow-y-auto overscroll-contain'),'Long lists must scroll without moving footer');
assert.ok(layout.includes('relative flex min-h-0 flex-1 flex-col overflow-hidden'),'Maps must retain isolated gestures');
assert.ok(layout.includes('relative w-full max-w-[430px] h-[100dvh] bg-black overflow-hidden flex flex-col'),'Mobile flex viewport changed');
assert.ok(layout.includes('data-apois-android-nav-safe-v1'),'Safe area spacer missing');
assert.ok(layout.includes('{!hideBottomNavigation ? <BottomNavigation /> : null}'),'Fullscreen hide nav behavior changed');
assert.ok(layout.indexOf('<Outlet />')<layout.indexOf('<BottomNavigation />'),'Content must remain above footer');
assert.ok(layout.includes('pathname.startsWith("/corrida/")'),'Ride screens still fullscreen');
assert.ok(profile.includes('min-h-0 flex-1 overflow-y-auto overscroll-contain'),'Profile retains own inner scroll');
for(const t of ['Dados Pessoais','Telefone','E-mail','Segurança','Sair'])assert.ok(profile.includes(t),'Profile action missing '+t);
assert.ok(nav.includes('grid-cols-5')&&nav.includes('min-h-[64px]'),'Bottom tab touch targets preserved');
for(const t of ['Início','Corridas','Carteira','Notificações','Perfil'])
  assert.ok(nav.includes(t),'Bottom tab missing '+t);
console.log('[OK] Corridas authenticated screens: document pinned, list scrolling internal, maps and five tabs intact.');
