// INV-052: assertions on the actual helper generated inside .work, without jsPDF/network.
import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
const file=resolve(process.env.APOIS_MOTORISTA_WORKSPACE||".work/partner-motorista","src/lib/driverReceipt.ts");
const source=readFileSync(file,"utf8");
const match=source.match(/function finiteNonNegative\(value: unknown\): number \| null \{([\s\S]*?)\n\}/);
assert.ok(match,"actual receipt conversion helper exists");
const finiteNonNegative=new Function("value",match[1]);
test("INV-052: null/undefined/empty are unavailable, zero is legitimate",()=>{
 for (const value of [null,undefined,"","  ","\t",Number.NaN,-1,-0.5,Infinity,-Infinity,"invalid"]) {
   const expected=Object.is(value, -0.5)||value===-1||value===Infinity||value===-Infinity||Number.isNaN(value)||value==="invalid"||value==null||String(value).trim()==="" ? null:undefined;
   if(expected===null)assert.equal(finiteNonNegative(value),null,String(value));
 }
 for (const value of [0,"0",35,20.75]) assert.equal(finiteNonNegative(value),Number(value));
});
test("INV-052: price fallback, both missing and missing metrics",()=>{
 const value=(final,estimated)=>finiteNonNegative(final)??finiteNonNegative(estimated);
 assert.equal(value(null,35),35);
 assert.equal(value(undefined,35),35);
 assert.equal(value("",35),35);
 assert.equal(value(0,35),0);
 assert.equal(value(-1,35),35);
 assert.equal(value(null,null),null);
 assert.equal(finiteNonNegative(null),null);
 assert.equal(finiteNonNegative(undefined),null);
});
test("INV-052: rendered receipt branch labels estimation without payment confirmation",()=>{
 assert.match(source,/finalPrice === null && estimatedPrice !== null \? "Valor estimado da corrida"/);
 assert.match(source,/Valor estimado, não comprova pagamento/);
 assert.match(source,/if \(parsed === null\) return "—";/);
 assert.doesNotMatch(source,/doc\.text\("Total pago"/);
});
