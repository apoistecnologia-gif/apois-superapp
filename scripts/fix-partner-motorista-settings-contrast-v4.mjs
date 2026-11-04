// APOIS_MOTORISTA_SETTINGS_CONTRAST_V4
// Correct white-on-white after red identity migration; preserve settings state and actions.
import {readFileSync,writeFileSync,existsSync} from "node:fs";
import {resolve} from "node:path";
const root=resolve(process.env.APOIS_MOTORISTA_WORKSPACE || ".work/partner-motorista");
const path=(part)=>resolve(root,"src",part);
const marker="APOIS_MOTORISTA_SETTINGS_CONTRAST_V4";
const read=(f)=>readFileSync(path(f),"utf8");
function exact(src,before,after,label) {
  const c=src.split(before).length-1;
  if(c!==1)throw Error("[FAIL] Contrast V4 "+label+" anchors: "+c);
  return src.replace(before,after);
}
const rows="components/settings/SettingsRow.tsx";
let row=read(rows);
row=exact(row, 'destructive ? "text-red-400" : driver ? "text-zinc-100" : "text-[#1B1B1B]"',
  'destructive ? "text-[#B91C1C]" : driver ? "text-[#111827]" : "text-[#1B1B1B]"',
  "readable interactive labels");
row=row.replace('driver\n                ? "break-words text-[13px] leading-5 text-[#666B73]"',
  'driver\n                ? "break-words text-[13px] leading-5 text-[#4B5563]"');
row=exact(row, '"flex min-h-12 w-full min-w-0 items-center gap-3 px-4 py-3.5 text-left transition motion-reduce:transition-none"',
  '"flex min-h-12 w-full min-w-0 items-center gap-3 px-4 py-3.5 text-left text-[#111827] transition motion-reduce:transition-none"',
  "row text fallback");
writeFileSync(path(rows),row,"utf8");

const header="components/settings/SettingsPageShell.tsx";
let shell=read(header);
// Shared driver variant is light-only per APOIS brand. Keep default/Entregador unchanged.
shell=exact(shell,
  'driver\n                ? "break-words text-[clamp(22px,6vw,24px)] font-black leading-tight tracking-tight text-[#111111]"',
  'driver\n                ? "break-words text-[clamp(22px,6vw,24px)] font-black leading-tight tracking-tight text-[#111827]"',
  "SettingsHero title on light background");
if(!shell.includes('const driver = variant === "driver"'))throw Error("[FAIL] Settings variant missing");
writeFileSync(path(header),shell,"utf8");

const section="components/settings/SettingsSection.tsx";
let sectionCode=read(section);
if(!sectionCode.includes('useSettingsVisual() === "driver"'))throw Error("[FAIL] Settings section lost variant");
sectionCode=exact(sectionCode,'driver\n                ? "flex min-w-0 items-center gap-1.5 text-[13px] font-black uppercase tracking-[0.12em] text-[#666B73]"',
  'driver\n                ? "flex min-w-0 items-center gap-1.5 text-[13px] font-black uppercase tracking-[0.12em] text-[#475569]"',
  "SettingsSection heading contrast");
writeFileSync(path(section),sectionCode,"utf8");

const page="routes/motorista.configuracoes.tsx";
let config=read(page);
const lines=config.split("\n");
let changed=0;
const newLines=lines.map(line=>{
  if(line.includes('rounded-[30px]') && line.includes('bg-gradient-to-br') && line.includes('shadow-')) {
    changed++;
    return '          <div className="relative overflow-hidden rounded-[24px] border border-[#E5E7EB] bg-white p-3 shadow-sm">';
  }
  return line;
});
if(changed!==1)throw Error("[FAIL] Settings hero wrapper count "+changed);
config=newLines.join("\n");
config=exact(config,
  'className="min-h-11 rounded-xl border border-[#E2E4E8] bg-[#F1F2F4] px-3 text-sm font-semibold text-[#111111]',
  'className="min-h-11 max-w-[min(100%,190px)] rounded-xl border border-[#CBD5E1] bg-white px-3 text-sm font-semibold text-[#111827]',
  "navigation selection legibility");
config=exact(config,
  '<div className="relative min-h-[100dvh] overflow-hidden bg-[#F7F7F8] text-[#111111]">',
  '<div data-apois-driver-settings-contrast-v4 className="relative min-h-[100dvh] overflow-x-hidden bg-[#F7F7F8] text-[#111827]">',
  "root settings contrast");
if(!config.includes('onClick={() => void handleSave()}') || !config.includes('onChange={(event) => update("navigation_app"')) {
  throw Error("[FAIL] Settings save/navigation logic changed");
}
writeFileSync(path(page),config,"utf8");

// Other pages use the same SettingsHero and inherited light theme: do not leave dark hero with dark text.
for(const rel of ["routes/motorista.privacidade.tsx","routes/motorista.suporte.tsx","routes/motorista.termos.tsx"]) {
  if(!existsSync(path(rel)))continue;
  let src=read(rel);let count=0;
  src=src.split("\n").map(line=>{
    if(line.includes('rounded-[30px]') && line.includes('bg-gradient-to-br') && line.includes('shadow-')) {
      count++;
      return '          <div className="relative min-w-0 overflow-hidden rounded-[24px] border border-[#E5E7EB] bg-white p-3 shadow-sm">';
    }
    return line;
  }).join("\n");
  if(count>1)throw Error("[FAIL] Multiple SettingsHero wrappers "+rel);
  if(count===1)writeFileSync(path(rel),src,"utf8");
}

const top="components/MovviHeader.tsx";
let move=read(top);
move=exact(move,"pt-[env(safe-area-inset-top)] backdrop-blur-xl",
  "pt-[max(28px,env(safe-area-inset-top))] backdrop-blur-xl",
  "native statusbar safe-area");
writeFileSync(path(top),move,"utf8");

const cssPath=path("styles.css");
let css=readFileSync(cssPath,"utf8");
if(css.includes("/* "+marker+" */"))throw Error("[FAIL] contrast CSS applied twice");
css += "\n/* "+marker+" */\n"+
  '[data-apois-driver-settings-contrast-v4] { color:#111827 !important; background:#F7F7F8 !important; }\n'+
  '[data-apois-driver-settings-contrast-v4] select { color:#111827 !important; background:#FFFFFF !important; color-scheme:light !important; border:1px solid #CBD5E1 !important; }\n'+
  '[data-apois-driver-settings-contrast-v4] select option { color:#111827; background:#FFFFFF; }\n'+
  '[data-apois-driver-settings-contrast-v4] :is(button,a,input,select):focus-visible { outline:2px solid #C9141B; outline-offset:2px; }\n'+
  '[data-apois-driver-settings-contrast-v4] [class*="text-zinc-100"] { color:#111827 !important; }\n';
writeFileSync(cssPath,css,"utf8");
console.log("[OK] Motorista: Settings text/icons/hero/select readable; native header respects safe area; no prefs or API logic changed.");
