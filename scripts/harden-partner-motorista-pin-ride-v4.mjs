import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(process.env.APOIS_MOTORISTA_WORKSPACE || ".work/partner-motorista");
const file = resolve(root, "src/routes/motorista.app.tsx");
let source = readFileSync(file, "utf8");
function required(value, label) {
  if (!value) throw Error("[FAIL] PIN/ride V4: " + label);
}
function once(input, before, after, label) {
  required(input.split(before).length === 2, label + " deve ter um único alvo");
  return input.replace(before, after);
}

// React portal escapes the transformed MovviSheet stacking context and the
// fixed bottom navigation. Retains the existing authenticated onStart callback.
source = once(source,
  'import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";',
  'import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";\nimport { createPortal } from "react-dom";',
  "portal import");
const start = source.indexOf("function ActiveRidePanel(");
const end = source.indexOf("\nfunction ActionButton(", start);
required(start >= 0 && end > start, "limites ActiveRidePanel");
let panel = source.slice(start, end);
const pinStart = panel.indexOf("      {/* Modal de validação do PIN");
const pinEnd = panel.lastIndexOf("\n    </div>\n  );\n}");
required(pinStart >= 0 && pinEnd > pinStart, "modal PIN real localizado");
panel = panel.slice(0, pinStart) + "      {/* PIN isolado da MovviSheet para não perder o botão atrás do rodapé. */}\n      {pinOpen && createPortal(\n        <div\n          data-apois-pin-v4\n          role=\"dialog\"\n          aria-modal=\"true\"\n          aria-label=\"Confirmar PIN de segurança\"\n          className=\"fixed inset-0 z-[1000] flex items-end justify-center bg-[#101828]/60 sm:items-center\"\n          onClick={() => { if (!pinBusy) { setPinOpen(false); setPinCode(\"\"); setPinError(null); } }}\n        >\n          <div\n            className=\"flex w-full max-w-md min-h-0 flex-col overflow-hidden rounded-t-[28px] border border-[#E5E7EB] bg-white text-[#111827] shadow-[0_-20px_60px_-20px_rgba(17,24,39,.3)] sm:rounded-[28px]\"\n            style={{ maxHeight: \"calc(100dvh - max(env(safe-area-inset-top), 8px) - 8px)\" }}\n            onClick={(event) => event.stopPropagation()}\n          >\n            <div className=\"shrink-0 px-5 pt-4 pb-2\">\n              <div className=\"mx-auto mb-4 h-1 w-10 rounded-full bg-[#D0D5DD] sm:hidden\" />\n              <div className=\"flex items-center justify-between gap-3\">\n                <span className=\"text-[12px] font-extrabold uppercase tracking-[0.14em] text-[#C9141B]\">Código de segurança</span>\n                <button\n                  type=\"button\"\n                  aria-label=\"Fechar código de segurança\"\n                  disabled={pinBusy}\n                  onClick={() => { setPinOpen(false); setPinCode(\"\"); setPinError(null); }}\n                  className=\"grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#F2F4F7] text-[#475467] disabled:opacity-50\"\n                ><X className=\"h-5 w-5\" /></button>\n              </div>\n            </div>\n            <div className=\"min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-3\">\n              <h3 className=\"mt-2 text-center text-[21px] font-extrabold leading-7 text-[#111827]\">Peça o PIN ao passageiro</h3>\n              <p className=\"mx-auto mt-2 max-w-[285px] text-center text-[13px] leading-5 text-[#667085]\">\n                Digite os quatro números informados pelo passageiro para iniciar a viagem.\n              </p>\n              <div className=\"relative mx-auto mt-5 w-full max-w-[312px]\">\n                <label htmlFor=\"apois-motorista-pin-v4\" className=\"block cursor-text\">\n                  <span aria-hidden=\"true\" className=\"grid grid-cols-4 gap-2.5\">\n                    {[0, 1, 2, 3].map((position) => (\n                      <span key={position} className={\n                        pinError\n                          ? \"flex h-[62px] min-w-0 items-center justify-center rounded-[15px] border-2 border-[#DC2626] bg-[#FFF1F2] text-[30px] font-extrabold tabular-nums text-[#111827]\"\n                          : \"flex h-[62px] min-w-0 items-center justify-center rounded-[15px] border-2 border-[#D0D5DD] bg-[#F9FAFB] text-[30px] font-extrabold tabular-nums text-[#111827]\"\n                      }>{pinCode[position] ?? \"\"}</span>\n                    ))}\n                  </span>\n                  <input\n                    id=\"apois-motorista-pin-v4\"\n                    type=\"text\"\n                    inputMode=\"numeric\"\n                    pattern=\"[0-9]*\"\n                    autoComplete=\"one-time-code\"\n                    autoFocus\n                    maxLength={4}\n                    disabled={pinBusy}\n                    aria-label=\"Digite os quatro dígitos do PIN de segurança\"\n                    aria-invalid={Boolean(pinError)}\n                    value={pinCode}\n                    onChange={(event) => {\n                      setPinCode(event.target.value.replace(/\\D/g, \"\").slice(0, 4));\n                      setPinError(null);\n                    }}\n                    onKeyDown={(event) => { if (event.key === \"Enter\" && pinCode.length === 4) void submitPin(); }}\n                    className=\"absolute inset-0 z-10 h-full w-full cursor-text opacity-0\"\n                  />\n                </label>\n              </div>\n              {pinError && (\n                <p role=\"alert\" className=\"mx-auto mt-3 max-w-[312px] rounded-xl border border-[#FECACA] bg-[#FFF1F2] px-3 py-2.5 text-[13px] font-semibold text-[#B91C1C]\">\n                  {pinError}\n                </p>\n              )}\n              <p className=\"mt-4 text-center text-[12px] leading-5 text-[#667085]\">\n                Confirme o código somente na presença do passageiro.\n              </p>\n            </div>\n            <div className=\"z-20 shrink-0 border-t border-[#E5E7EB] bg-white px-5 pt-3\" style={{ paddingBottom: \"max(16px, env(safe-area-inset-bottom))\" }}>\n              <button\n                type=\"button\"\n                disabled={pinBusy || pinCode.length !== 4}\n                aria-busy={pinBusy}\n                onClick={() => void submitPin()}\n                className=\"flex min-h-[56px] w-full items-center justify-center rounded-2xl bg-[#E51B23] px-3 text-center text-[15px] font-extrabold text-white shadow-[0_10px_24px_-14px_rgba(229,27,35,.7)] disabled:cursor-not-allowed disabled:bg-[#F5A4A8] disabled:shadow-none\"\n              >\n                {pinBusy ? \"Confirmando código...\" : \"Confirmar PIN e iniciar corrida\"}\n              </button>\n              <button\n                type=\"button\"\n                disabled={pinBusy}\n                onClick={() => { setPinOpen(false); setPinCode(\"\"); setPinError(null); }}\n                className=\"mt-1 flex min-h-11 w-full items-center justify-center text-[13px] font-bold text-[#667085] disabled:opacity-50\"\n              >Cancelar</button>\n            </div>\n          </div>\n        </div>,\n        document.body,\n      )}\n" + panel.slice(pinEnd);
panel = once(panel,
  '<div className="flex flex-col gap-2.5 pt-1">',
  '<div data-apois-ride-phase-v4 className="flex flex-col gap-2.5 rounded-[22px] bg-white px-1 pt-1 text-[#111827]">',
  "fase aguardando");
