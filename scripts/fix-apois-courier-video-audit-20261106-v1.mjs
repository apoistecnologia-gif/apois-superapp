// APOIS_COURIER_VIDEO_AUDIT_20261106_V1
// Correcoes observadas no video 1001992572.mp4, APENAS em .work/partner-entregador.
// Nao altera pagamentos, precos, ofertas, GPS, autenticao nem Supabase.
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
const root=resolve(process.env.APOIS_ENTREGAS_WORKSPACE || ".work/partner-entregador");
function exact(s, before, after, label) {
  const n=s.split(before).length-1;
  if(n!==1)throw Error("[FAIL] Courier video "+label+": anchor count "+n);
  return s.replace(before,after);
}
function patch(file, fn, marker) {
  const path=resolve(root,file), before=readFileSync(path,"utf8");
  if(before.includes(marker)){console.log("[OK] Courier video already applied "+file);return;}
  const result=fn(before);
  if(before===result || !result.includes(marker))throw Error("[FAIL] Courier video ineffective "+file);
  writeFileSync(path,result,"utf8");
  console.log("[OK] Courier video "+file);
}
// 1) navigator.onLine is only a browser signal; a successful authenticated
// server request must override its false-negative in Android WebView.
patch("src/components/ApoisStatusCheck.tsx",s=>{
  const token="    setResults(output);setTested(true);setBusy(false);";
  return exact(s,token,[
    "    // APOIS_COURIER_TRUE_CONNECTIVITY_VIDEO_V1: rely on verified server evidence.",
    "    if (authenticated || serverReady) {",
    '      output[0] = { label: "1. Internet", status: "ok", detail: "Conexão confirmada pela sessão e pelas consultas ao servidor APOIS." };',
    "    } else if (navigator.onLine) {",
    '      output[0] = { label: "1. Internet", status: "unknown", detail: "Rede detectada pelo aparelho, mas a conexão com a APOIS não foi confirmada." };',
    "    }",
    token
  ].join("\n"),"server-backed internet diagnostic");
},"APOIS_COURIER_TRUE_CONNECTIVITY_VIDEO_V1");
// 2) get_courier_metrics.completed_deliveries is ALL-TIME count, not today.
patch("src/components/CourierPremiumViews.tsx",s=>{
  const start=s.indexOf("export function CourierWaitingSheet(");
  const end=s.indexOf("export function CourierOfflineCard(",start);
  if(start<0||end<start)throw Error("[FAIL] Courier waiting bounds changed");
  let sheet=s.slice(start,end);
  sheet=exact(sheet,'>Entregas hoje</p>', '>Concluídas (total)</p>',"all-time count label");
  if(!sheet.includes("metrics?.completed_deliveries"))throw Error("[FAIL] metric binding lost");
  sheet=sheet.replace("export function CourierWaitingSheet(",
    "// APOIS_COURIER_ALL_TIME_DELIVERIES_VIDEO_V1\nexport function CourierWaitingSheet(");
  return s.slice(0,start)+sheet+s.slice(end);
},"APOIS_COURIER_ALL_TIME_DELIVERIES_VIDEO_V1");
// 2b) The PIX/withdrawal explanation must be readable in the light theme.
// This changes contrast only; payouts remain disabled as before.
patch("src/components/CourierPremiumViews.tsx",s=>{
  const explanation="Nenhuma chave PIX ou valor de saque é solicitado nesta fase.";
  const ix=s.indexOf(explanation);
  if(ix<0 || s.indexOf(explanation,ix+1)>=0)throw Error("[FAIL] finance explanation missing or duplicate");
  const start=s.lastIndexOf("<div className=",ix);
  const end=s.indexOf(">",start)+1;
  if(start<0||end<=start||ix-end>120)throw Error("[FAIL] finance message container changed");
  const oldTag=s.slice(start,end);
  if(!oldTag.includes("rounded-2xl")||!oldTag.includes("text-"))throw Error("[FAIL] finance box is not expected");
  const newTag='<div data-apois-courier-finance-contrast-v1 className="mt-3 rounded-2xl border border-[#CBD5E1] !bg-[#F8FAFC] p-3 text-[11px] leading-5 !text-[#334155]">';
  return s.slice(0,start)+newTag+s.slice(end);
},"data-apois-courier-finance-contrast-v1");
patch("src/system-theme.css",s=>{
  return s+"\n/* APOIS_COURIER_PIX_NOTICE_CONTRAST_V1: readable notice under legacy theme overrides. */\n"+
    '.apois-system-theme [data-apois-courier-finance-contrast-v1] { background:#F8FAFC!important; color:#334155!important; border-color:#CBD5E1!important; }\n';
},"APOIS_COURIER_PIX_NOTICE_CONTRAST_V1");

