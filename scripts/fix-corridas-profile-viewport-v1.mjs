// APOIS_CORRIDAS_PROFILE_VIEWPORT_V1 — QA physical Android screen-scroll regression.
// Only the disposable Corridas workspace is touched: on /perfil, pin the
// authenticated shell to the visual viewport. Profile content retains its
// existing inner scroll and BottomNavigation remains in the shell flex column.
// On every other route, preserve the exact old classes and ride/map behavior.
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';

const workspace=resolve(process.env.APOIS_CORRIDAS_WORKSPACE||'.work/corridas');
const file=resolve(workspace,'src/routes/_authenticated.tsx');
let src=readFileSync(file,'utf8');
const marker='APOIS_CORRIDAS_PROFILE_VIEWPORT_V1';
if(src.includes(marker))throw Error('[FAIL] Profile viewport patch applied twice');
const routeAnchor='  const hideBottomNavigation = pathname === "/buscar-destino" || pathname === "/revisar-solicitacao" || pathname.startsWith("/corrida/");';
if(src.split(routeAnchor).length!==2)throw Error('[FAIL] Perfil viewport: authenticated routing anchor changed');
src=src.replace(routeAnchor,routeAnchor+
  '\n  // '+marker+': prevent Android WebView document scroll from moving the fixed footer.'+
  '\n  const lockProfileViewport = pathname === "/perfil";');
const original='className="min-h-[100dvh] bg-zinc-950 flex justify-center selection:bg-yellow-500/30 overflow-hidden"';
if(src.split(original).length!==2)throw Error('[FAIL] Perfil viewport: original authenticated shell class drift');
src=src.replace(original,
  'data-apois-corridas-profile-viewport-v1={lockProfileViewport ? "true" : undefined}\n'+
  '                                    className={lockProfileViewport\n'+
  '                                      ? "fixed inset-x-0 top-0 z-0 flex h-[100dvh] justify-center overflow-hidden overscroll-none bg-zinc-950 selection:bg-yellow-500/30"\n'+
  '                                      : "min-h-[100dvh] bg-zinc-950 flex justify-center selection:bg-yellow-500/30 overflow-hidden"}');
for(const required of [
  'data-apois-android-nav-safe-v1','<Outlet />','<BottomNavigation />',
  'pathname.startsWith("/corrida/")','const lockProfileViewport = pathname === "/perfil";',
  'fixed inset-x-0 top-0 z-0 flex h-[100dvh]',
  'h-[100dvh] bg-black overflow-hidden flex flex-col',
]){
  if(!src.includes(required))throw Error('[FAIL] Perfil viewport: preserved contract missing '+required);
}
const profile=readFileSync(resolve(workspace,'src/routes/_authenticated.perfil.tsx'),'utf8');
for(const required of ['min-h-0 flex-1 overflow-y-auto overscroll-contain','currentProfile','Dados Pessoais','Segurança']){
  if(!profile.includes(required))throw Error('[FAIL] Perfil viewport: inner scroll/profile content changed '+required);
}
writeFileSync(file,src,'utf8');
console.log('[OK] Corridas Perfil: document scroll anchored to viewport; inner content scroll and Android footer preserved; maps and other routes unchanged.');
