import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

// CV-009..012: visual-only overlay on ephemeral courier build output.
// Do not modify any RPC, offer status, alert, payment, PIN or route handler.
const root = resolve(process.env.APOIS_ENTREGAS_WORKSPACE || ".work/partner-entregador");
function once(src, before, after, name) {
  const count = src.split(before).length - 1;
  if (count !== 1) throw Error("[FAIL] CV02 " + name + " occurrences=" + count);
  return src.replace(before, after);
}
function edit(rel, apply, checks) {
  const path = resolve(root, rel);
  const src = readFileSync(path, "utf8");
  const updated = apply(src);
  for (const token of checks) if (!updated.includes(token)) throw Error("[FAIL] CV02 absent " + token);
  if (updated !== src) writeFileSync(path, updated, "utf8");
  console.log("[OK] CV02 courier UI: " + rel);
}

edit("src/components/CourierPremiumViews.tsx", (src) => {
  const begin = src.indexOf("export function ActiveDelivery(");
  const end = src.indexOf("export function CourierFinance(", begin);
  if (begin < 0 || end <= begin) throw Error("[FAIL] CV02 ActiveDelivery section changed");
  let active = src.slice(begin, end);
  if (!active.includes("APOIS_CV02_COURIER_ACTIVE_V1")) {
    active = once(active, "          PEDIDO RETIRADO", "          Confirmar retirada", "pickup action");
    active = once(active,
      '<div className="mt-2 flex items-center justify-between">',
      '<div data-apois-cv02-courier-actions className="mt-2 flex flex-wrap items-center justify-between gap-2">',
      "action row");
    active = once(active,
      'className="text-xs font-bold text-[#4B5563] underline underline-offset-2"',
      'className="inline-flex min-h-11 items-center rounded-lg px-2 py-2 text-xs font-bold text-[#4B5563] underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D7192D]"',
      "address touch");
    active = once(active,
      'className="text-xs font-bold text-[#B91C32] underline underline-offset-2"',
      'className="inline-flex min-h-11 items-center rounded-lg px-2 py-2 text-xs font-bold text-[#B91C32] underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D7192D]"',
      "help touch");
    active = once(active, "  // APOIS_COURIER_SIMPLE_FLOW_V1",
      "  // APOIS_COURIER_SIMPLE_FLOW_V1\n  // APOIS_CV02_COURIER_ACTIVE_V1: text and touch targets only.",
      "marker");
  }
  for (const token of ['onTransition("picked_up")', 'onClick={() => void onReport()}',
    "onClick={() => setShowDetails((value) => !value)}", "Código de entrega (PIN)",
    "Confirmar retirada"]) {
    if (!active.includes(token)) throw Error("[FAIL] CV02 ActiveDelivery lost " + token);
  }
  return src.slice(0, begin) + active + src.slice(end);
}, ["APOIS_CV02_COURIER_ACTIVE_V1", "data-apois-cv02-courier-actions"]);

edit("src/components/CourierOfferOverlay.tsx", (src) => {
  if (!src.includes("data-apois-cv02-offer-dialog")) {
    src = once(src, "  const alertTimerRef = useRef<number | null>(null);",
      "  const alertTimerRef = useRef<number | null>(null);\n" +
      "  // APOIS_CV02_COURIER_OFFER_V1: focus and height only; never dismiss or decline.\n" +
      "  const offerDialogRef = useRef<HTMLElement | null>(null);",
      "dialog ref");
    const effect = [
      "  useEffect(() => {",
      "    if (!offerId) return;",
      "    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;",
      "    offerDialogRef.current?.focus();",
      "    return () => { if (previous?.isConnected) previous.focus(); };",
      "  }, [offerId]);",
      "",
      "  const keepOfferFocus = (event: React.KeyboardEvent<HTMLElement>) => {",
      "    if (event.key !== \"Tab\") return;",
      "    const dialog = offerDialogRef.current;",
      "    if (!dialog) return;",
      "    const controls = Array.from(dialog.querySelectorAll<HTMLButtonElement>(\"button:not(:disabled)\"));",
      "    if (controls.length === 0) { event.preventDefault(); dialog.focus(); return; }",
      "    const first = controls[0], last = controls[controls.length - 1];",
      "    if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {",
      "      event.preventDefault(); last.focus();",
      "    } else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) {",
      "      event.preventDefault(); first.focus();",
      "    }",
      "  };",
      "",
      "  if (!enabled || !courierId || !offer) return null;",
    ].join("\n");
    src = once(src, "  if (!enabled || !courierId || !offer) return null;", effect, "focus lifecycle");
    src = once(src,
      '<section className="w-full max-w-[420px] overflow-hidden',
      '<section ref={offerDialogRef} role="dialog" aria-modal="true" aria-labelledby="apois-courier-offer-title" tabIndex={-1} onKeyDown={keepOfferFocus} data-apois-cv02-offer-dialog className="flex max-h-full min-h-0 w-full max-w-[420px] flex-col overflow-hidden',
      "modal and card max height");
    src = once(src,
      'className="border-b border-[#E5E7EB] bg-[#FFF1F2] px-5 pb-4 pt-5"',
      'className="shrink-0 border-b border-[#E5E7EB] bg-[#FFF1F2] px-5 pb-4 pt-5"',
      "non-scrolling header");
    src = once(src,
      '<p className="text-[10px] font-black uppercase tracking-[0.18em] text-accent">',
      '<p id="apois-courier-offer-title" className="text-[10px] font-black uppercase tracking-[0.18em] text-accent">',
      "accessible title");
    src = once(src,
      'className="max-h-[72dvh] space-y-4 overflow-y-auto p-5"',
      'className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-5"',
      "bounded body scroll");
    src = once(src,
      'className="grid grid-cols-[0.82fr_1.18fr] gap-3 pt-1"',
      'className="sticky bottom-0 z-10 grid grid-cols-[0.82fr_1.18fr] gap-3 border-t border-[#E5E7EB] bg-white pb-1 pt-3"',
      "sticky actions");
  }
  for (const token of [
    "APOIS_CV02_COURIER_OFFER_V1", "data-apois-cv02-offer-dialog",
    'role="dialog"', 'aria-modal="true"', 'aria-labelledby="apois-courier-offer-title"',
    'onClick={() => void respond("accept")}', 'onClick={() => void respond("reject")}',
    'min-h-0 flex-1', "remaining", "stopAlert();",
    "O endereço exato do cliente é liberado somente após o aceite.",
  ]) if (!src.includes(token)) throw Error("[FAIL] CV02 Offer lost " + token);
  return src;
}, ["APOIS_CV02_COURIER_OFFER_V1", "data-apois-cv02-offer-dialog"]);
