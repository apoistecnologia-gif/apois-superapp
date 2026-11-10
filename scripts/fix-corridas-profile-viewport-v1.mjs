// APOIS_CORRIDAS_AUTH_VIEWPORT_V2 — correct the same physical Android screen
// displacement on every authenticated Passenger route, not only Profile.
// The outer shell never scrolls. Long lists/forms scroll INSIDE the content
// viewport. Map, destination, review and active ride keep gesture isolation.
// Preserve nav safe-area, auth, API hooks, destinations and actual ride actions.
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
const workspace=resolve(process.env.APOIS_CORRIDAS_WORKSPACE||'.work/corridas');
const file=resolve(workspace,'src/routes/_authenticated.tsx');
let src=readFileSync(file,'utf8');
if(src.includes('APOIS_CORRIDAS_AUTH_VIEWPORT_V2'))
  throw Error('[FAIL] Corridas authenticated viewport already transformed');
const routeAnchor='  const hideBottomNavigation = pathname === "/buscar-destino" || pathname === "/revisar-solicitacao" || pathname.startsWith("/corrida/");';
if(src.split(routeAnchor).length!==2)
  throw Error('[FAIL] Corridas viewport: authenticated route gate changed');
src=src.replace(routeAnchor,routeAnchor+
  '\n  // APOIS_CORRIDAS_AUTH_VIEWPORT_V2: map routes retain non-scrolling inner surface.'+
  '\n  const scrollAuthContent = !["/inicio", "/perfil", "/buscar-destino", "/revisar-solicitacao"].includes(pathname) && !pathname.startsWith("/corrida/");');
const oldOuter='className="min-h-[100dvh] bg-zinc-950 flex justify-center selection:bg-yellow-500/30 overflow-hidden"';
const newOuter='data-apois-corridas-auth-viewport-v2="true" className="fixed inset-x-0 top-0 z-0 flex h-[100dvh] justify-center overflow-hidden overscroll-none bg-zinc-950 selection:bg-yellow-500/30"';
if(src.split(oldOuter).length!==2)throw Error('[FAIL] Corridas viewport: outer layout drift');
src=src.replace(oldOuter,newOuter);
const oldContent='className="flex-1 relative overflow-hidden flex flex-col"';
const newContent='className={scrollAuthContent ? "relative flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto overscroll-contain" : "relative flex min-h-0 flex-1 flex-col overflow-hidden"}';
if(src.split(oldContent).length!==2)throw Error('[FAIL] Corridas viewport: content layout drift');
src=src.replace(oldContent,newContent);
// Avoid an accidental duplicated or disappearing footer/overlay while migrating
// every route from document scrolling into the authenticated flex column.
for(const marker of [
  'data-apois-corridas-auth-viewport-v2','const scrollAuthContent =',
  'data-apois-android-nav-safe-v1', '<Outlet />', '<BottomNavigation />',
  'pathname.startsWith("/corrida/")', 'max-w-[430px] h-[100dvh]',
  'overflow-y-auto overscroll-contain', 'overflow-hidden',
]){
  if(!src.includes(marker))throw Error('[FAIL] Corridas viewport contract missing '+marker);
}
const profile=readFileSync(resolve(workspace,'src/routes/_authenticated.perfil.tsx'),'utf8');
for(const marker of ['min-h-0 flex-1 overflow-y-auto overscroll-contain','Dados Pessoais','Segurança']){
  if(!profile.includes(marker))throw Error('[FAIL] Corridas Perfil: inner scroll/action missing '+marker);
}
writeFileSync(file,src,'utf8');
console.log('[OK] Corridas all authenticated routes: outer shell stays in viewport; lists scroll inside, map gestures and nav safe area preserved.');
