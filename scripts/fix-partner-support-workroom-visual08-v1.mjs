// APOIS RV-08 / CV-025–026 — status language and truthful list presentation only.
// Patch only the disposable partner Motorista workspace, never the pinned sources.
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const VISUAL08_MARK = "APOIS_CV08_CASE_WORKROOM_V1";
export const WORKROOM_PATH = "src/components/ApoisCaseWorkroom.tsx";

function replaceExactlyOnce(source, oldText, newText, label) {
  const count = source.split(oldText).length - 1;
  if (count !== 1) throw new Error("[CV08] " + label + ": expected one anchor, found " + count);
  return source.replace(oldText, newText);
}

export function patchWorkroomVisual08(source) {
  if (source.includes(VISUAL08_MARK)) {
    for (const required of [
      "caseStatusLabel(t.status)",
      "ticketListFailed",
      "ticketListLoaded",
      "Os protocolos exibidos podem estar desatualizados.",
      'disabled={role==="staff"&&privateNote}',
      "apois_request_driver_statement",
    ]) {
      if (!source.includes(required)) throw new Error("[CV08] partially patched workroom: " + required);
    }
    return source;
  }
  for (const required of [
    "APOIS_STAFF_REQUEST_DRIVER_STATEMENT_V1",
    "APOIS_CASE_CONTEXT_SAFE_V2",
    "APOIS_CASE_UPLOAD_IDEMPOTENCY_V2",
    "apois_request_driver_statement",
    'disabled={role==="staff"&&privateNote}',
  ]) {
    if (!source.includes(required)) throw new Error("[CV08] missing reviewed workroom baseline: " + required);
  }
  let out = source;
  out = replaceExactlyOnce(out,
    'type CaseFile={id:string;file_name:string;object_path:string;uploaded_at:string;url?:string|null};',
    [
      'type CaseFile={id:string;file_name:string;object_path:string;uploaded_at:string;url?:string|null};',
      '// ' + VISUAL08_MARK + ': public labels never change persisted status or reply eligibility.',
      'const CASE_STATUS_LABELS:Record<string,string>={open:"Aberto",in_progress:"Em atendimento",resolved:"Resolvido",closed:"Fechado"};',
      'function caseStatusLabel(value:string):string{return CASE_STATUS_LABELS[value]??"Situação indisponível";}',
    ].join("\n"),
    "public status labels");
  out = replaceExactlyOnce(out,
    ' const [loading,setLoading]=useState(false);',
    [
      ' const [loading,setLoading]=useState(false);',
      ' // List query state is separate from message/evidence errors.',
      ' const [ticketListLoaded,setTicketListLoaded]=useState(false);',
      ' const [ticketListFailed,setTicketListFailed]=useState(false);',
    ].join("\n"),
    "list query presentation state");
  out = replaceExactlyOnce(out,
    '  if(result.error){setError("Não foi possível consultar os protocolos.");return;}\n  setTickets(result.data??[]);',
    [
      '  if(result.error){setTicketListFailed(true);setError("Não foi possível consultar os protocolos.");return;}',
      '  setTicketListFailed(false);setTicketListLoaded(true);',
      '  // Clear only a previously shown list error, never a detail/submission/upload error.',
      '  setError(previous=>previous==="Não foi possível consultar os protocolos."?null:previous);',
      '  setTickets(result.data??[]);',
    ].join("\n"),
    "failed/empty/successful list query");
  out = replaceExactlyOnce(out,
    'onClick={()=>void refresh()} className="text-xs font-bold text-red-300">Atualizar</button>',
    'onClick={()=>void refresh()} className="min-h-11 rounded-lg px-3 text-xs font-bold text-red-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-400">{ticketListFailed?"Tentar novamente":"Atualizar"}</button>',
    "existing refresh button with accessible retry text");
  out = replaceExactlyOnce(out,
    '{error&&<p className="rounded-xl border border-red-500/30 p-3 text-xs text-red-300" role="alert">{error}</p>}',
    [
      '{error&&<p className="rounded-xl border border-red-500/30 p-3 text-xs text-red-300" role="alert">{error}',
      '  {ticketListFailed&&tickets.length>0&&error==="Não foi possível consultar os protocolos."&&<span className="mt-1 block text-xs leading-5">Os protocolos exibidos podem estar desatualizados. Use Tentar novamente para atualizar.</span>}',
      ' </p>}',
    ].join("\n"),
    "stale data note within existing alert");
  out = replaceExactlyOnce(out,
    '{tickets.length===0&&!loading&&<p className="text-sm text-zinc-500">Nenhuma ocorrência disponível.</p>}',
    '{tickets.length===0&&!loading&&ticketListLoaded&&!ticketListFailed&&<p className="text-sm text-zinc-500">Nenhuma ocorrência disponível.</p>}',
    "empty only after confirmed successful query");
  out = replaceExactlyOnce(out,
    '{t.status} · {new Date(t.created_at).toLocaleString("pt-BR")}',
    '{caseStatusLabel(t.status)} · {new Date(t.created_at).toLocaleString("pt-BR")}',
    "ticket status label without rewriting raw data");
  return out;
}

export function applyVisual08(workspace = resolve(process.cwd(), ".work/partner-motorista")) {
  const target = resolve(workspace, WORKROOM_PATH);
  const old = readFileSync(target, "utf8");
  const next = patchWorkroomVisual08(old);
  if (next !== old) writeFileSync(target, next, "utf8");
  return { changed: next !== old, target };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const root = resolve(process.cwd(), process.env.APOIS_MOTORISTA_WORKSPACE || ".work/partner-motorista");
  const result = applyVisual08(root);
  console.log("[OK] RV-08: Motorista/Equipe support list " + (result.changed ? "patched" : "already patched"));
}