panel = once(panel,
  'className="flex items-center gap-2 rounded-2xl bg-background/55 p-1.5 ring-1 ring-border/60"',
  'className="flex items-center gap-2 rounded-2xl border border-[#E5E7EB] bg-white p-1.5 text-[#111827] shadow-sm"',
  "cartão passageiro");
panel = once(panel,
  'className="space-y-2 rounded-2xl bg-background/60 p-2.5 ring-1 ring-border"',
  'className="space-y-2 rounded-2xl border border-[#E5E7EB] bg-white p-3 text-[#111827] shadow-sm"',
  "endereços");
panel = once(panel,
  'className="group rounded-2xl bg-background/50 ring-1 ring-border/60',
  'className="group rounded-2xl border border-[#E5E7EB] bg-white text-[#111827] shadow-sm',
  "card segurança");
panel = once(panel,
  'className="sticky bottom-0 -mx-1 mt-1 animate-in fade-in slide-in-from-bottom-2 duration-300 bg-gradient-to-t from-card via-card/95 to-transparent px-1 pt-2"',
  'className="sticky bottom-0 z-10 -mx-1 mt-1 animate-in fade-in slide-in-from-bottom-2 duration-300 bg-white px-1 pt-3"',
  "ação iniciar");
required(panel.includes('createPortal(') && panel.includes('Confirmar PIN e iniciar corrida') && panel.includes("onStart(pinCode)"), "PIN preserva autenticação e confirmação");

source = source.slice(0, start) + panel + source.slice(end);

