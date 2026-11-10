// APOIS_CORRIDAS_PROFILE_VIEWPORT_V1 — focused regression gate for QA recording.
// No Android device is simulated here; physical verification follows the APK.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
const root=resolve(process.env.APOIS_CORRIDAS_WORKSPACE||'.work/corridas');
const read=p=>readFileSync(resolve(root,p),'utf8');
const layout=read('src/routes/_authenticated.tsx');
const profile=read('src/routes/_authenticated.perfil.tsx');
const nav=read('src/components/BottomNavigation.tsx');
assert.equal(layout.split('APOIS_CORRIDAS_PROFILE_VIEWPORT_V1').length-1,1,'Scoped viewport marker unique');
assert.equal(layout.split('data-apois-corridas-profile-viewport-v1').length-1,1,'Profile viewport attribute unique');
assert.ok(layout.includes('const lockProfileViewport = pathname === "/perfil";'),'Only profile may pin shell');
assert.ok(layout.includes('className={lockProfileViewport'),'Conditional layout class must follow profile route');
assert.ok(layout.includes('fixed inset-x-0 top-0 z-0 flex h-[100dvh]'),'Fixed profile shell prevents document-scrolling footer');
assert.ok(layout.includes(': "min-h-[100dvh] bg-zinc-950 flex justify-center selection:bg-yellow-500/30 overflow-hidden"'),'All non-profile routes retain original shell');
assert.ok(layout.includes('relative w-full max-w-[430px] h-[100dvh] bg-black overflow-hidden flex flex-col'),'Internal flex viewport preserved');
assert.ok(layout.includes('data-apois-android-nav-safe-v1'),'Android safe footer spacer preserved');
assert.ok(layout.includes('{!hideBottomNavigation ? <BottomNavigation /> : null}'),'Fullscreen route footer behavior preserved');
assert.ok(layout.includes('pathname.startsWith("/corrida/")'),'Ride routes remain fullscreen');
assert.ok(profile.includes('min-h-0 flex-1 overflow-y-auto overscroll-contain'),'Only profile content should scroll');
for(const t of ['Dados Pessoais','Telefone','E-mail','Segurança','Sair'])assert.ok(profile.includes(t),'Profile action missing '+t);
assert.ok(nav.includes('grid-cols-5')&&nav.includes('min-h-[64px]'),'Bottom tab touch targets preserved');
for(const label of ['Início','Corridas','Carteira','Notificações','Perfil'])assert.ok(nav.includes(label),'Bottom tab missing '+label);
console.log('[OK] Corridas Perfil: viewport pinned only for /perfil, scroll stays inside, tabs and all routes preserved.');
