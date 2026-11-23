/**
 * APOIS_COURIER_PREMIUM_HOME_V1
 * Final cosmetic transform in the disposable Courier workspace only.
 * Keep availability handler, active delivery, offer, GPS, finance and backend unchanged.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(process.env.APOIS_ENTREGAS_WORKSPACE || '.work/partner-entregador');
const pagePath = resolve(root, 'src/routes/courier.tsx');
const cssPath = resolve(root, 'src/system-theme.css');
const marker = 'APOIS_COURIER_PREMIUM_HOME_V1';
let page = readFileSync(pagePath, 'utf8');
let css = readFileSync(cssPath, 'utf8');
if (page.includes(marker) || css.includes(marker)) throw Error('[FAIL] Courier premium home applied twice');

function assertOnce(source, find, label) {
  if (source.split(find).length !== 2) throw Error(`[FAIL] Courier premium home expected exactly one ${label}`);
}
// All prerequisites should be present after the existing, tested courier transforms.
for (const token of [
  'data-apois-courier-map-home', 'data-apois-courier-inline-status',
  'CourierStatusCard online={online}', 'CourierBottomNav', 'CourierRouteMap',
  'CourierOfferCard', 'activeJob', 'toggleOnline', 'completed_deliveries_today',
  'CourierLiveMap', 'CourierCompletionSheet', 'CourierSupportSheet',
]) {
  if (!page.includes(token)) throw Error('[FAIL] Courier premium home missing existing contract: ' + token);
}

const importToken = '  CourierWaitingSheet,\n';
assertOnce(page, importToken, 'premium finance formatting import');
page = page.replace(importToken,
  importToken + '  courierMoney,\n  formatCourierOnlineTime,\n');
// The generated Courier icon import may be expanded by earlier QA patches.
// Distinct aliases avoid collisions without depending on that import's text.
page = 'import { PackageCheck as ApoisPremiumPackage, WalletCards as ApoisPremiumWallet, Clock3 as ApoisPremiumClock } from "lucide-react";\n' + page;

const mainStart = page.indexOf('<main data-apois-courier-map-home');
if (mainStart < 0 || page.indexOf('<main data-apois-courier-map-home', mainStart + 1) >= 0)
  throw Error('[FAIL] Courier premium home main boundary missing or duplicated');
const mainOpeningEnd = page.indexOf('>', mainStart);
// Later journey hardeners can insert content between </main> and the support sheet.
// Anchor the actual home main tag rather than adjacent formatting/whitespace.
const mainClose = page.indexOf('</main>', mainOpeningEnd);
if (mainClose < 0 || page.indexOf('<CourierSupportSheet', mainClose) < mainClose)
  throw Error('[FAIL] Courier premium home main or support boundary changed');
if (mainOpeningEnd < mainStart || mainClose <= mainOpeningEnd)
  throw Error('[FAIL] Courier premium home main order invalid');

// Move the EXISTING availability card above the live map without cloning it.
// It retains the original toggleOnline callback and active-delivery lock.
const cardStartText = '        <div data-apois-courier-inline-status';
assertOnce(page, cardStartText, 'existing availability wrapper');
const cardStart = page.indexOf(cardStartText);
const cardEnd = page.indexOf('        </div>', cardStart);
if (cardStart <= mainOpeningEnd || cardEnd < cardStart || cardEnd > mainClose)
  throw Error('[FAIL] Courier availability card structure changed');
const card = page.slice(cardStart, cardEnd + '        </div>'.length);
if (!card.includes('onToggle={toggleOnline}') || !card.includes('activeJob={activeJob}'))
  throw Error('[FAIL] Courier availability callbacks/lock missing');
// Original generated home wraps the availability card in a conditional.
// Move the ENTIRE JSX expression; removing only the card leaves an empty
// ternary expression that breaks TypeScript (TS1005) and the protected app.
const closingDiv = '        </div>';
const originalEnd = cardEnd + closingDiv.length;
const conditionalOpen = '        {!activeJob && !completedJob ? (';
const conditionalClose = '        ) : null}';
const conditionalStart = page.lastIndexOf(conditionalOpen, cardStart);
const conditionalEnd = page.indexOf(conditionalClose, originalEnd);
let movable;
let removeStart = cardStart, removeEnd = originalEnd;
if (conditionalStart >= mainOpeningEnd && conditionalEnd > originalEnd &&
    page.slice(conditionalStart + conditionalOpen.length, cardStart).trim() === '' &&
    page.slice(originalEnd, conditionalEnd).trim() === '') {
  removeStart = conditionalStart;
  removeEnd = conditionalEnd + conditionalClose.length;
  movable = page.slice(removeStart, removeEnd);
} else {
  // Older synthetic fixtures had an unguarded card. Preserve compatibility
  // only when no adjacent conditional wrapper is present.
  if (page.slice(Math.max(mainOpeningEnd,cardStart-70),cardStart).includes(conditionalOpen) ||
      page.slice(originalEnd,originalEnd+65).includes(conditionalClose)) {
    throw Error('[FAIL] Courier premium availability conditional wrapper changed');
  }
  movable = card;
}
const themedCard = movable.replace('data-apois-courier-inline-status',
  'data-apois-courier-inline-status data-apois-premium-availability={online ? "online" : "offline"}');
page = page.slice(0, removeStart) + page.slice(removeEnd);
const insertAfterMain = page.indexOf('>', page.indexOf('<main data-apois-courier-map-home')) + 1;
page = page.slice(0, insertAfterMain) + '\n' + themedCard + '\n' + page.slice(insertAfterMain);

// Only display confirmed values from the EXISTING courier metrics and QA243
// authenticated day-specific count. Never infer deposits, withdrawable balance,
// or pretend unavailable server metrics are zero.
const summary = `
        {/* ${marker}: approved three-metric summary, no new RPC or state. */}
        {!activeJob && !completedJob && offers.length === 0 && (
          <section data-apois-premium-courier-summary aria-label="Resumo de hoje"
            className="relative z-10 mx-auto -mt-3 w-full max-w-lg rounded-[24px] border border-[#E7E9ED] bg-white px-3.5 pb-3 pt-2.5 text-[#0D0F12] shadow-[0_-10px_28px_-17px_rgba(13,15,18,.24)]">
            <div aria-hidden="true" className="mx-auto mb-2 h-1 w-9 rounded-full bg-[#D1D5DB]" />
            <h2 className="mb-2 text-[14px] font-extrabold">Hoje</h2>
            <div className="grid grid-cols-3 divide-x divide-[#E7E9ED]">
              <div className="min-w-0 px-1 text-center" aria-label="Entregas concluídas hoje">
                <ApoisPremiumPackage aria-hidden="true" className="mx-auto mb-1 h-[19px] w-[19px] text-[#F51D2A]" />
                <strong className="block truncate text-[clamp(13px,3.5vw,18px)] font-black tabular-nums">
                  {metrics?.completed_deliveries_today == null ? "—" : String(metrics.completed_deliveries_today)}
                </strong>
                <span className="block text-[10px] font-semibold text-[#525966]">Entregas</span>
              </div>
              <div className="min-w-0 px-1 text-center" aria-label="Ganhos de hoje">
                <ApoisPremiumWallet aria-hidden="true" className="mx-auto mb-1 h-[19px] w-[19px] text-[#08A63B]" />
                <strong className="block truncate text-[clamp(12px,3.2vw,18px)] font-black tabular-nums">
                  {metrics?.earnings_today == null || !Number.isFinite(Number(metrics.earnings_today)) ? "—" : courierMoney(metrics.earnings_today)}
                </strong>
                <span className="block text-[10px] font-semibold text-[#525966]">Ganhos</span>
              </div>
              <div className="min-w-0 px-1 text-center" aria-label="Tempo online de hoje">
                <ApoisPremiumClock aria-hidden="true" className="mx-auto mb-1 h-[19px] w-[19px] text-[#F51D2A]" />
                <strong className="block truncate text-[clamp(12px,3.2vw,18px)] font-black tabular-nums">
                  {metrics?.online_seconds_today == null || !Number.isFinite(Number(metrics.online_seconds_today)) ? "—" : formatCourierOnlineTime(metrics.online_seconds_today)}
                </strong>
                <span className="block text-[10px] font-semibold text-[#525966]">Tempo online</span>
              </div>
            </div>
          </section>
        )}
