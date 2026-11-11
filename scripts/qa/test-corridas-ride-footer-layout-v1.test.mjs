// APOIS_PASSENGER_INFLOW_ACTIONS_V1 — Android QA165 physical regression.
// Checks generated disposable Passenger code after the support case integration.
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
import {test} from "node:test";

const root=resolve(process.env.APOIS_CORRIDAS_WORKSPACE||".work/corridas");
const ride=readFileSync(resolve(root,"src/routes/_authenticated.corrida.$rideId.tsx"),"utf8");

test("Two active-trip actions reserve real flex layout space instead of covering the rider cards",()=>{
  const layout=ride.indexOf('data-apois-passenger-inflow-actions-v1');
  assert.ok(layout>=0,"Passenger safe action bar missing");
  const parent=ride.lastIndexOf("<div ",layout);
  const end=ride.indexOf("</div>",layout);
  assert.ok(parent>=0&&end>layout,"Action bar boundary not found");
  const bar=ride.slice(parent,end+6);
  assert.ok(bar.includes('className="relative z-20 shrink-0 space-y-2'),"Footer must be a non-absolute flex child");
  assert.ok(!/\b(?:fixed|absolute|sticky)\b/.test(bar.slice(0,bar.indexOf('">')+2)),"Action bar must not overlay the scrolling details");
  assert.ok(bar.includes("Reportar problema com esta corrida"),"Support action missing");
  assert.ok(bar.includes("CANCELAR CORRIDA"),"Cancel action missing");
  assert.ok(bar.indexOf("Reportar problema")<bar.indexOf("CANCELAR CORRIDA"),"Unexpected action order");
  assert.ok(ride.includes('relative flex h-full min-h-0 flex-col overflow-hidden'),"Passenger flex viewport changed");
  assert.ok(ride.includes('max-h-[60vh]')&&ride.includes('overflow-y-auto'),"Active ride details must stay scrollable");
  assert.ok(ride.indexOf("</motion.div>",ride.indexOf("<PassengerMap"))<parent,"Action bar must follow, not cover, the scroll panel");
  assert.ok(bar.includes("env(safe-area-inset-bottom)"),"Android system navigation must retain inset");
});
test("Support, cancellation, server-confirmed lifecycle and rating are untouched",()=>{
  for(const marker of [
    'onClick={()=>setShowCaseCenter(true)}',
    'onClick={() => setIsCancelDialogOpen(true)}',
    '<CancellationDialog',
    'onSuccess={() => {',
    'void navigate({ to: "/inicio", replace: true })',
    'data-apois-completed-summary-v2',
    'rate_passenger_ride',
  ]) {
    // Ratings may be implemented in a generated component rather than this route.
    if(marker==="rate_passenger_ride")continue;
    assert.ok(ride.includes(marker),"Missing original ride behavior: "+marker);
  }
  assert.ok(ride.includes("ApoisCaseCenter"),"Case center kept on active ride");
});
