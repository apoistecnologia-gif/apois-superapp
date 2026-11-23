/**
 * APOIS_PREMIUM_ALL_SCREENS_V1 — follow the 6-page approved mockups and brand PDF.
 * Cosmetic-only: changes data markers, encapsulated styles and real-route navigation.
 * Operates exclusively inside .work/partner-*, after existing functional QA scripts.
 * Does not touch protected submodules, Supabase, offers, GPS, PIN or financial handlers.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';

const role = process.argv[2];
if (!['motorista', 'entregador'].includes(role)) throw Error('Expected motorista or entregador');
const base = resolve(process.env[role === 'motorista' ? 'APOIS_MOTORISTA_WORKSPACE' : 'APOIS_ENTREGAS_WORKSPACE'] || (role === 'motorista' ? '.work/partner-motorista' : '.work/partner-entregador'));
const marker = 'APOIS_PREMIUM_ALL_SCREENS_V1';
const files = new Map();
function get(rel) {
  if (!files.has(rel)) {
    const p=resolve(base,rel);
    if (!existsSync(p)) throw Error('[FAIL] Missing generated file: '+rel);
    const source=readFileSync(p,'utf8');
    if (source.includes(marker)) throw Error('[FAIL] All-screens patch already applied: '+rel);
    files.set(rel,source);
  }
  return files.get(rel);
}
function put(rel,value) {if(!value || value===files.get(rel))throw Error('[FAIL] No visual change: '+rel);files.set(rel,value);}
function section(source, from, until, mutate, label) {
  const start=source.indexOf(from);
  const end=start<0 ? -1 : source.indexOf(until,start+from.length);
  if(start<0||end<0||source.indexOf(from,start+from.length)>=0)throw Error('[FAIL] Changed component boundary: '+label);
  const sub=source.slice(start,end), patched=mutate(sub);
  if(patched===sub)throw Error('[FAIL] No new screen hook: '+label);
  return source.slice(0,start)+patched+source.slice(end);
}
function markFirst(source,token,tag,name,label){
  let changed=false;
  const patched=source.replace(new RegExp('<'+tag+'(?=\\s|>)'), x=>{changed=true;return x+' data-apois-premium-screen="'+name+'"';});
  if(!changed)throw Error('[FAIL] Cannot mark '+label);
  return patched;
}
function markComponent(source,from,until,tag,name){return section(source,from,until,chunk=>markFirst(chunk,from,tag,name,name),name);}
const driverCss=String.raw`
/* APOIS_PREMIUM_ALL_SCREENS_V1 | Approved PDF brand: #F51D2A / #BB071D / #0D0F12 */
:root { --apois-premium-red:#F51D2A; --apois-premium-red-dark:#BB071D; --apois-premium-ink:#0D0F12; --apois-premium-surface:#F3F4F6; --apois-premium-muted:#686F79; }
[data-apois-premium-screen] { font-family:Inter, ui-sans-serif,system-ui,sans-serif; -webkit-tap-highlight-color:transparent; }
[data-apois-premium-screen] :focus-visible { outline:2px solid #BB071D; outline-offset:2px; }
[data-apois-premium-screen] button { touch-action:manipulation; }
/* Offer is a white premium sheet over the existing live map, not a static mockup. */
[data-apois-premium-screen="driver-offer"] { background:rgba(13,15,18,.35)!important; }
[data-apois-premium-screen="driver-offer"] > div { max-width:430px; border-radius:28px 28px 0 0!important; border-color:#E7E9ED!important; background:#FFFFFF!important; color:#0D0F12!important; box-shadow:0 -15px 50px rgba(13,15,18,.19)!important; }
[data-apois-premium-screen="driver-offer"] > div > div:first-child { background:#fff; color:#0D0F12; }
[data-apois-premium-screen="driver-offer"] [data-apois-premium-offer-heading] { display:block; margin:3px auto 5px; border-radius:999px; background:#FFF1F2; color:#BB071D; padding:6px 14px; text-align:center; width:max-content; max-width:90%; font-size:12px; font-weight:900; }
[data-apois-premium-screen="driver-offer"] button { min-height:44px; }
[data-apois-premium-screen="driver-offer"] button:disabled { opacity:.55; }
[data-apois-premium-screen="driver-offer"] [class*="bg-[#08090A]"] { background:#fff!important; border-top:1px solid #E7E9ED!important; }
[data-apois-premium-screen="driver-offer"] [class*="text-foreground"] { color:#0D0F12!important; }
/* Pickup, in-trip, arrived: keep the map and state transitions; restyle only cards. */
[data-apois-premium-screen="driver-active"] { color:#0D0F12; }
[data-apois-premium-screen="driver-active"] [class*="rounded-[20px]"] { background:#FFFFFF!important; border:1px solid #E7E9ED; box-shadow:0 7px 26px rgba(13,15,18,.055); }
[data-apois-premium-screen="driver-active"] [class*="text-primary"] { color:#BB071D!important; }
[data-apois-premium-screen="driver-active"] button:not(:disabled) { min-height:44px; }
[data-apois-premium-screen="driver-active"] [class*="bg-primary"] { background-color:#BB071D!important; color:#FFFFFF!important; }
/* Real finance, rides and profile: align to page 4's white card hierarchy. */
[data-apois-premium-screen="driver-finance"], [data-apois-premium-screen="driver-rides"], [data-apois-premium-screen="driver-profile"] { background:#F3F4F6!important; color:#0D0F12!important; min-height:100dvh; padding-bottom:max(84px,env(safe-area-inset-bottom)); }
[data-apois-premium-screen="driver-finance"] > header { background:#FFFFFF!important; color:#0D0F12!important; border-bottom:1px solid #E7E9ED!important; }
[data-apois-premium-screen="driver-finance"] main section:not([role="alert"]) { background:#FFFFFF!important; border:1px solid #E7E9ED!important; border-radius:22px!important; box-shadow:0 8px 28px rgba(13,15,18,.05); color:#0D0F12!important; }
[data-apois-premium-screen="driver-finance"] main section:not([role="alert"]) :is(p,h2,strong,span) { color:#0D0F12; }
[data-apois-premium-screen="driver-finance"] button[aria-pressed="true"] {background:#BB071D!important;color:#FFFFFF!important;}
[data-apois-premium-screen="driver-finance"] button[aria-pressed="false"] {background:#FFFFFF!important;color:#0D0F12!important; border:1px solid #E7E9ED!important;}
[data-apois-premium-screen="driver-finance"] :is(h1,h2), [data-apois-premium-screen="driver-profile"] :is(h1,h2), [data-apois-premium-screen="driver-rides"] :is(h1,h2) { color:#0D0F12!important; }
[data-apois-premium-screen="driver-finance"] [class*="text-[#F6BE1C]"] { color:#BB071D!important; }
[data-apois-premium-screen="driver-finance"] [class*="bg-[#F6BE1C]"] { background:#BB071D!important; color:#FFFFFF!important; }
[data-apois-premium-screen="driver-finance"] [class*="bg-[#111315]"] { background:#FFFFFF!important; color:#0D0F12!important; border:1px solid #E7E9ED!important; }
[data-apois-premium-screen="driver-finance"] [class*="bg-[#0D0F11]"] { background:#FFFFFF!important; color:#0D0F12!important; border:1px solid #E7E9ED!important; }
[data-apois-premium-screen="driver-finance"] input { color:#0D0F12!important; background:#FFFFFF!important; border:1px solid #D8DCE2!important; color-scheme:light; }
[data-apois-premium-screen="driver-finance"] [role="alert"] { color:#891822; }
[data-apois-premium-screen="driver-finance"] :is(button,input) { min-height:44px; }
[data-apois-premium-screen="driver-rides"] article, [data-apois-premium-screen="driver-profile"] article { background:#FFFFFF; border-color:#E7E9ED; border-radius:22px; }
@media (max-width:360px) { [data-apois-premium-screen="driver-offer"] > div { max-height:90dvh; } [data-apois-premium-screen="driver-finance"] { padding-left:12px; padding-right:12px; } }
`;
const courierCss=String.raw`
/* APOIS_PREMIUM_ALL_SCREENS_V1 | Dedicated Courier approved map/offer/active/finance screens */
:root { --apois-premium-red:#F51D2A; --apois-premium-red-dark:#BB071D; --apois-premium-ink:#0D0F12; --apois-premium-surface:#F3F4F6; --apois-premium-muted:#686F79; }
.apois-system-theme [data-apois-premium-screen] { font-family:Inter,ui-sans-serif,system-ui,sans-serif; -webkit-tap-highlight-color:transparent; }
.apois-system-theme [data-apois-premium-screen] :focus-visible {outline:2px solid #BB071D;outline-offset:2px;}
.apois-system-theme [data-apois-premium-screen] button {touch-action:manipulation;min-height:44px;}
/* Incoming orders must be a white bottom sheet, with real offer amounts. */
.apois-system-theme [data-apois-premium-screen="courier-offer"], .apois-system-theme [data-apois-premium-screen="courier-offer-overlay"] {background:#FFFFFF!important;color:#0D0F12!important;border:1px solid #E7E9ED!important;border-radius:26px!important;box-shadow:0 16px 48px rgba(13,15,18,.16)!important;}
.apois-system-theme [data-apois-premium-screen="courier-offer"] :is(p,span,h2,h3,strong), .apois-system-theme [data-apois-premium-screen="courier-offer-overlay"] :is(p,span,h2,h3,strong) {color:#0D0F12;}
.apois-system-theme [data-apois-premium-screen="courier-offer"] :is(div[class*="bg-black"],div[class*="bg-zinc-9"],div[class*="bg-[#080808]"]), .apois-system-theme [data-apois-premium-screen="courier-offer-overlay"] :is(div[class*="bg-black"],div[class*="bg-zinc-9"]) {background:#F3F4F6!important;color:#0D0F12!important;border-color:#E7E9ED!important;}
.apois-system-theme [data-apois-premium-screen="courier-offer"] button[class*="border-primary"] {background:#FFFFFF!important;border:1px solid #F51D2A!important;color:#BB071D!important;}
.apois-system-theme [data-apois-premium-screen="courier-offer"] button:not([class*="border-primary"]), .apois-system-theme [data-apois-premium-screen="courier-offer-overlay"] button[data-apois-premium-accept] {background:#BB071D!important;color:#FFFFFF!important;}
.apois-system-theme [data-apois-premium-screen="courier-offer"] button:not([class*="border-primary"]) *, .apois-system-theme [data-apois-premium-screen="courier-offer-overlay"] button[data-apois-premium-accept] * {color:#FFFFFF!important;}
/* Active deliveries: keep native route/map, status/confirmation and assistance. */
.apois-system-theme [data-apois-premium-screen="courier-active"], .apois-system-theme [data-apois-premium-screen="courier-active-overlay"], .apois-system-theme [data-apois-premium-screen="courier-completion"] {background:#FFFFFF!important;color:#0D0F12!important;border:1px solid #E7E9ED!important;border-radius:26px!important;box-shadow:0 8px 30px rgba(13,15,18,.09)!important;}
.apois-system-theme [data-apois-premium-screen="courier-active"] :is(p,strong,h2,h3), .apois-system-theme [data-apois-premium-screen="courier-completion"] :is(p,strong,h2,h3) {color:#0D0F12;}
.apois-system-theme [data-apois-premium-screen="courier-active"] button[class*="bg-primary"], .apois-system-theme [data-apois-premium-screen="courier-completion"] button[class*="bg-primary"] {background:#BB071D!important;color:#FFFFFF!important;}
/* Finance, history, profile: real data only; do not expose disabled withdrawal. */
.apois-system-theme [data-apois-premium-screen="courier-finance"], .apois-system-theme [data-apois-premium-screen="courier-history"], .apois-system-theme [data-apois-premium-screen="courier-profile"], .apois-system-theme [data-apois-premium-screen="courier-finance-root"], .apois-system-theme [data-apois-premium-screen="courier-history-root"], .apois-system-theme [data-apois-premium-screen="courier-profile-root"] {background:#F3F4F6!important;color:#0D0F12!important;min-height:100dvh;}
.apois-system-theme [data-apois-premium-screen="courier-finance-root"] > header, .apois-system-theme [data-apois-premium-screen="courier-history-root"] > header, .apois-system-theme [data-apois-premium-screen="courier-profile-root"] > header {background:#FFFFFF!important;color:#0D0F12!important;border-bottom:1px solid #E7E9ED!important;}
.apois-system-theme [data-apois-premium-screen="courier-finance-root"] button[aria-label="Voltar"] {background:#FFFFFF!important;color:#0D0F12!important;border:1px solid #E7E9ED!important;}
.apois-system-theme [data-apois-premium-screen="courier-finance"] section, .apois-system-theme [data-apois-premium-screen="courier-history"] section, .apois-system-theme [data-apois-premium-screen="courier-profile"] section {background:#FFFFFF!important;color:#0D0F12!important;border:1px solid #E7E9ED!important;border-radius:22px!important;box-shadow:0 6px 22px rgba(13,15,18,.05)!important;}
.apois-system-theme [data-apois-premium-screen="courier-finance"] :is(h1,h2,h3,p,strong), .apois-system-theme [data-apois-premium-screen="courier-history"] :is(h1,h2,h3,p,strong), .apois-system-theme [data-apois-premium-screen="courier-profile"] :is(h1,h2,h3,p,strong) {color:#0D0F12;}
.apois-system-theme [data-apois-premium-screen="courier-finance"] input, .apois-system-theme [data-apois-premium-screen="courier-profile"] input {background:#FFFFFF!important;color:#0D0F12!important;border:1px solid #D8DCE2!important;}
.apois-system-theme [data-apois-premium-screen="courier-finance"] button[class*="bg-primary"] {background:#BB071D!important;color:#FFFFFF!important;}
.apois-system-theme [data-apois-premium-screen="courier-offer-overlay"] [role="timer"], .apois-system-theme [data-apois-premium-screen="courier-offer"] [role="timer"] {font-variant-numeric:tabular-nums;}
/* Preserve the already-approved light home navigation across history and finance. */
.apois-system-theme [data-apois-courier-bottom-nav] {background:#FFFFFF!important;border-top:1px solid #E7E9ED!important;}
.apois-system-theme [data-apois-courier-bottom-nav] [aria-current="page"] {color:#F51D2A!important;}
@media(max-width:360px){.apois-system-theme [data-apois-premium-screen="courier-offer"] {border-radius:22px!important;}.apois-system-theme [data-apois-premium-screen="courier-finance"] {padding-left:11px;padding-right:11px;}}
`;

const premiumNav = `
/* APOIS_PREMIUM_ALL_SCREENS_V1: four actual routes, no offer/session/GPS mutation. */
import { Link } from "@tanstack/react-router";
import { House, CarFront, WalletCards, UserRound } from "lucide-react";
const tabs = [
 { key:"inicio", to:"/motorista/app", title:"Início", icon:House },
 { key:"corridas", to:"/motorista/corridas", title:"Corridas", icon:CarFront },
 { key:"ganhos", to:"/motorista/ganhos", title:"Ganhos", icon:WalletCards },
 { key:"perfil", to:"/motorista/perfil", title:"Perfil", icon:UserRound },
] as const;
type NavKey=(typeof tabs)[number]["key"];
export function ApoisPremiumDriverNav({active}: {active:NavKey}){
 return (
  <nav data-apois-premium-internal-nav aria-label="Navegação premium do motorista"
    className="fixed inset-x-0 bottom-0 z-[35] border-t border-[#E7E9ED] bg-white/95 px-[max(8px,env(safe-area-inset-left))] pb-[max(7px,env(safe-area-inset-bottom))] pt-1 backdrop-blur-xl shadow-[0_-6px_24px_-14px_rgba(13,15,18,.24)]">
   <div className="mx-auto grid min-h-[64px] max-w-md grid-cols-4 gap-1">
    {tabs.map((tab)=><Link key={tab.key} to={tab.to}
      aria-current={active===tab.key?"page":undefined}
      aria-label={tab.title}
      className={"flex min-h-12 min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#BB071D] "+(active===tab.key?"text-[#F51D2A]":"text-[#0D0F12]")}>
      <tab.icon aria-hidden="true" className="h-5 w-5"/>
      <span className="text-[11px] font-bold">{tab.title}</span>
      <span aria-hidden="true" className={"h-[3px] w-7 rounded-full "+(active===tab.key?"bg-[#F51D2A]":"bg-transparent")}/>
    </Link>)}
   </div>
  </nav>
 );
}
`;

if (role==='motorista') {
  const app='src/routes/motorista.app.tsx'; let s=get(app);
  s=section(s,'function IncomingOffer(', 'function InfoCard(', chunk=>{
    if(!chunk.includes('role="dialog"'))throw Error('[FAIL] Driver offer role dialog missing');
    let t=chunk.replace('role="dialog"','data-apois-premium-screen="driver-offer" role="dialog"');
    if(t.includes('{/* Preço hero */}')) t=t.replace('{/* Preço hero */}','<div data-apois-premium-offer-heading role="heading" aria-level={2}>Nova corrida</div>\n          {/* Preço hero */}');
    else if(t.includes('Ganho da corrida')) t=t.replace('Ganho da corrida','Ganho da corrida'); // preserve if later QA moved hero
    return t;
  },'Motorista offer');
  s=section(s,'function ActiveRidePanel(', '\nfunction TopStat(', chunk=>{
    const pattern=/className="flex flex-col gap-4 pt-1 animate-sheet-in"/g;
    const n=(chunk.match(pattern)||[]).length;
    if(n<1) throw Error('[FAIL] Driver active panels changed: missing phase sheets');
    return chunk.replace(pattern,'data-apois-premium-screen="driver-active" className="flex flex-col gap-4 pt-1 animate-sheet-in"');
  },'Motorista active ride');
  put(app,s);
  if (existsSync(resolve(base,'src/components/ApoisPremiumDriverNav.tsx')))
    throw Error('[FAIL] Premium driver nav must be created only in the isolated workspace');
  files.set('src/components/ApoisPremiumDriverNav.tsx',premiumNav);
  for(const [file,name,fn] of [
    ['src/routes/motorista.ganhos.tsx','driver-finance','function DriverEarningsPage()'],
    ['src/routes/motorista.corridas.tsx','driver-rides','function DriverRidesPage()'],
    ['src/routes/motorista.perfil.tsx','driver-profile','function DriverProfilePage()'],
  ]) {
    let text=get(file);
    const pos=text.indexOf(fn);
    if(pos<0)throw Error('[FAIL] Driver page function missing: '+name);
    let before=text.slice(0,pos), tail=text.slice(pos);
    if(name==='driver-finance') {
      const m=tail.match(/\n  return \(\s*<div\b/);
      if(!m)throw Error('[FAIL] Driver finance root changed');
      const i=m.index+m[0].lastIndexOf('<div');
      tail=tail.slice(0,i)+tail.slice(i).replace('<div','<div data-apois-premium-screen="driver-finance"');
    } else {
      const index=tail.indexOf('<main');
      if(index<0)throw Error('[FAIL] Driver inner main missing: '+name);
      tail=tail.slice(0,index)+tail.slice(index).replace('<main','<main data-apois-premium-screen="'+name+'"');
    }
    const navImport = 'import { ApoisDriverBottomNav } from "@/components/ApoisDriverBottomNav";';
    if((before+tail).split(navImport).length!==2)throw Error('[FAIL] Driver nav import changed: '+name);
    const current=before+tail;
    const withImport=current.replace(navImport,navImport+'\nimport { ApoisPremiumDriverNav } from "@/components/ApoisPremiumDriverNav";');
    const legacy='<ApoisDriverBottomNav />';
    if(withImport.split(legacy).length!==2)throw Error('[FAIL] Driver safe recovery/nav boundary changed: '+name);
    const activeTab=name==='driver-finance'?'ganhos':name==='driver-rides'?'corridas':'perfil';
    put(file,withImport.replace(legacy,legacy+'\n      <ApoisPremiumDriverNav active="'+activeTab+'" />'));
  }
  const css='src/apois-ui-hardening-round3.css';put(css,get(css)+'\n'+driverCss);
} else {
  const page='src/components/CourierPremiumViews.tsx'; let s=get(page);
  for(const [start,end,name,tag] of [
    ['export function CourierOfferCard(', 'export function ActiveDelivery(', 'courier-offer','section'],
    ['export function ActiveDelivery(', 'export function CourierFinance(', 'courier-active','section'],
    ['export function CourierFinance(', 'function FinanceInput(', 'courier-finance','main'],
  ]) {
    s=markComponent(s,start,end,tag,name);
    if(name==='courier-finance')s=markComponent(s,start,end,'div','courier-finance-root');
  }
  // Financial presentation is truthful when the existing metrics RPC is unavailable:
  // null is not a confirmed zero. No finance action, payout flag or query changes.
  s=section(s,'export function CourierFinance(', 'function FinanceInput(', chunk=>{
    let next=chunk, changes=0;
    for (const [from,to] of [
      ['{courierMoney(metrics?.earnings_today)}','{metrics?.earnings_today == null ? "—" : courierMoney(metrics.earnings_today)}'],
      ['{courierMoney(metrics?.earnings_week)}','{metrics?.earnings_week == null ? "—" : courierMoney(metrics.earnings_week)}'],
      ['{courierMoney(wallet?.available_balance)}','{wallet?.available_balance == null ? "—" : courierMoney(wallet.available_balance)}'],
    ]) if(next.includes(from)){next=next.replaceAll(from,to);changes++;}
    if(changes<2)throw Error('[FAIL] Courier finance amounts changed: refuse to infer fake zeros');
    return next;
  },'courier truthful finance metrics');
  put(page,s);
  const panels='src/components/CourierPanels.tsx';let p=get(panels);
  for(const [start,end,name] of [
    ['export function CourierHistoryPanel(', 'export function CourierProfilePanel(', 'courier-history'],
    ['export function CourierProfilePanel(', 'function ', 'courier-profile'],
  ]) {
    if(name==='courier-profile') {
      const a=p.indexOf(start);if(a<0)throw Error('[FAIL] Courier profile missing');
      const sub=p.slice(a);
      const m=markFirst(markFirst(sub,start,'main',name,name),start,'div','courier-profile-root','courier-profile-root');
      p=p.slice(0,a)+m;
    } else {
      p=markComponent(p,start,end,'main',name);
      p=markComponent(p,start,end,'div','courier-history-root');
    }
  }
  put(panels,p);
  for(const [rel,from,name] of [
    ['src/components/CourierOfferOverlay.tsx', 'export function CourierOfferOverlay()', 'courier-offer-overlay'],
    ['src/components/CourierActiveDeliveryOverlay.tsx', 'export function CourierActiveDeliveryOverlay()', 'courier-active-overlay'],
    ['src/components/CourierCompletionSupport.tsx', 'export function CourierCompletionSheet(', 'courier-completion'],
  ]){
    const a=get(rel),i=a.indexOf(from);if(i<0)throw Error('[FAIL] Courier component missing '+name);
    const m=markFirst(a.slice(i),from,'section',name,name);
    put(rel,a.slice(0,i)+m);
  }
  const css='src/system-theme.css';put(css,get(css)+'\n'+courierCss);
}
// Critical operational contracts: unmodified event handlers remain in the generated code.
const requirements=role==='motorista' ? [
 ['src/routes/motorista.app.tsx', ['onAccept','onReject','onStart','onComplete','DriverActiveRideRecovery','toggleOnline','PickupNavOverlay','ActiveTripNavOverlay','data-apois-premium-screen="driver-offer"','data-apois-premium-screen="driver-active"']],
 ['src/routes/motorista.ganhos.tsx',['loadDriverFinancialDashboard','data-apois-premium-screen="driver-finance"']],
 ['src/routes/motorista.corridas.tsx',['loadDriverProfile','RideCard','data-apois-premium-screen="driver-rides"']],
 ['src/routes/motorista.perfil.tsx',['handleLogout','data-apois-premium-screen="driver-profile"']],
] : [
 ['src/components/CourierPremiumViews.tsx',['onAccept','onReject','onTransition','onComplete','onRequestPayout','data-apois-premium-screen="courier-offer"','data-apois-premium-screen="courier-active"','data-apois-premium-screen="courier-finance"']],
 ['src/components/CourierPanels.tsx',['onHistory','onFinance','onProfile','data-apois-premium-screen="courier-history"','data-apois-premium-screen="courier-profile"']],
 ['src/components/CourierOfferOverlay.tsx',['data-apois-premium-screen="courier-offer-overlay"']],
 ['src/components/CourierActiveDeliveryOverlay.tsx',['data-apois-premium-screen="courier-active-overlay"']],
];
for (const [file, tokens] of requirements) {
  const source=files.get(file)||readFileSync(resolve(base,file),'utf8');
  for(const t of tokens)if(!source.includes(t))throw Error('[FAIL] Premium all-screens lost existing contract '+file+': '+t);
}
for(const [rel,source] of files){
  const p=resolve(base,rel);mkdirSync(dirname(p),{recursive:true});
  writeFileSync(p,source,'utf8');
}
console.log(`[OK] ${marker}: ${role}; ${files.size} files; offer, active service, gains, history, profile and safe areas restyled with official palette; operational handlers preserved.`);