`;
const currentMainOpen = page.indexOf('<main data-apois-courier-map-home');
const currentMainClose = page.indexOf('</main>', currentMainOpen);
if (currentMainOpen < 0 || currentMainClose < currentMainOpen)
  throw Error('[FAIL] Courier premium home summary destination changed');
page = page.slice(0, currentMainClose) + summary + page.slice(currentMainClose);

// Scope the approved color treatments to the courier availability on THIS home.
// Avoid global color/theme substitutions and keep focus/disabled state intact.
css += `\n/* ${marker}: final light mobile availability visual */
.apois-system-theme [data-apois-courier-inline-status] { padding:4px 0 8px; margin:0 auto; }
.apois-system-theme [data-apois-premium-availability="online"] > section {
  background:#E6FAED!important; border:1px solid #CBEBD5!important;
}
.apois-system-theme [data-apois-premium-availability="offline"] > section {
  background:#F3F4F6!important; border:1px solid #E7E9ED!important;
}
.apois-system-theme [data-apois-courier-inline-status] p span { color:#0D0F12!important; }
.apois-system-theme [data-apois-premium-availability="online"] button[aria-label="Ficar offline"] {
  background:#08A63B!important; border-color:#08A63B!important;
}
.apois-system-theme [data-apois-premium-availability="online"] button[aria-label="Ficar offline"] > span {
  background:#FFFFFF!important; color:#0D0F12!important;
}
.apois-system-theme [data-apois-premium-courier-summary] { background:#FFFFFF!important; color:#0D0F12!important; }
`;

for (const token of ['onToggle={toggleOnline}', 'CourierRouteMap', 'CourierOfferCard', 'CourierCompletionSheet',
    'CourierBottomNav', 'data-apois-premium-courier-summary', 'courierMoney(metrics.earnings_today)',
    'completed_deliveries_today', 'formatCourierOnlineTime(metrics.online_seconds_today)']) {
  if (!page.includes(token)) throw Error('[FAIL] Courier premium home lost required contract: ' + token);
}
assertOnce(page, 'data-apois-courier-inline-status', 'single availability switch');
// Both files only written after every anchor/contract validation has passed.
writeFileSync(pagePath, page, 'utf8');
writeFileSync(cssPath, css, 'utf8');
console.log('[OK] APOIS Entregador premium home: existing availability moved above map, real day metrics, delivery flows untouched');