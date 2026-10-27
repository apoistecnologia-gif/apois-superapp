import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

// Applied to the ephemeral courier workspace after all older layout hardeners.
// No API, authentication, GPS, delivery, or settlement logic is changed.
const root = resolve(process.env.APOIS_ENTREGAS_WORKSPACE || ".work/partner-entregador");

function replaceOnce(source, before, after, label) {
  const occurrences = source.split(before).length - 1;
  if (occurrences !== 1) {
    throw Error("[FAIL] Courier viewport V3: " + label + " (found " + occurrences + ")");
  }
  return source.replace(before, after);
}

function edit(file, operation) {
  const path = resolve(root, file);
  const original = readFileSync(path, "utf8");
  const changed = operation(original);
  if (changed === original) throw Error("[FAIL] Courier viewport V3 unchanged: " + file);
  writeFileSync(path, changed, "utf8");
}

// The idle Google map was hard-coded to 48dvh / 590px, pushing availability
// underneath the fixed bottom nav on actual Android WebView viewports.
// Only change the idle/live map. The active two-leg delivery route is untouched.
edit("src/components/CourierRouteMap.tsx", (src) =>
  replaceOnce(
    src,
    'className="relative h-[48dvh] min-h-[320px] max-h-[590px] w-full bg-[#F3F4F6]"',
    'className="relative h-[clamp(235px,36dvh,375px)] w-full bg-[#F3F4F6]"',
    "idle map height",
  ),
);

// Retain exactly one online/offline switch. Make its label legible rather than
// applying truncate to "Voce esta OFFLINE" next to a large toggle.
edit("src/components/CourierPremiumViews.tsx", (src) => {
  const start = src.indexOf("export function CourierStatusCard(");
  const end = src.indexOf("export function CourierWaitingSheet(", start);
  if (start < 0 || end <= start) throw Error("[FAIL] CourierStatusCard boundaries");
  let card = src.slice(start, end);
  card = replaceOnce(card, 'className="flex items-center justify-between gap-4"', 'className="flex items-center justify-between gap-2"', "status horizontal gap");
  card = replaceOnce(card, 'className="flex min-w-0 items-center gap-3"', 'className="flex min-w-0 flex-1 items-center gap-2"', "status inner gap");
  card = replaceOnce(card, 'grid h-11 w-11 shrink-0 place-items-center rounded-2xl border', 'grid h-9 w-9 shrink-0 place-items-center rounded-xl border', "status icon size");
  card = replaceOnce(card, 'mt-0.5 truncate text-lg font-black', 'mt-0.5 break-words text-[clamp(14px,3.5vw,17px)] leading-tight font-black', "status title no truncation");
  return src.slice(0, start) + card + src.slice(end);
});

// Old nav reserved 82px for grid + at least 44px of extra bottom padding,
// while a dark background-image overrode the light theme's background-color.
edit("src/components/CourierPanels.tsx", (src) => {
  const start = src.indexOf("export function CourierBottomNav(");
  const end = src.indexOf("function PanelHeader(", start);
  if (start < 0 || end <= start) throw Error("[FAIL] CourierBottomNav boundaries");
  let nav = src.slice(start, end);
  nav = replaceOnce(nav, '<nav className="fixed', '<nav data-apois-courier-bottom-nav className="fixed', "nav test hook");
  nav = replaceOnce(nav, 'bg-[linear-gradient(180deg,rgba(5,5,5,0.94),#000)]', 'bg-white', "nav black gradient");
  nav = replaceOnce(nav, 'border-t border-accent/15', 'border-t border-[#E5E7EB]', "nav border");
  nav = replaceOnce(nav, 'pb-[max(44px,env(safe-area-inset-bottom))]', 'pb-[max(8px,env(safe-area-inset-bottom))]', "nav bottom safe area");
  nav = replaceOnce(nav, 'pt-2.5', 'pt-1.5', "nav top padding");
  nav = replaceOnce(nav, 'shadow-[0_-16px_40px_rgba(0,0,0,0.55)]', 'shadow-[0_-6px_20px_rgba(17,24,39,0.08)]', "nav shadow");
  nav = replaceOnce(nav, 'min-h-[82px]', 'min-h-[62px]', "nav grid height");
  nav = replaceOnce(nav, 'min-h-[64px]', 'min-h-[54px]', "nav button height");
  return src.slice(0, start) + nav + src.slice(end);
});

// Reserve the height of the new compact nav without hiding the availability
// card behind it. Keep the original routes, onToggle callback and map component.
edit("src/routes/courier.tsx", (src) => {
  let updated = replaceOnce(
    src,
    'pb-[calc(6.5rem+env(safe-area-inset-bottom))]',
    'pb-[calc(5rem+env(safe-area-inset-bottom))]',
    "home bottom spacing",
  );
  updated = replaceOnce(
    updated,
    'data-apois-courier-inline-status className="mx-auto w-full max-w-lg py-3"',
    'data-apois-courier-inline-status className="mx-auto w-full max-w-lg py-2"',
    "availability spacing",
  );
  return updated;
});

// Explicitly reset background-image (not only background-color), otherwise
// the legacy gradient keeps the navigation black on Android.
const cssPath = resolve(root, "src/system-theme.css");
let css = readFileSync(cssPath, "utf8");
const marker = "/* APOIS_COURIER_VIEWPORT_V3 */";
if (css.includes(marker)) throw Error("[FAIL] Courier viewport V3 applied twice");
css += "\n" + marker + "\n" +
  ".apois-system-theme nav[data-apois-courier-bottom-nav] {" +
  "background:#FFFFFF!important;background-image:none!important;" +
  "border-color:#E5E7EB!important;box-shadow:0 -6px 20px rgba(17,24,39,.08)!important;" +
  "}\n" +
  ".apois-system-theme nav[data-apois-courier-bottom-nav] button {" +
  "color:#5B6472!important;" +
  "}\n" +
  ".apois-system-theme nav[data-apois-courier-bottom-nav] button[aria-current=\"page\"] {" +
  "color:#E51B23!important;" +
  "}\n" +
  ".apois-system-theme [data-apois-courier-inline-status] > section {" +
  "padding:10px 12px!important;" +
  "}\n";
writeFileSync(cssPath, css, "utf8");
console.log("[OK] Courier viewport V3: medium map, readable availability, compact light bottom navigation.");
