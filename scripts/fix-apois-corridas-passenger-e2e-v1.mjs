import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
const root = resolve(process.env.APOIS_CORRIDAS_WORKSPACE || ".work/corridas");
function patch(file, edit, expected) {
  const path = resolve(root, file), old = readFileSync(path, "utf8");
  if (old.includes(expected)) { console.log("[OK] already applied " + file); return; }
  const result = edit(old);
  if (result === old || !result.includes(expected)) throw Error("[FAIL] passenger E2E " + file);
  writeFileSync(path, result, "utf8");
  console.log("[OK] passenger E2E " + file);
}
patch("src/routes/_authenticated.revisar-solicitacao.tsx", (source) => {
  let s = source;
  const rootTag = s.match(/<div className="[^"]*(?:min-h-screen|h-\[100dvh\]|min-h-\[100dvh\])[^"]*">/);
  const scrollTag = s.match(/<div className="[^"]*flex-1[^"]*overflow-y-auto[^"]*">/);
  if (!rootTag || !scrollTag) throw Error("[FAIL] review root/scroll changed");
  s = s.replace(rootTag[0], rootTag[0].replace("<div ", '<div data-apois-review-e2e-v1 style={{ height: "100dvh", minHeight: 0, overflow: "hidden" }} ').replace('className="', 'className="min-h-0 '));
  s = s.replace(scrollTag[0], scrollTag[0].replace('className="', 'className="min-h-0 overscroll-contain '));
  const action = s.indexOf("onClick={() => void handleConfirm()}");
  const start = s.lastIndexOf('<div className="', action);
  const end = s.indexOf(">", start) + 1;
  if (action < 0 || start < 0 || end < start || action - end > 350 || !s.slice(start,end).includes("border-t")) throw Error("[FAIL] review footer changed");
  const footer = s.slice(start,end).replace("<div ", '<div data-apois-review-footer-e2e-v1 style={{ paddingBottom: "max(76px, env(safe-area-inset-bottom))" }} ');
  const value = '<div className="mb-3 flex items-center justify-between gap-3 rounded-xl bg-[#FFF1F2] px-3 py-2 text-[#111827]" aria-live="polite"><span className="text-xs font-bold">Estimativa da corrida</span><strong className="text-lg font-black tabular-nums">{formatCurrency(checkout.finalTotal)}</strong></div>';
  return s.slice(0,start)+footer+value+s.slice(end);
}, "data-apois-review-e2e-v1");

patch("src/components/rides/active/DriverCard.tsx", (source) => {
  const anchor = '  if (!ride.driver_id && !ride.driver_name) return null;';
  if (!source.includes(anchor) || !source.includes('{ride.driver_photo ? (')) throw Error("[FAIL] DriverCard anchors changed");
  let s = source.replace(anchor, '  // APOIS_DRIVER_AVATAR_E2E_V1\n  const [photoFailed, setPhotoFailed] = React.useState(false);\n  React.useEffect(() => setPhotoFailed(false), [ride.driver_photo]);\n'+anchor);
  s = s.replace('{ride.driver_photo ? (','{ride.driver_photo && !photoFailed ? (');
  if (!s.includes('onError={() => setPhotoFailed(true)}')) s = s.replace('src={ride.driver_photo}', 'src={ride.driver_photo}\n            onError={() => setPhotoFailed(true)}');
  if (!s.includes('ride.driver_rating?.toFixed(1) || "5.0"')) throw Error("[FAIL] fake rating anchor changed");
  return s.replace('ride.driver_rating?.toFixed(1) || "5.0"', '(typeof ride.driver_rating === "number" && Number.isFinite(ride.driver_rating) && ride.driver_rating > 0 ? ride.driver_rating.toFixed(1) : "Novo")');
}, "APOIS_DRIVER_AVATAR_E2E_V1");

