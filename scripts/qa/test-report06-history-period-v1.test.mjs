// Relatorio 06 / INV-053: actual route generators on a throwaway pinned source.
// Never contacts Supabase, creates an APK, or mutates the protected snapshot.
import test from "node:test";
import assert from "node:assert/strict";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
const root=resolve(dirname(fileURLToPath(import.meta.url)),"../..");
const originalPath=resolve(root,"sources/apois-corridas-motorista-admin/src/routes/motorista.corridas.tsx");
const scripts=[
  "scripts/harden-motorista-history-recovery.mjs",
  "scripts/fix-motorista-history-cursor-v1.mjs",
  "scripts/fix-report06-motorista-history-period-v1.mjs",
];
function bodyBetween(text,start,end){
 const a=text.indexOf(start); assert.ok(a>=0,"start absent: "+start);
 const b=text.indexOf(end,a+start.length);assert.ok(b>a,"end absent: "+end);
 return text.slice(a+start.length,b);
}
test("INV-053 original route: period and cursor transformations are repeatable",()=>{
 assert.ok(existsSync(originalPath),"pinned Driver source must exist; initialize the locked source first");
 const original=readFileSync(originalPath,"utf8");
 const workspace=mkdtempSync(join(tmpdir(),"apois-report06-"));
 try{
  const target=join(workspace,"src/routes/motorista.corridas.tsx");
  mkdirSync(dirname(target),{recursive:true});copyFileSync(originalPath,target);
  function run(script){
   const r=spawnSync(process.execPath,[resolve(root,script)],{
     cwd:root,encoding:"utf8",env:{...process.env,APOIS_MOTORISTA_WORKSPACE:workspace}
   });
   assert.equal(r.status,0,script+": "+r.stderr+r.stdout);
  }
  for(const script of scripts)run(script);
  const generated=readFileSync(target,"utf8");
  assert.match(generated,/APOIS_REPORT06_HISTORY_PERIOD_V1/);
  assert.match(generated,/\.eq\("driver_id", driverId\)\s*\.or\(report06HistoryFilter\(filter, customFrom, customTo\)\)/);
  assert.match(generated,/const cursorFilter = report06HistoryFilter\(filter, customFrom, customTo, cursor\)/);
  assert.match(generated,/\.limit\(51\)/);
  assert.match(generated,/\.range\(offset, offset \+ batchSize - 1\)/);
  assert.match(generated,/setSummaryPartial\(!complete\)/);
  assert.match(generated,/summaryLoading \? "…" : summary \?/);
  assert.match(generated,/const price = report06ValidAmount\(ride.final_price\) \?\? report06ValidAmount\(ride.estimated_price\)/);
  assert.match(generated,/const distance = report06ValidAmount\(ride.distance_km\)/);
  assert.match(generated,/O resumo cobre o período inteiro/);
  assert.doesNotMatch(generated,/const summary = useMemo\(\(\) =>/);
  for(const script of scripts)run(script);
  assert.equal(readFileSync(target,"utf8"),generated,"report 06 must be idempotent with existing recovery/cursor");
  assert.equal(readFileSync(originalPath,"utf8"),original,"locked source must remain unmodified");

  const amountBody=bodyBetween(generated,
   "function report06ValidAmount(value: unknown): number | null {\n","\n}");
  const amount=new Function("value",amountBody);
  for(const [v,wanted] of [[null,null],[undefined,null],["",null],[" ",null],[0,0],["0",0],[20,20],[-2,null],[NaN,null]]){
   assert.equal(amount(v),wanted,"amount "+String(v));
  }
  const boundsBody=bodyBetween(generated,
   "function report06Bounds(filter: Filter, customFrom: string, customTo: string): { from: Date | null; to: Date | null } {\n","\n}");
  const startToday=()=>{const d=new Date();d.setHours(0,0,0,0);return d;};
  const ago=n=>{const d=startToday();d.setDate(d.getDate()-(n-1));return d;};
  const bounds=new Function("filter","customFrom","customTo","startOfToday","daysAgo",boundsBody);
  const getBounds=(filter,from,to)=>bounds(filter,from,to,startToday,ago);
  const filterBody=bodyBetween(generated,
   "cursor?: { created_at: string; id: string }): string {\n","\n}");
  const filterFn=new Function("filter","customFrom","customTo","cursor","report06Bounds",filterBody);
  const period=(filter,from,to,cursor)=>filterFn(filter,from,to,cursor,getBounds);
  const old=period("custom","2025-01-01","2025-01-31");
  assert.match(old,/completed_at\.gte\.2025-01-01T/);
  assert.match(old,/completed_at\.lte\.2025-01-31T/);
  assert.match(old,/created_at\.gte\.2025-01-01T/);
  assert.match(old,/completed_at\.is\.null/);
  const cursor={created_at:"2026-11-09T13:00:00.000Z",id:"00000000-0000-4000-8000-000000000001"};
  const older=period("d30","","",cursor);
  assert.equal(older.split("id.lt."+cursor.id).length,3,"cursor applies to both time branches");
  for(const name of ["today","d7","d30","custom"])assert.match(period(name,"",""),/and\(completed_at\.is\.null/);

  const aggregateBody=bodyBetween(generated,
   "      let grossVolume = 0;\n","      setPeriodSummary({");
  const aggregate=new Function("seen","report06ValidAmount",aggregateBody+
   "\nreturn {total:seen.size,grossVolume,completedCount,avgFare:completedCount ? grossVolume/completedCount:0};");
  for(const n of [0,1,50,51,500]){
   const data=Array.from({length:n},(_,i)=>({id:String(i),status:i%10===0?"cancelled":"finalizada",
     final_price:i===2?null:i===3?0:20,estimated_price:35}));
   const result=aggregate(new Map(data.map(r=>[r.id,r])),amount);
   const completed=data.filter(r=>r.status==="finalizada");
   const expected=completed.reduce((sum,r)=>sum+(amount(r.final_price)??amount(r.estimated_price)??0),0);
   assert.equal(result.total,n,"period count "+n);
   assert.equal(result.grossVolume,expected,"period gross "+n);
   assert.equal(result.completedCount,completed.length,"completed count "+n);
  }
 }finally{rmSync(workspace,{recursive:true,force:true});}
});
