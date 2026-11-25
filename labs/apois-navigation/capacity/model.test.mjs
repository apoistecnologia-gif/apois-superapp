import test from "node:test";
import assert from "node:assert/strict";
import {planCapacity,readLocalEvidence} from "./model.mjs";
const assumptions={activeDrivers:100,daysPerMonth:26,ridesPerDriverDay:8,reroutesPerLeg:.5,peakHourShare:.15,burstFactor:3,reserveFraction:.25};
test("unknown prices and traffic stay unknown, quota and ceiling are separate",()=>{
  const r=planCapacity(assumptions);
  assert.equal(r.monthlyRoutes,62400);assert.equal(r.peakRequestsPerMinute,18);
  assert.equal(r.requiredQuotaPerMinute,24);assert.equal(r.monthlyCostCeilingBrl,500);
  assert.equal(r.configuredQuotaFits,true);assert.equal(r.withinBudget,null);
  assert.equal(r.localEvidenceCoversOfferedLoad,null);assert.equal(r.productionCapacityVerified,false);
});
test("configured quota fails at higher demand despite larger budget",()=>{
  const r=planCapacity({...assumptions,activeDrivers:500});
  assert.equal(r.requiredQuotaPerMinute,120);assert.equal(r.configuredQuotaFits,false);
  assert.equal(r.monthlyCostCeilingBrl,2500);
});
test("explicit hypothetical inputs compute payload egress, variable and fixed costs",()=>{
  const r=planCapacity({...assumptions,meanResponseBytes:10000,mapGbPerDriver:.1,egressBrlPerGb:2,fixedMonthlyBrl:300,variableBrlPer1000Routes:1});
  assert.equal(r.routePayloadGb,.62);assert.equal(r.mapPayloadGb,10);
  assert.equal(r.estimatedCostBrl,383.65);assert.equal(r.estimatedCostPerDriverBrl,3.84);
  assert.equal(r.withinBudget,true);assert.equal(r.maxFixedMonthlyBrl,416.35);
});
const report={requests:300,successes:300,failures:{},durationSeconds:75,totalLatency:{p95Ms:30},responseBytes:{total:3000000,max:12000},samples:[{},{}]};
test("successful local evidence can inform payload and offered load, not production certification",()=>{
  assert.equal(readLocalEvidence(report).achievedPerMinute,240);
  const r=planCapacity({...assumptions,localEvidence:report});
  assert.equal(r.localEvidenceCoversOfferedLoad,true);assert.equal(r.routePayloadGb,.62);
  assert.equal(r.productionCapacityVerified,false);assert.equal(r.withinBudget,null);
});
test("failed, short or inconsistent evidence must be rejected",()=>{
  for(const patch of [{successes:299},{failures:{"gateway:503":1}},{durationSeconds:10},{responseBytes:{total:3000000,max:1}},{samples:[]}])
    assert.throws(()=>readLocalEvidence({...report,...patch}));
  for(const patch of [{reserveFraction:1},{activeDrivers:0},{peakHourShare:0},{reroutesPerLeg:-1},{fixedMonthlyBrl:-1}])
    assert.throws(()=>planCapacity({...assumptions,...patch}));
});

import {readFileSync} from "node:fs";
test("verified regional evidence feeds projected payload without claiming production capacity",()=>{
  const e=JSON.parse(readFileSync(new URL("./evidence-45617361926.json",import.meta.url),"utf8"));
  assert.equal(e.source.runId,45617361926);
  const r=planCapacity({...assumptions,activeDrivers:1000,localEvidence:e.report});
  assert.equal(r.monthlyRoutes,624000);
  assert.equal(r.routePayloadGb,11.88);
  assert.equal(r.requiredQuotaPerMinute,240);
  assert.equal(r.configuredQuotaFits,false);
  assert.equal(r.localEvidenceCoversOfferedLoad,true);
  assert.equal(r.productionCapacityVerified,false);
  assert.equal(r.estimatedCostBrl,null);
});
