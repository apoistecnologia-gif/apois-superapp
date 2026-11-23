/**
 * APOIS_PARCEIRO_QA284_DRIVER_HISTORY_UI_V1
 * Presentation-only: honest completed/cancelled counts, readable gross fare,
 * clear QA-inclusive disclaimer and legible addresses. After premium patches,
 * only in disposable .work/partner-motorista, NEVER protected sources/SQL.
 */
import {readFileSync,writeFileSync} from "node:fs";
import {resolve} from "node:path";
const file=resolve(".work/partner-motorista/src/routes/motorista.corridas.tsx");
let src=readFileSync(file,"utf8");
const marker="APOIS_PARCEIRO_QA284_DRIVER_HISTORY_UI_V1";
if(src.includes(marker))throw Error("[FAIL] QA284 already applied");
function one(a,b,label) {
 const count=src.split(a).length-1;
 if(count!==1)throw Error("[FAIL] QA284 "+label+": expected 1 anchor, got "+count);
 src=src.replace(a,b);
}
for(const required of [
 'data-apois-premium-screen="driver-rides"',
 'ApoisPremiumDriverNav active="corridas"',
 '.from("rides")',
 '.eq("driver_id", driverId)',
 'const finished = list.filter((r) => r.status === "finalizada");',
 'const avgFare = finished.length ? grossVolume / finished.length : 0;',
 'const total = list.length;',
 'return { total, grossVolume, avgFare };',
]) if(!src.includes(required))throw Error("[FAIL] QA284 protected prerequisite missing: "+required);

one("    const total = list.length;",
    '    const total = list.length;\n    const completed = finished.length;\n    const cancelled = list.filter((r) => r.status.toLowerCase().startsWith("cancel")).length;',
    "count status split");
one("    return { total, grossVolume, avgFare };",
    "    return { total, completed, cancelled, grossVolume, avgFare };",
    "summary returned fields");
one(
    '            <div className="grid grid-cols-1 gap-2 min-[380px]:grid-cols-3 sm:gap-3">\n'+
    '              <SummaryCard label="Corridas" value={String(summary.total)} />\n'+
    '              <SummaryCard label="Valor das corridas" value={brl(summary.grossVolume)} tone="primary" />\n'+
    '              <SummaryCard label="Tarifa média" value={brl(summary.avgFare)} />\n'+
    "            </div>",
    '            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">\n'+
    '              <div className="col-span-2 sm:col-span-1">\n'+
    '                <SummaryCard label="Valor bruto das viagens" value={brl(summary.grossVolume)} tone="primary" />\n'+
    '              </div>\n'+
    '              <SummaryCard label="Concluídas" value={String(summary.completed)} />\n'+
    '              <SummaryCard label="Tarifa média" value={brl(summary.avgFare)} />\n'+
    '            </div>\n'+
    '            <Caption className="break-words pl-1 text-[#4B5563]">\n'+
    '              {summary.total} solicitações no período: {summary.completed} concluídas e {summary.cancelled} canceladas.\n'+
    '            </Caption>',
    "mobile summary keeps full gross amount and honest counts");
one('            <Caption className="break-words pl-1">Período: {FILTER_LABEL[filter]}</Caption>',
    '            <Caption className="break-words pl-1 text-[#4B5563]">Período: {FILTER_LABEL[filter]}</Caption>',
    "period contrast");
one(
    '            <Caption className="break-words pl-1">\n'+
    '              Este resumo mostra o valor bruto das viagens. Seu saldo e valores realmente creditados ficam em Carteira.\n'+
    '            </Caption>',
    '            <Caption className="break-words pl-1 text-[#4B5563]">\n'+
    '              O valor bruto inclui viagens finalizadas, inclusive testes de homologação quando existirem. Não é saldo disponível; valores efetivamente creditados ficam em Ganhos/Carteira.\n'+
    '            </Caption>',
    "QA-inclusive gross disclaimer");
one('className="flex min-w-0 flex-col gap-1.5 rounded-2xl bg-muted/40 p-2.5"',
    'className="flex min-w-0 flex-col gap-1.5 rounded-2xl border border-[#E7E9ED] !bg-[#F3F4F6] p-2.5"',
    "readable address surface");
const dark='className="min-w-0 break-words leading-5 text-foreground"';
const darkOccurrences=src.split(dark).length-1;
if(darkOccurrences!==2)throw Error("[FAIL] QA284 expected two address bodies, got "+darkOccurrences);
src=src.replaceAll(dark,'className="min-w-0 break-words leading-5 !text-[#0D0F12]"');
one('<Body className="mt-1 break-words text-muted-foreground">Revise suas viagens realizadas</Body>',
    '<Body className="mt-1 break-words text-[#4B5563]">Revise suas viagens realizadas</Body>',
    "history subtitle contrast");
one('<Caption className="mt-0.5 block break-words leading-4">',
    '<Caption className="mt-0.5 block break-words leading-4 !text-[#4B5563]">',
    "ride card date contrast");
one('          "max-w-full break-words text-[clamp(14px,4.6vw,18px)] leading-tight",',
    '          "min-w-0 max-w-full whitespace-nowrap text-[clamp(14px,4vw,18px)] leading-tight !text-[#0D0F12]",',
    "single line currency");
one('          tone === "primary" && "text-primary",',
    '          tone === "primary" && "!text-[#BB071D]",',
    "summary primary color");
one('      <Label className="break-words">{label}</Label>',
    '      <Label className="break-words !text-[#4B5563]">{label}</Label>',
    "summary label contrast");
for(const invariant of [
  'data-apois-premium-screen="driver-rides"',
  'ApoisPremiumDriverNav active="corridas"',
  '.eq("driver_id", driverId)',"setRides(",
  'passengerMap','<RideCard ride={ride} index={index} />',
  'Link','StatusPill','aria-label="Filtro de período"',
  'const finished = list.filter((r) => r.status === "finalizada");',
  'const avgFare = finished.length ? grossVolume / finished.length : 0;',
])if(!src.includes(invariant))throw Error("[FAIL] QA284 lost functional invariant "+invariant);
src="// "+marker+"\n"+src;
writeFileSync(file,src,"utf8");
console.log("[OK] QA284: history gross fare unbroken, completed/cancelled distinct, legible addresses and truthful QA note.");
