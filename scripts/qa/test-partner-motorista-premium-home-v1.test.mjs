import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

// Only a synthetic generated UI fixture; no live rides, Android, API or SQL.
const patch = resolve('scripts/apply-partner-motorista-premium-home-v1.mjs');
const fixture = `import { DriverActiveRideRecovery } from "@/components/DriverActiveRideRecovery";
function MotoristaApp() {
  const driverName = "Motorista";
  const online = false;
  const gpsStatus = "granted";
  return (
    <div>
      {/* Top bar — historical glass */}
      {!active && (
        <div><button onClick={() => setSideMenuOpen(true)}>Menu</button><span>{driverName}</span></div>
      )}
      <DriverSideMenu />
      const recenterOffset = "calc(env(safe-area-inset-bottom) + 260px)";
      <IncomingOffer />
      <PickupNavOverlay />
      <ActiveTripNavOverlay />
      <ActiveRidePanel onStart={async (code) => {await callStart(code)}} onComplete={async () => { await callComplete() }} />
      <DriverActiveRideRecovery />
    </div>
  );
}
function IdleBottomPanel() {
  return (
    <div>
      <span>Corridas hoje</span><span>Ganhos hoje</span>
      <button onClick={toggleOnline}>Ficar online</button>
      <button onClick={onUseTestLocation}>Usar localização de teste no Brasil</button>
    </div>
  );
}
function StatMini() {return <div />;}
function IncomingOffer() { return <div />; }
`;
function withFixture(run) {
  const dir=mkdtempSync(resolve(tmpdir(),'apois-premium-home-'));
  const relative='src/routes/motorista.app.tsx';
  const file=resolve(dir, relative);
  mkdirSync(resolve(dir,'src/routes'),{recursive:true});
  writeFileSync(file,fixture);
  try {return run(dir,file);}finally{rmSync(dir,{recursive:true,force:true});}
}
function execute(dir) {
  return spawnSync(process.execPath,[patch],{cwd:process.cwd(),env:{...process.env,APOIS_MOTORISTA_WORKSPACE:dir},encoding:'utf8'});
}

test('renders approved premium home without replacing ride actions',()=>withFixture((dir,file)=>{
  const result=execute(dir);
  assert.equal(result.status,0,result.stderr||result.stdout);
  const s=readFileSync(file,'utf8');
  for(const token of [
    'APOIS_DRIVER_PREMIUM_HOME_V1', 'APOIS_LOGO_DATA_URL',
    'data-apois-premium-driver-header', 'data-apois-premium-driver-summary',
    'data-apois-premium-driver-nav', 'aria-checked={online}', 'onClick={toggleOnline}',
    'DriverActiveRideRecovery', 'Corridas hoje', 'Ganhos hoje', 'Tempo online indisponível',
    'onStart={async (code)', 'onComplete={async () =>',
    '/motorista/corridas', '/motorista/ganhos', '/motorista/perfil',
    'onClick={onUseTestLocation}', '#F51D2A', '#BB071D',
  ])assert.ok(s.includes(token),`Missing ${token}`);
  assert.ok(!s.includes('value="4h 12min"'), 'Never fabricate time online');
  assert.equal((s.match(/<DriverActiveRideRecovery/g)||[]).length,1);

}));

test('fails closed when attempted twice, without modifying first result',()=>withFixture((dir,file)=>{
  assert.equal(execute(dir).status,0);
  const first=readFileSync(file,'utf8');
  const second=execute(dir);
  assert.notEqual(second.status,0);
  assert.equal(readFileSync(file,'utf8'),first);
}));

test('fails closed on changed active-ride anchor; original file intact',()=>withFixture((dir,file)=>{
  const changed=fixture.replace('<ActiveTripNavOverlay />','<SomethingElse />');
  writeFileSync(file,changed);
  const result=execute(dir);
  assert.notEqual(result.status,0);
  assert.equal(readFileSync(file,'utf8'),changed);
}));