import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const source=readFileSync(".work/partner-motorista/src/routes/motorista.corridas.tsx","utf8");
test("QA284 history: completed and cancelled are distinct without dropping rows",()=>{
 for(const key of [
 "APOIS_PARCEIRO_QA284_DRIVER_HISTORY_UI_V1",
 'let cancelledCount = 0;',
 'if (ride.status.toLowerCase().startsWith("cancel")) cancelledCount++;',
 "setPeriodSummary({ total: seen.size, completed: completedCount, cancelled: cancelledCount, grossVolume,",
 "const summary = periodSummary;",
 "label=\"Concluídas\"",
 "{summary.total} solicitações no período: {summary.completed} concluídas e {summary.cancelled} canceladas.",
 '.from("rides")', '.eq("driver_id", driverId)',
 '<RideCard ride={ride} index={index} />'
 ])assert.ok(source.includes(key),"QA284 required historic contract: "+key);
 assert.ok(!source.includes('<SummaryCard label="Corridas" value={summaryLoading ? "…" : summary ? String(summary.total) : "—"} />'),"Unqualified total would confuse cancelled with finalized");
});
test("QA284 display gross fares without visual split or implying confirmed revenue",()=>{
 for(const key of [
 'grid grid-cols-2 gap-3 sm:grid-cols-3',
 'col-span-2 sm:col-span-1',
 'label="Valor bruto das viagens"',
 'whitespace-nowrap',
 'inclusive testes de homologação',
 'Não é saldo disponível',
 '!bg-[#F3F4F6]',
 '!text-[#0D0F12]',
 '!text-[#4B5563]',
 'ApoisPremiumDriverNav active="corridas"',
 'data-apois-premium-screen="driver-rides"',
 ])assert.ok(source.includes(key),"QA284 history display guard: "+key);
 const label=source.slice(source.indexOf("function SummaryCard("),source.indexOf("function FilterPill("));
 assert.ok(label.includes("whitespace-nowrap"),"gross amount must not break across lines");
 assert.ok(!source.includes('Este resumo mostra o valor bruto das viagens. Seu saldo e valores realmente creditados ficam em Carteira.'));
});