patch("src/routes/_authenticated.corrida.$rideId.tsx", (source) => {
  const importAnchor = 'import { useActiveRide } from "@/hooks/rides/use-active-ride";';
  const hookAnchor = '  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);';
  const timerAnchor = 'if (screenState !== "completed" || !ride?.id || ride.id !== rideId) return;';
  const depAnchor = '}, [screenState, ride?.id, rideId]);';
  const uiAnchor = '<p className="mt-3 text-xs font-semibold text-[#5B6470]">Voltando automaticamente ao início...</p>';
  for (const a of [importAnchor,hookAnchor,timerAnchor,depAnchor,uiAnchor]) if (!source.includes(a)) throw Error("[FAIL] completed rating anchor changed: "+a);
  let s = source.replace(importAnchor, importAnchor+'\nimport { supabase } from "@/integrations/supabase/client";');
  const hooks = [
    '  // APOIS_PASSENGER_RATING_E2E_V1: somente RPC autenticada, sem nota ficticia.',
    '  const [finishStars, setFinishStars] = useState(5);',
    '  const [finishSending, setFinishSending] = useState(false);',
    '  const [finishRated, setFinishRated] = useState(false);',
    '  const [finishSkipped, setFinishSkipped] = useState(false);',
    '  const [finishError, setFinishError] = useState<string | null>(null);',
    '  const ratingLock = React.useRef(false);',
    '  const submitDriverRating = async () => {',
    '    if (!ride || screenState !== "completed" || ratingLock.current || finishRated || ride.passenger_rating != null) return;',
    '    ratingLock.current = true; setFinishSending(true); setFinishError(null);',
    '    try {',
    '      const rpc = supabase as unknown as { rpc: (name: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }> };',
    '      const { data, error } = await rpc.rpc("rate_passenger_ride", { _ride_id: ride.id, _rating: finishStars, _comment: null });',
    '      if (error) throw new Error(error.message);',
    '      if (data && typeof data === "object" && "ok" in data && (data as {ok?: boolean}).ok === false) throw new Error("rating refused");',
    '      setFinishRated(true);',
    '    } catch { setFinishError("Nao foi possivel enviar a avaliacao. Tente novamente ou pule."); }',
    '    finally { ratingLock.current = false; setFinishSending(false); }',
    '  };'
  ].join("\n");
  s=s.replace(hookAnchor,hookAnchor+"\n"+hooks);
  s=s.replace(timerAnchor,'if (screenState !== "completed" || !ride?.id || ride.id !== rideId || (!finishRated && !finishSkipped && ride.passenger_rating == null)) return;');
  s=s.replace(depAnchor,'}, [screenState, ride?.id, ride?.passenger_rating, rideId, finishRated, finishSkipped]);');
  const ui = [
    '<p className="mt-2 max-w-[320px] text-xs text-[#5B6470]">Se a viagem foi encerrada antes do destino, voce pode registrar uma ocorrencia no suporte.</p>',
    '{ride.passenger_rating == null && !finishRated && !finishSkipped ? (',
    '<section aria-label="Avaliar motorista" className="mt-3 w-full rounded-2xl border border-[#E2E4E8] bg-white p-4">',
    '<p className="text-sm font-bold text-[#111827]">Como foi o motorista?</p>',
    '<div className="mt-2 flex items-center justify-center gap-1">{[1,2,3,4,5].map((n) => (',
    '<button key={n} type="button" aria-label={"Avaliar com " + n + " estrelas"} aria-pressed={finishStars === n} disabled={finishSending} onClick={() => setFinishStars(n)} className="min-h-11 min-w-11 text-2xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#E51B23]"><span className={n <= finishStars ? "text-[#E51B23]" : "text-[#9CA3AF]"}>★</span></button>',
    '))}</div>',
    '{finishError ? <p role="alert" className="mt-2 text-xs text-[#B91C1C]">{finishError}</p> : null}',
    '<div className="mt-3 flex gap-2">',
    '<button type="button" disabled={finishSending} onClick={() => void submitDriverRating()} className="min-h-12 flex-1 rounded-xl bg-[#E51B23] px-3 font-bold text-white disabled:opacity-60">{finishSending ? "Enviando..." : "Enviar avaliacao"}</button>',
    '<button type="button" disabled={finishSending} onClick={() => setFinishSkipped(true)} className="min-h-12 rounded-xl border border-[#D1D5DB] px-3 font-semibold text-[#374151]">Pular</button>',
    '</div></section>) : <p className="mt-3 text-xs font-semibold text-[#5B6470]">Obrigado! Retornando ao inicio...</p>}'
  ].join("\n");
  return s.replace(uiAnchor,ui);
}, "APOIS_PASSENGER_RATING_E2E_V1");

patch("src/routes/_authenticated.corrida.$rideId.tsx", (source) => {
  if (source.includes("data-apois-passenger-layout-e2e-v1")) return source;
  let s = source;
  // O botao de cancelamento/ocorrencia e fixo; o painel precisa de rolagem segura.
  const sheet = s.match(/<motion\.div[\s\S]{0,220}?className="[^"]*max-h-\[60vh\][^"]*"/);
  if (!sheet) throw Error("[FAIL] corrida: active sheet changed");
  s=s.replace(sheet[0],sheet[0].replace("<motion.div",
    '<motion.div data-apois-passenger-layout-e2e-v1 style={{ paddingBottom: "max(164px, env(safe-area-inset-bottom))" }}'));
  const completePadding='pb-[max(3.5rem,env(safe-area-inset-bottom))]';
  if(!s.includes(completePadding))throw Error("[FAIL] completion safe area changed");
  s=s.replace(completePadding,'pb-[max(84px,env(safe-area-inset-bottom))]');
  const summary='<p className="max-w-[300px] text-sm font-medium leading-6 text-[#4B5563]">Sua corrida foi finalizada. Obrigado por viajar com a APOIS.</p>';
  if(!s.includes(summary))throw Error("[FAIL] completed summary changed");
  const direct='<p data-apois-direct-payment-e2e-v1 className="max-w-[310px] text-xs leading-5 text-[#4B5563]">' +
    '{["cash","credit","credit_card","debit","debit_card"].includes(String(ride.payment_method)) ? "Pagamento feito diretamente ao motorista, em dinheiro ou na maquininha. A APOIS nao recebe esse valor." : "Confira a forma de pagamento no historico da corrida."}' +
    '</p>';
  return s.replace(summary,summary+'\n'+direct);
}, "data-apois-passenger-layout-e2e-v1");

console.log("[OK] Passageiro: valor sempre visivel, safe area, foto/nota reais e avaliacao pos-corrida.");
