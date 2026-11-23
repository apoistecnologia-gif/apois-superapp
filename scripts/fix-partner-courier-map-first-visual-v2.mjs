/**
 * APOIS_COURIER_MAP_FIRST_V2
 * Approved Entregador mockup page 3: large LIVE map, compact toggle and
 * unobtrusive operational access; bottom stats above the real four-tab nav.
 * A final presentation-only patch applied to disposable .work/partner-entregador.
 * No RPC, GPS, map instance, PIN, active order or finance behavior changed.
 */
import {readFileSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';

const root=resolve(process.env.APOIS_ENTREGAS_WORKSPACE || '.work/partner-entregador');
const marker='APOIS_COURIER_MAP_FIRST_V2';
const filenames={
 route:'src/routes/courier.tsx',
 premium:'src/components/CourierPremiumViews.tsx',
 map:'src/components/CourierRouteMap.tsx',
 tracker:'src/components/CourierLocationTracker.tsx',
 css:'src/system-theme.css',
};
const docs=new Map(Object.entries(filenames).map(([key,path])=>[key,readFileSync(resolve(root,path),'utf8')]));
for(const [key,value] of docs) if(value.includes(marker)) throw Error(`[FAIL] ${marker} repeated in ${key}`);
function once(s,needle,label){
 const count=s.split(needle).length-1;
 if(count!==1)throw Error(`[FAIL] ${marker}: ${label} expected once; got ${count}`);
 return s.indexOf(needle);
}
function replaceOnce(s,from,to,label){once(s,from,label);return s.replace(from,to);}
function sliceFunction(s,start,end,label){const a=once(s,start,label+' start');const b=s.indexOf(end,a+start.length);if(b<a)throw Error(`[FAIL] ${marker}: ${label} end missing`);return [a,b,s.slice(a,b)];}

// 1) The location tracking service remains mounted and unmodified. Only the
// success/loading banner becomes screen-reader-only; GPS errors remain visible.
let tracker=docs.get('tracker');
tracker=replaceOnce(tracker,'  return (\n    <div\n      className={`flex items-center gap-2 rounded-xl border',
  '  return (\n    <div data-apois-courier-gps-status-v2\n      className={`flex items-center gap-2 rounded-xl border',
  'GPS-only banner wrapper');

// 2) Replace only the stateless availability presentation. Keep the real
// onToggle callback, busy lock and active-delivery lock intact.
let premium=docs.get('premium');
{
 const [a,b,old]=sliceFunction(premium,'export function CourierStatusCard(', 'export function CourierWaitingSheet(', 'availability');
 for(const required of ['onToggle','Boolean(activeJob && online)','data-apois-courier-availability-toggle']){
  if(!old.includes(required))throw Error(`[FAIL] ${marker}: previous availability contract missing ${required}`);
 }
 const status=`export function CourierStatusCard({ online, busy, activeJob, onToggle }: any) {
  return (
    <section data-apois-courier-availability data-apois-courier-premium-status-v2
      aria-label="Disponibilidade do entregador"
      className="flex min-h-[54px] w-full items-center gap-3 rounded-full border border-[#D1EBD9] bg-[#E9FAEE] px-3 py-2 text-[#0D0F12] shadow-[0_6px_20px_rgba(13,15,18,.08)]">
      <span className={"h-3 w-3 shrink-0 rounded-full ring-4 "+(online ? "bg-[#08A63B] ring-[#D1F4DA]" : "bg-[#737B85] ring-[#E5E7EB]")} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-extrabold leading-tight text-[#0D0F12]">{online ? "Disponível" : "Indisponível"}</p>
        <p className="text-[10px] font-medium leading-tight text-[#4C5963]">{activeJob && online ? "Conclua a entrega antes de ficar offline" : online ? "Pronto para receber entregas" : "Ative para receber entregas"}</p>
      </div>
      <button data-apois-courier-availability-toggle type="button" role="switch"
        aria-checked={online} aria-pressed={online}
        aria-label={online ? "Ficar offline" : "Ficar online"}
        disabled={busy || Boolean(activeJob && online)} onClick={onToggle}
        className={"relative h-9 w-[66px] min-h-9 shrink-0 rounded-full border transition-colors disabled:opacity-50 "+(online ? "border-[#08A63B] bg-[#08A63B]" : "border-[#B8C0C8] bg-[#D6DCE2]")}>
        <span className={"absolute top-[3px] grid h-[28px] w-[28px] place-items-center rounded-full bg-white text-[#25303A] shadow-sm transition-all "+(online ? "left-[33px]" : "left-[3px]")}>
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Power className="h-3.5 w-3.5" />}
        </span>
      </button>
    </section>
  );
}

`;
 premium=premium.slice(0,a)+status+premium.slice(b);
}
// 3) Make the existing Live Google Map the main canvas. Do not replace the
// Google map, markers, recenter control or position subscription.
let map=docs.get('map');
{
 const [a,b,old]=sliceFunction(map,'export function CourierLiveMap(', 'export function CourierRouteMap(', 'live-map');
 for(const required of ['<Map','currentPosition','<RecenterControl','nearbyMerchants']){
  if(!old.includes(required)) throw Error(`[FAIL] ${marker}: live map lost ${required}`);
 }
 let next=replaceOnce(old,'    <section ','    <section data-apois-courier-live-map-v2 ', 'map section');
 const canvas=/<div\s+className="relative h-\[/g;
 const matches=[...next.matchAll(canvas)];
 if(matches.length!==1) throw Error(`[FAIL] ${marker}: canvas height hooks ${matches.length}`);
 next=next.replace(canvas,'<div data-apois-courier-map-canvas-v2 className="relative h-[');
 map=map.slice(0,a)+next+map.slice(b);
}

// 4) Add a layout scope to only the idle/available home; accepted deliveries
// and visible offers preserve their original map sizes and action overlays.
let route=docs.get('route');
{
 // Final QA may rewrite the online-state expression. Find the actual home
 // structurally through its live map + GPS tracker rather than that literal.
 const mainAt=once(route,'<main data-apois-courier-map-home','home main');
 const trackerAt=route.lastIndexOf('<CourierLocationTracker',mainAt);
 const headerAt=route.lastIndexOf('<header',trackerAt);
 const rootAt=route.lastIndexOf('<div className="min-h-dvh',headerAt);
 if(trackerAt<0 || headerAt<0 || rootAt<0 || rootAt>=headerAt)
   throw Error(`[FAIL] ${marker}: live home GPS/header/root boundaries changed`);
 route=route.slice(0,rootAt)+route.slice(rootAt).replace('<div ','<div data-apois-courier-map-first-root-v2 ');
 route=replaceOnce(route,'<main data-apois-courier-map-home',
  '<main data-apois-courier-map-home data-apois-courier-map-first-v2={!activeJob && !completedJob && offers.length === 0}',
  'idle-only map scope');
 // Add the official brand typography under the existing official PNG, not a
 // recreated logo. Header menu/profile behavior stays exactly the same.
 const headerStart=route.lastIndexOf('<header',route.indexOf('<main data-apois-courier-map-home'));
 const headerEnd=route.indexOf('</header>',headerStart);
 if(headerStart<0 || headerEnd<headerStart)throw Error(`[FAIL] ${marker}: header boundary changed`);
 const header=route.slice(headerStart,headerEnd);
 if(!header.includes('APOIS_PARTNER_LOGO_DATA_URL') || !header.includes('Abrir perfil'))
  throw Error(`[FAIL] ${marker}: official logo / profile button missing`);
 const imgEnd=header.indexOf('/>',header.indexOf('src={APOIS_PARTNER_LOGO_DATA_URL}'));
 if(imgEnd<0)throw Error(`[FAIL] ${marker}: official header logo image ending changed`);
 const title='<span data-apois-courier-brand-title-v2 className="block text-center text-[16px] font-black leading-none tracking-tight text-[#0D0F12]">APOIS <strong className="text-[#F51D2A]">ENTREGADOR</strong></span>';
 route=route.slice(0,headerStart)+header.slice(0,imgEnd+2)+'\n          '+title+header.slice(imgEnd+2)+route.slice(headerEnd);
 // Real three-metric summary is already inserted by earlier premium patch:
 // change only its display heading to show the actual availability state.
 route=replaceOnce(route,'<h2 className="mb-2 text-[14px] font-extrabold">Hoje</h2>',
  '<h2 className="mb-2 flex items-center gap-1.5 text-[14px] font-extrabold"><ApoisPremiumPackage className="h-4 w-4 text-[#F51D2A]" aria-hidden="true" /> {online ? "Disponível para entregas" : "Resumo de hoje"}</h2>',
  'bottom summary heading');
 for(const tok of ['data-apois-courier-calls-card-v2','onClick={()=>setAvailableCallsOpen(true)}',
  'CourierLocationTracker enabled={online}', 'CourierBottomNav',
  'data-apois-premium-courier-summary', '<CourierOfferCard', '<CourierRouteMap']){
  if(!route.includes(tok))throw Error(`[FAIL] ${marker}: protected courier feature missing ${tok}`);
 }
}

// 5) CSS reset scoped to the idle home. This is applied LAST, after all
// earlier QA styles, with selectors stronger than the legacy vertical cards.
let css=docs.get('css');
css+=String.raw`
/* APOIS_COURIER_MAP_FIRST_V2: Approved map-first Entregador presentation.
   Only the idle home is affected. The real GPS, offers, delivery lifecycle,
   navigation and backend are not modified by these visual rules. */
.apois-system-theme [data-apois-courier-gps-status-v2][role="status"] {
  position:absolute!important;inline-size:1px!important;block-size:1px!important;
  padding:0!important;margin:-1px!important;overflow:hidden!important;
  clip-path:inset(50%)!important;white-space:nowrap!important;border:0!important;
}
.apois-system-theme [data-apois-courier-gps-status-v2][role="alert"] {
  position:relative;z-index:45;margin:6px 12px!important;background:#FFF1F2!important;
  border-color:#F0A7B0!important;color:#8E1622!important;border-radius:14px;
}
.apois-system-theme [data-apois-courier-map-first-root-v2] {background:#F3F4F6!important;color:#0D0F12!important;}
.apois-system-theme [data-apois-courier-map-first-root-v2] > header {
  min-height:84px!important;background:#FFFFFF!important;border-bottom:0!important;
  box-shadow:0 4px 16px rgba(13,15,18,.04);padding-top:max(4px,env(safe-area-inset-top));
}
.apois-system-theme [data-apois-courier-map-first-root-v2] > header > div:nth-child(2) {
  display:flex!important;flex-direction:column!important;align-items:center!important;
  justify-content:center!important;gap:4px!important;padding:5px 0!important;
}
.apois-system-theme [data-apois-courier-map-first-root-v2] > header img[src] {max-height:43px!important;width:auto!important;}
.apois-system-theme [data-apois-courier-map-first-root-v2] [data-apois-courier-brand-title-v2] {
  color:#0D0F12!important;font-size:16px!important;letter-spacing:-.03em;
}
.apois-system-theme [data-apois-courier-map-first-root-v2] [data-apois-courier-brand-title-v2] strong {color:#F51D2A!important;}
/* No more GPS + status + request card + dark map header as four huge blocks. */
.apois-system-theme [data-apois-courier-map-home][data-apois-courier-map-first-v2="true"] {
  position:relative!important;max-width:none!important;width:100%!important;
  margin:0!important;padding:8px 10px 0!important;overflow:visible!important;
  padding-bottom:calc(75px + env(safe-area-inset-bottom))!important;
}
.apois-system-theme [data-apois-courier-map-first-v2="true"] [data-apois-courier-inline-status] {
  position:relative!important;z-index:24;max-width:520px!important;
  margin:0 auto 7px!important;padding:0!important;width:100%;
}
.apois-system-theme [data-apois-courier-premium-status-v2] {
  box-sizing:border-box!important;min-height:52px!important;border-radius:999px!important;
  padding:6px 12px!important;box-shadow:0 5px 16px rgba(13,15,18,.06)!important;
  background:#E9FAEE!important;border:1px solid #D5EBDB!important;color:#0D0F12!important;
}
.apois-system-theme [data-apois-courier-premium-status-v2] button[data-apois-courier-availability-toggle] {
  min-height:36px!important;height:36px!important;min-width:66px!important;
  border-radius:999px!important;border:1px solid #9CA3AF!important;
  background:#D6DCE2!important;
}
.apois-system-theme [data-apois-courier-premium-status-v2] button[data-apois-courier-availability-toggle][aria-checked="true"] {
  background:#08A63B!important;border-color:#08A63B!important;
}
.apois-system-theme [data-apois-courier-premium-status-v2] button[data-apois-courier-availability-toggle] > span {
  background:#FFFFFF!important;color:#0D0F12!important;border:0!important;
}
.apois-system-theme [data-apois-courier-map-first-v2="true"] [data-apois-courier-live-map-v2] {
  position:relative!important;border:0!important;border-radius:22px!important;
  overflow:hidden!important;background:#EDEAE4!important;
  box-shadow:0 8px 26px rgba(13,15,18,.09)!important;
  margin:0!important;
}
.apois-system-theme [data-apois-courier-map-first-v2="true"] [data-apois-courier-live-map-v2] > div:first-child {
  display:none!important;
}
.apois-system-theme [data-apois-courier-map-first-v2="true"] [data-apois-courier-map-canvas-v2] {
  height:calc(100dvh - 208px)!important;min-height:330px!important;
  max-height:880px!important;background:#EDEAE4!important;
}
/* Keep actual available-calls modal handler, but as a map overlay shortcut. */
.apois-system-theme [data-apois-courier-map-first-v2="true"] [data-apois-courier-calls-card-v2] {
  position:absolute!important;z-index:29!important;top:96px!important;left:23px!important;
  display:inline-flex!important;gap:7px!important;width:auto!important;
  min-height:39px!important;height:39px!important;max-width:calc(100vw - 115px)!important;
  padding:4px 11px!important;border-radius:999px!important;
  border:1px solid #E7E9ED!important;background:rgba(255,255,255,.96)!important;
  color:#0D0F12!important;box-shadow:0 4px 14px rgba(13,15,18,.12)!important;
}
.apois-system-theme [data-apois-courier-map-first-v2="true"] [data-apois-courier-calls-card-v2] > span:first-child {
  width:24px!important;height:24px!important;min-width:24px!important;
  border:0!important;border-radius:50%!important;background:#FFF1F2!important;
}
.apois-system-theme [data-apois-courier-map-first-v2="true"] [data-apois-courier-calls-card-v2] > span:first-child svg {width:14px!important;height:14px!important;}
.apois-system-theme [data-apois-courier-map-first-v2="true"] [data-apois-courier-calls-card-v2] > span:nth-child(2) > span:first-child {
  font-size:11px!important;line-height:1!important;font-weight:800!important;
}
.apois-system-theme [data-apois-courier-map-first-v2="true"] [data-apois-courier-calls-card-v2] > span:nth-child(2) > span:nth-child(2),
.apois-system-theme [data-apois-courier-map-first-v2="true"] [data-apois-courier-calls-card-v2] > svg {
  display:none!important;
}
/* The existing waiting card keeps its real refresh callback as a small chip. */
.apois-system-theme [data-apois-courier-map-first-v2="true"] section[aria-label="Aguardando novas entregas"] {
  position:fixed!important;z-index:25!important;
  bottom:calc(198px + env(safe-area-inset-bottom))!important;
  left:max(15px,calc((100vw - 450px) / 2))!important;
  width:auto!important;max-width:calc(100vw - 30px)!important;
  margin:0!important;padding:4px 6px 4px 12px!important;
  border-radius:999px!important;background:rgba(255,255,255,.95)!important;
  border:1px solid #E7E9ED!important;box-shadow:0 6px 18px rgba(13,15,18,.12)!important;
}
.apois-system-theme [data-apois-courier-map-first-v2="true"] section[aria-label="Aguardando novas entregas"] > div:first-child {
  display:flex!important;align-items:center!important;gap:6px!important;
}
.apois-system-theme [data-apois-courier-map-first-v2="true"] section[aria-label="Aguardando novas entregas"] > div:first-child p {
  font-size:11px!important;font-weight:700!important;color:#0D0F12!important;
}
.apois-system-theme [data-apois-courier-map-first-v2="true"] section[aria-label="Aguardando novas entregas"] > div:first-child button {
  width:32px!important;height:32px!important;min-height:32px!important;
}
.apois-system-theme [data-apois-courier-map-first-v2="true"] section[aria-label="Aguardando novas entregas"] > div:not(:first-child) {
  display:none!important;
}
/* Compact three real values in the bottom card, exactly like the approved PDF. */
.apois-system-theme [data-apois-courier-map-first-v2="true"] [data-apois-premium-courier-summary] {
  position:fixed!important;z-index:28!important;
  bottom:calc(74px + env(safe-area-inset-bottom))!important;
  left:50%!important;transform:translateX(-50%)!important;
  width:min(calc(100vw - 20px),440px)!important;max-width:440px!important;
  margin:0!important;padding:10px 13px 12px!important;
  border-radius:24px 24px 16px 16px!important;
  border:1px solid #E7E9ED!important;background:#FFFFFF!important;
  color:#0D0F12!important;box-shadow:0 -6px 30px rgba(13,15,18,.13)!important;
}
.apois-system-theme [data-apois-courier-map-first-v2="true"] [data-apois-premium-courier-summary] > div[aria-hidden="true"] {
  display:none!important;
}
.apois-system-theme [data-apois-courier-map-first-v2="true"] [data-apois-premium-courier-summary] h2 {
  font-size:13px!important;margin:0 0 7px!important;color:#0D0F12!important;
}
/* Small Android viewports: protect the real four-tab footer. */
@media(max-height:700px) {
 .apois-system-theme [data-apois-courier-map-first-v2="true"] [data-apois-courier-map-canvas-v2] {height:calc(100dvh - 195px)!important;min-height:245px!important;}
 .apois-system-theme [data-apois-courier-map-first-v2="true"] section[aria-label="Aguardando novas entregas"] {bottom:calc(183px + env(safe-area-inset-bottom))!important;}
 .apois-system-theme [data-apois-courier-map-first-v2="true"] [data-apois-premium-courier-summary] {padding:7px 11px 8px!important;}
}
`;
// Fail before touching the workspace if the critical live contracts disappear.
for(const token of ['onToggle','aria-checked={online}','data-apois-courier-availability-toggle','CourierOfferCard','CourierRouteMap','CourierCompletionSheet','data-apois-premium-courier-summary']){
 const combined=route+'\n'+premium+'\n'+map;
 if(!combined.includes(token))throw Error(`[FAIL] ${marker}: final operational token missing ${token}`);
}
const output={route,premium,map,tracker,css};
for(const [key,text] of Object.entries(output))writeFileSync(resolve(root,filenames[key]),text,'utf8');
console.log('[OK] APOIS Courier map-first V2: full-height live map, compact real switch, request chip, floating day summary, GPS errors preserved');