// 3) a job's estimated_earnings is NOT its wallet credit.
// Show both without adding wallet balances or inventing a payment.
patch("src/components/CourierPanels.tsx",s=>{
  let out=exact(s,
    'export function CourierHistoryPanel({ jobs, onClose }: { jobs: any[]; onClose: () => void }) {',
    'export function CourierHistoryPanel({ jobs, wallet, onClose }: { jobs: any[]; wallet?: {available_balance?: number | null} | null; onClose: () => void }) {\n  // APOIS_COURIER_LEDGER_SEPARATION_VIDEO_V1',
    "history readonly wallet prop");
  const start=out.indexOf("export function CourierHistoryPanel(");
  const end=out.indexOf("export function CourierProfilePanel(",start);
  if(start<0||end<start)throw Error("[FAIL] Courier history panel boundaries changed");
  let part=out.slice(start,end);
  part=exact(part,'>Ganhos listados</p>','>Estimativas nas entregas</p>',"rename estimated value");
  part=exact(part,
    '{money(totalEarnings)}',
    '{money(totalEarnings)}',
    "existing value check" // intentionally no value mutation
  );
  // The estimate and the ledger are different accounting sources. A value
  // of zero in delivery_jobs must not be filled using an unrelated wallet entry.
  const summary='        </section>\n\n        {jobs.length === 0 ? (';
  const disclosure=[
    '          <div data-apois-courier-ledger-separation-v1 role="note" className="mt-3 rounded-2xl border border-[#E4E7EC] bg-white px-4 py-3 text-[#334155]">',
    '            <p className="text-xs font-semibold">Saldo atual na carteira: <strong className="text-[#B91C32]">{wallet ? money(wallet.available_balance) : "Indisponível"}</strong></p>',
    '            <p className="mt-1 text-[11px] leading-4 text-[#596374]">Estimativas cadastradas nas entregas e créditos da carteira são registros diferentes. Consulte a aba Ganhos para conferir cada lançamento; não some estes valores.</p>',
    '          </div>',
    summary
  ].join("\n");
  part=exact(part,summary,disclosure,"show ledger distinction before jobs");
  part=exact(part,
    '<p className="text-[9px] font-black uppercase text-zinc-600">Ganho</p>',
    '<p className="text-[9px] font-black uppercase text-zinc-600">Estimativa</p>',
    "job estimate label");
  return out.slice(0,start)+part+out.slice(end);
},"APOIS_COURIER_LEDGER_SEPARATION_VIDEO_V1");
patch("src/routes/courier.tsx",s=>{
  const anchor='<CourierHistoryPanel jobs={deliveryHistory} onClose={() => setHistoryOpen(false)} />';
  return exact(s,anchor,
    '// APOIS_COURIER_HISTORY_WALLET_READONLY_VIDEO_V1\n        <CourierHistoryPanel jobs={deliveryHistory} wallet={wallet} onClose={() => setHistoryOpen(false)} />',
    "pass wallet read-only to history");
},"APOIS_COURIER_HISTORY_WALLET_READONLY_VIDEO_V1");
console.log("[OK] Courier video: status, all-time metric label and ledger/estimate disclosure without payments or database changes.");