// The navigation header and bottom passenger panel use the same light theme.
// Restrict changes to PickupNavOverlay, without changing Google Maps or ETA.
const pickupStart = source.indexOf("function PickupNavOverlay(");
const pickupEnd = source.indexOf("\nfunction CircleAction(", pickupStart);
required(pickupStart >= 0 && pickupEnd > pickupStart, "limites PickupNavOverlay");
let pickup = source.slice(pickupStart, pickupEnd);
pickup = once(pickup,
  'className="fixed left-1/2 z-40 w-full max-w-md -translate-x-1/2 px-4 pointer-events-none"',
  'data-apois-pickup-top-v4 className="fixed left-1/2 z-40 w-full max-w-md -translate-x-1/2 px-4 pointer-events-none"',
  "marca cabeçalho");
pickup = pickup.replace(/className="pointer-events-auto rounded-\[22px\][^"]*"/,
  'className="pointer-events-auto rounded-[22px] border border-[#E5E7EB] bg-white px-4 py-3 text-[#111827] shadow-[0_10px_28px_-16px_rgba(17,24,39,.35)]"');
required(pickup.includes('bg-white px-4 py-3 text-[#111827]'), "cabeçalho branco");
pickup = pickup.replace(/className="fixed inset-x-0 bottom-0 z-40 border-t[^"]*"/,
  'data-apois-pickup-bottom-v4 className="fixed inset-x-0 bottom-0 z-40 border-t border-[#E5E7EB] bg-white text-[#111827] shadow-[0_-12px_28px_-22px_rgba(17,24,39,.3)]"');
required(pickup.includes("data-apois-pickup-bottom-v4"), "painel de embarque claro");
pickup = pickup.replace(/className="flex min-w-0 items-center gap-2.5 rounded-2xl bg-white\/\[0\.05\][^"]*"/,
  'className="flex min-w-0 items-center gap-2.5 rounded-2xl border border-[#E5E7EB] bg-[#F9FAFB] px-2.5 py-2 text-left"');
pickup = pickup.replace('className="truncate text-[13px] font-bold leading-tight text-white"',
  'className="truncate text-[13px] font-bold leading-tight text-[#111827]"');
pickup = pickup.replace('className="mt-0.5 flex items-center gap-1 truncate text-[11.5px] text-white/60"',
  'className="mt-0.5 flex items-center gap-1 truncate text-[11.5px] text-[#667085]"');
pickup = pickup.replace(/className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white\/\[0\.06\][^"]*"/,
  'className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-[#D0D5DD] bg-white text-[#C9141B]"');
source = source.slice(0, pickupStart) + pickup + source.slice(pickupEnd);

// Scoped contrasts override older utility classes from the dark map overlay.
const cssFile = resolve(root, "src/styles.css");
const css = readFileSync(cssFile, "utf8");
required(!css.includes("APOIS_DRIVER_PIN_RIDE_V4"), "evitar duplicação da folha de estilos");
writeFileSync(cssFile, css + "\n/* APOIS_DRIVER_PIN_RIDE_V4: clear cards over a map, no dark-theme bleed. */\n[data-apois-ride-phase-v4] [class~=\"text-muted-foreground\"] { color:#667085 !important; }\n[data-apois-ride-phase-v4] [class~=\"text-foreground\"] { color:#111827 !important; }\n[data-apois-ride-phase-v4] details summary { color:#111827 !important; }\n[data-apois-ride-phase-v4] [class*=\"bg-background/\"] { background-color:#fff !important; }\n[data-apois-ride-phase-v4] [class*=\"ring-border\"] { border-color:#E5E7EB !important; }\n[data-apois-pickup-top-v4] [class~=\"text-white/90\"],\n[data-apois-pickup-top-v4] [class~=\"text-foreground/85\"] { color:#111827 !important; }\n[data-apois-pickup-top-v4] [class~=\"text-zinc-400\"],\n[data-apois-pickup-top-v4] [class~=\"text-muted-foreground\"] { color:#667085 !important; }\n[data-apois-pickup-top-v4] button[aria-label=\"Cancelar corrida\"] {\n  color:#475467 !important; background:#F2F4F7 !important;\n}\n[data-apois-pickup-bottom-v4] [class~=\"text-white/60\"],\n[data-apois-pickup-bottom-v4] [class~=\"text-muted-foreground\"] { color:#667085 !important; }\n[data-apois-pin-v4] { color-scheme:light; }\n[data-apois-pin-v4] input { font-size:16px !important; }\n","utf8");
writeFileSync(file, source, "utf8");
console.log("[OK] Motorista PIN V4: portal acima da navegação, 4 dígitos legíveis, confirmação persistente e cards claros.");
