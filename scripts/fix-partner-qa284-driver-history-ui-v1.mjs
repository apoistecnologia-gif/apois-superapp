/**
 * APOIS_PARCEIRO_QA284_DRIVER_HISTORY_UI_V1
 * Presentation-only: use full-period INV-053 aggregate (not the 50 visible rows),
 * distinguish completed/cancelled, keep gross price intact and addresses legible.
 * Edits disposable .work/partner-motorista only; no SQL, payment, GPS, PIN edits.
 */
import {readFileSync,writeFileSync} from "node:fs";
import {resolve} from "node:path";
const file=resolve(".work/partner-motorista/src/routes/motorista.corridas.tsx");
let src=readFileSync(file,"utf8");
const marker="APOIS_PARCEIRO_QA284_DRIVER_HISTORY_UI_V1";
if(src.includes(marker))throw Error("[FAIL] QA284 already applied");
function once(a,b,label){
 const count=src.split(a).length-1;
 if(count!==1)throw Error("[FAIL] QA284 "+label+" expected 1 anchor, got "+count);
 src=src.replace(a,b);
}
for(const required of [
 "APOIS_REPORT06_HISTORY_PERIOD_V1",
 'const summary = periodSummary;',
 'const [periodSummary,setPeriodSummary]=useState<{total:number;grossVolume:number;avgFare:number}|null>(null);',
 'let completedCount = 0;',
 'for (const ride of seen.values()) {',
 'avgFare: completedCount > 0 ? grossVolume / completedCount : 0',
 'data-apois-premium-screen="driver-rides"',
 'ApoisPremiumDriverNav active="corridas"',
 '.eq("driver_id", driverId)'
])if(!src.includes(required))throw Error("[FAIL] QA284 current protected prerequisite missing: "+required);
once(
 'const [periodSummary,setPeriodSummary]=useState<{total:number;grossVolume:number;avgFare:number}|null>(null);',
 'const [periodSummary,setPeriodSummary]=useState<{total:number;completed:number;cancelled:number;grossVolume:number;avgFare:number}|null>(null);',
 'full period aggregate typing');
once('      let completedCount = 0;',
     '      let completedCount = 0;\n      let cancelledCount = 0;',
     'full period cancelled count');
once('        if (ride.status !== "finalizada" && ride.status !== "completed") continue;',
     '        if (ride.status !== "finalizada" && ride.status !== "completed") {\n          if (ride.status.toLowerCase().startsWith("cancel")) cancelledCount++;\n          continue;\n        }',
     'distinguish statuses in full period aggregate');
once('      setPeriodSummary({ total: seen.size, grossVolume,',
     '      setPeriodSummary({ total: seen.size, completed: completedCount, cancelled: cancelledCount, grossVolume,',
     'include accurate server full-period counts');
once(
  '            <div className="grid grid-cols-1 gap-2 min-[380px]:grid-cols-3 sm:gap-3">\n'+
  '              <SummaryCard label="Corridas" value={summaryLoading ? "…" : summary ? String(summary.total) : "—"} />\n'+
  '              <SummaryCard label="Valor das corridas" value={summaryLoading ? "…" : summary ? brl(summary.grossVolume) : "—"} tone="primary" />\n'+
  '              <SummaryCard label="Tarifa média" value={summaryLoading ? "…" : summary ? brl(summary.avgFare) : "—"} />\n'+
  '            </div>',
  '            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">\n'+
  '              <div className="col-span-2 sm:col-span-1">\n'+
  '                <SummaryCard label="Valor bruto das viagens" value={summaryLoading ? "…" : summary ? brl(summary.grossVolume) : "—"} tone="primary" />\n'+
  '              </div>\n'+
  '              <SummaryCard label="Concluídas" value={summaryLoading ? "…" : summary ? String(summary.completed) : "—"} />\n'+
  '              <SummaryCard label="Tarifa média" value={summaryLoading ? "…" : summary ? brl(summary.avgFare) : "—"} />\n'+
  '            </div>\n'+
  '            {summary && <Caption className="break-words pl-1 !text-[#4B5563]">\n'+
  '              {summary.total} solicitações no período: {summary.completed} concluídas e {summary.cancelled} canceladas.\n'+
  '            </Caption>}',
  'mobile no-wrap layout preserving honest loading/unknown state');
once('            <Caption className="break-words pl-1">Período: {FILTER_LABEL[filter]}</Caption>',
 '            <Caption className="break-words pl-1 !text-[#4B5563]">Período: {FILTER_LABEL[filter]}</Caption>',
 'period readable contrast');
once(
 '            <Caption className="break-words pl-1">\n'+
 '              Este resumo mostra o valor bruto das viagens. Seu saldo e valores realmente creditados ficam em Carteira.\n'+
 '            </Caption>',
 '            <Caption className="break-words pl-1 !text-[#4B5563]">\n'+
 '              O valor bruto inclui viagens finalizadas, inclusive testes de homologação quando existirem. Não é saldo disponível; valores efetivamente creditados ficam em Ganhos/Carteira.\n'+
 '            </Caption>',
 'truthful gross disclaimer');
once('className="flex min-w-0 flex-col gap-1.5 rounded-2xl bg-muted/40 p-2.5"',
 'className="flex min-w-0 flex-col gap-1.5 rounded-2xl border border-[#E7E9ED] !bg-[#F3F4F6] p-2.5"',
 'address background contrast');
const dark='className="min-w-0 break-words leading-5 text-foreground"';
const occur=src.split(dark).length-1;
if(occur!==2)throw Error("[FAIL] QA284 address text expected 2 got "+occur);
src=src.replaceAll(dark,'className="min-w-0 break-words leading-5 !text-[#0D0F12]"');
once('<Body className="mt-1 break-words text-muted-foreground">Revise suas viagens realizadas</Body>',
 '<Body className="mt-1 break-words !text-[#4B5563]">Revise suas viagens realizadas</Body>',
 'history subtitle contrast');
once('          "max-w-full break-words text-[clamp(14px,4.6vw,18px)] font-extrabold leading-tight text-[#111827]",',
 '          "min-w-0 max-w-full whitespace-nowrap text-[clamp(14px,4vw,18px)] font-extrabold leading-tight text-[#111827]",',
 'summary amount nowrap after visual hardener');
once('          tone === "primary" && "text-primary",',
 '          tone === "primary" && "!text-[#BB071D]",',
 'primary amount contrast');
once('      <Label className="break-words text-[#596372]">{label}</Label>',
 '      <Label className="break-words !text-[#4B5563]">{label}</Label>',
 'metric label contrast');
for(const key of [
 'report06HistoryFilter(filter, customFrom, customTo)',
 'setSummaryPartial(!complete)','const summary = periodSummary;',
 'setPeriodSummary({ total: seen.size, completed: completedCount, cancelled: cancelledCount, grossVolume,',
 'ApoisPremiumDriverNav active="corridas"',
 'Carregar corridas anteriores',
 'data-apois-premium-screen="driver-rides"',
 'aria-label="Filtro de período"',
 '<RideCard ride={ride} index={index} />'
])if(!src.includes(key))throw Error("[FAIL] QA284 lost protected functionality: "+key);
src="// "+marker+"\n"+src;
writeFileSync(file,src,"utf8");
console.log("[OK] QA284: full period counts preserved, gross never wrapped, route addresses legible.");
