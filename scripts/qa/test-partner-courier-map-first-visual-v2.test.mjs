import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {spawnSync} from 'node:child_process';

const patch=resolve('scripts/fix-partner-courier-map-first-visual-v2.mjs');
const data={
 'src/components/CourierLocationTracker.tsx': 'function CourierLocationTracker(){  return (\n    <div\n      className={`flex items-center gap-2 rounded-xl border bg-white`}\n      role={status === "error" ? "alert" : "status"}>GPS ativo para receber entregas</div>\n);}',
 'src/components/CourierPremiumViews.tsx': `export function CourierStatusCard({ online, busy, activeJob, onToggle }: any) {
  return (<section data-apois-courier-availability>
    <button type="button" disabled={busy || Boolean(activeJob && online)} onClick={onToggle}
       aria-label={online ? "Ficar offline" : "Ficar online"}
       data-apois-courier-availability-toggle>Ativar</button>
  </section>);
}
export function CourierWaitingSheet() {return <section aria-label="Aguardando novas entregas">Aguardando</section>}
`,
 'src/components/CourierRouteMap.tsx': `export function CourierLiveMap({currentPosition,nearbyMerchants}) {
  return (
    <section className="overflow-hidden rounded-xl">
      <div><p>Mapa em tempo real</p></div>
      <APIProvider>
        <div className="relative h-[clamp(235px,36dvh,375px)] w-full">
          <Map center={currentPosition}><CourierStyledLiveMarkers merchants={nearbyMerchants}/><RecenterControl /></Map>
        </div>
      </APIProvider>
    </section>
  );
}
export function CourierRouteMap({job}) {return <Map/>;}
`,
 'src/routes/courier.tsx': `export function CourierPage() { const [availableCallsOpen,setAvailableCallsOpen]=useState(false);
  const online = Boolean(availability?.is_online);
  return (
    <div className="min-h-dvh bg-white text-black">
      <header className="sticky top-0 z-40">
        <div />
        <div className="flex justify-center py-2">
          <img src={APOIS_PARTNER_LOGO_DATA_URL} alt="APOIS" className="h-11 w-auto" />
        </div>
        <button aria-label="Abrir perfil" onClick={()=>setProfileOpen(true)}>Perfil</button>
      </header>
      <CourierLocationTracker enabled={online} onPosition={setCurrentPosition}/>
      <main data-apois-courier-map-home className="mx-auto p-3">
        <div data-apois-courier-inline-status data-apois-premium-availability={online ? "online" : "offline"}>
          <CourierStatusCard online={online} busy={busy === "online"} activeJob={activeJob} onToggle={toggleOnline}/>
        </div>
        <button data-apois-courier-calls-card-v2 onClick={()=>setAvailableCallsOpen(true)}><span>icon</span><span>Solicitações disponíveis</span></button>
        {online ? <CourierLiveMap /> : <CourierLiveMap />}
        {offers.map(offer=><CourierOfferCard offer={offer}/>)}
        {activeJob && <CourierRouteMap job={activeJob}/>} 
        {completedJob && <CourierCompletionSheet job={completedJob} />}
        {!activeJob && !completedJob && offers.length===0 &&
          <section data-apois-premium-courier-summary>
            <h2 className="mb-2 text-[14px] font-extrabold">Hoje</h2>
            {metrics?.earnings_today}
          </section>}
      </main>
      <CourierBottomNav/>
    </div>
  );
}
`,
 'src/system-theme.css': '.apois-system-theme{background:white}\n',
};
function setup(fn){
 const dir=mkdtempSync(resolve(tmpdir(),'apois-map-first-'));
 for(const [p,s] of Object.entries(data)){
  const file=resolve(dir,p);mkdirSync(resolve(file,'..'),{recursive:true});writeFileSync(file,s);
 }
 try{return fn(dir);}finally{rmSync(dir,{recursive:true,force:true});}
}
const run=dir=>spawnSync(process.execPath,[patch],{cwd:process.cwd(),env:{...process.env,APOIS_ENTREGAS_WORKSPACE:dir},encoding:'utf8'});
test('a live map dominates idle view; the same switch, GPS and request handlers survive',()=>setup(dir=>{
 const result=run(dir);assert.equal(result.status,0,result.stderr||result.stdout);
 const route=readFileSync(resolve(dir,'src/routes/courier.tsx'),'utf8');
 const premium=readFileSync(resolve(dir,'src/components/CourierPremiumViews.tsx'),'utf8');
 const map=readFileSync(resolve(dir,'src/components/CourierRouteMap.tsx'),'utf8');
 const tracker=readFileSync(resolve(dir,'src/components/CourierLocationTracker.tsx'),'utf8');
 const css=readFileSync(resolve(dir,'src/system-theme.css'),'utf8');
 for(const required of ['data-apois-courier-map-first-root-v2','data-apois-courier-map-first-v2={!activeJob && !completedJob && offers.length === 0}',
  'data-apois-premium-courier-summary','data-apois-courier-calls-card-v2','onClick={()=>setAvailableCallsOpen(true)}',
  '<CourierOfferCard', '<CourierRouteMap', '<CourierCompletionSheet','APOIS_PARTNER_LOGO_DATA_URL'])assert.ok(route.includes(required),required);
 for(const required of ['data-apois-courier-premium-status-v2','role="switch"','aria-checked={online}','aria-busy={busy || undefined}',
  'disabled={busy || Boolean(activeJob && online)} onClick={onToggle}','Ficar offline'])assert.ok(premium.includes(required),required);
 assert.ok(map.includes('<Map center={currentPosition}>'));
 assert.ok(map.includes('<RecenterControl'));
 assert.ok(map.includes('data-apois-courier-map-canvas-v2'));
 assert.ok(tracker.includes('data-apois-courier-gps-status-v2'));
 assert.ok(tracker.includes('role={status === "error" ? "alert" : "status"}'));
 assert.ok(css.includes('height:calc(100dvh - 208px)!important'));
 assert.ok(css.includes('section[aria-label="Aguardando novas entregas"]'));
 assert.ok(css.includes('data-apois-courier-calls-card-v2'));
 assert.equal((premium.match(/data-apois-courier-availability-toggle/g)||[]).length,1);
}));
test('fail closed on repeat patch, with no changes to any input',()=>setup(dir=>{
 assert.equal(run(dir).status,0);
 const before=Object.keys(data).map(p=>readFileSync(resolve(dir,p),'utf8'));
 const again=run(dir);assert.notEqual(again.status,0);
 assert.deepEqual(Object.keys(data).map(p=>readFileSync(resolve(dir,p),'utf8')),before);
}));
test('fail closed on missing request callback, without partially writing other files',()=>setup(dir=>{
 const p='src/routes/courier.tsx',src=readFileSync(resolve(dir,p),'utf8');writeFileSync(resolve(dir,p),src.replace('onClick={()=>setAvailableCallsOpen(true)}','onClick={()=>undefined}'));
 const before=Object.keys(data).map(p=>readFileSync(resolve(dir,p),'utf8'));
 const result=run(dir);assert.notEqual(result.status,0);
 assert.deepEqual(Object.keys(data).map(p=>readFileSync(resolve(dir,p),'utf8')),before);
}));