import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const patch = resolve('scripts/apply-partner-courier-premium-home-v1.mjs');
const page = `import { Loader2, RefreshCw, UserRound, XCircle } from "lucide-react";
import {
  ActiveDelivery,
  CourierWaitingSheet,
} from "@/components/CourierPremiumViews";
function CourierApp() {
  const metrics = { completed_deliveries_today: 2, earnings_today: 15.5, online_seconds_today: 3600 };
  const offers=[]; const activeJob=null; const completedJob=null; const online=false;
  return <div>
    <CourierLiveMap />
    <main data-apois-courier-map-home className="example">
      {activeJob ? <CourierRouteMap /> : offers.length ? <CourierOfferCard /> : <CourierLiveMap />}
      <CourierCompletionSheet />
        <div data-apois-courier-inline-status className="mx-auto w-full max-w-lg py-2">
          <CourierStatusCard online={online} busy={busy === "online"} activeJob={activeJob} onToggle={toggleOnline} />
        </div>
      </main>

      <CourierSupportSheet />
      <CourierBottomNav />
      {/* completed_deliveries_today */}
  </div>;
}`;
function withFixture(fn) {
  const dir=mkdtempSync(resolve(tmpdir(), 'apois-courier-'));
  mkdirSync(resolve(dir,'src/routes'),{recursive:true});
  const route=resolve(dir,'src/routes/courier.tsx');
  const css=resolve(dir,'src/system-theme.css');
  writeFileSync(route,page);writeFileSync(css,'/* existing styles */\n');
  try { return fn(dir,route,css); } finally { rmSync(dir,{recursive:true,force:true}); }
}
const run=(dir)=>spawnSync(process.execPath,[patch],{cwd:process.cwd(),env:{...process.env,APOIS_ENTREGAS_WORKSPACE:dir},encoding:'utf8'});
test('courier availability and real daily indicators on approved layout',()=>withFixture((dir,route,css)=>{
  const result=run(dir);assert.equal(result.status,0,result.stderr||result.stdout);
  const s=readFileSync(route,'utf8');
  assert.ok(s.indexOf('data-apois-courier-inline-status')<s.indexOf('CourierRouteMap'), 'Availability must precede route map');
  for(const token of ['onToggle={toggleOnline}', 'data-apois-premium-courier-summary',
    'CourierOfferCard', 'CourierCompletionSheet', 'CourierSupportSheet', 'CourierBottomNav',
    'completed_deliveries_today', 'courierMoney(metrics.earnings_today)', 'formatCourierOnlineTime(metrics.online_seconds_today)',
    'metrics?.earnings_today == null', 'metrics?.online_seconds_today == null']) assert.ok(s.includes(token),token);
  assert.equal((s.match(/<CourierStatusCard/g)||[]).length,1);
  assert.ok(readFileSync(css,'utf8').includes('background:#E6FAED!important'));
}));
test('courier premium transform is not repeated or allowed to corrupt output',()=>withFixture((dir,route,css)=>{
  assert.equal(run(dir).status,0);const first=readFileSync(route,'utf8');const firstCss=readFileSync(css,'utf8');
  const result=run(dir);assert.notEqual(result.status,0);assert.equal(readFileSync(route,'utf8'),first);assert.equal(readFileSync(css,'utf8'),firstCss);
}));
test('missing callbacks fail closed and preserve source',()=>withFixture((dir,route,css)=>{
  const broken=page.replace('onToggle={toggleOnline}','onToggle={() => undefined}');writeFileSync(route,broken);
  const result=run(dir);assert.notEqual(result.status,0);assert.equal(readFileSync(route,'utf8'),broken);
}));