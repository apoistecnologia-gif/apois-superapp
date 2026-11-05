// APOIS_DRIVER_DRAWER_PROFILE_V5 — scoped UI patch in isolated workspace.
import {readFileSync,writeFileSync} from "node:fs";
import {resolve} from "node:path";
const root=resolve(process.env.APOIS_MOTORISTA_WORKSPACE||".work/partner-motorista");
const get=(p)=>readFileSync(resolve(root,p),"utf8");
const save=(p,s)=>writeFileSync(resolve(root,p),s,"utf8");
function one(s,a,b,label){let n=s.split(a).length-1;if(n!==1)throw Error("[FAIL] Driver V5 "+label+" count="+n);return s.replace(a,b)}
{
const p="src/components/ui/sheet.tsx";let s=get(p);
s=one(s,'  SheetContentProps {}','  SheetContentProps { overlayClassName?: string }',"scoped Sheet overlay prop");
s=one(s,'({ side = "right", className, children, ...props }, ref) => (','({ side = "right", className, children, overlayClassName, ...props }, ref) => (',"Sheet props");
s=one(s,'    <SheetOverlay />\n    <SheetPrimitive.Content','    <SheetOverlay className={overlayClassName} />\n    <SheetPrimitive.Content',"specific overlay");
save(p,s);
}
{
const p="src/components/DriverSideMenu.tsx";let s=get(p);
for(const marker of ['data-apois-driver-menu-fullscreen-v4','data-apois-driver-sidebar-tools-v1','onClick={() => openOperationalTool("status")}','onClick={() => openOperationalTool("calls")}','data-apois-driver-sidebar-profile-v3'])
 if(!s.includes(marker))throw Error("[FAIL] Missing pre-existing menu behavior "+marker);
s=one(s,'        side="left"\n        data-apois-driver-menu-fullscreen-v4',
 '        side="left"\n        overlayClassName="!fixed !inset-0 !z-[220] !bg-[#111827]/70"\n        data-apois-driver-menu-fullscreen-v4 data-apois-driver-menu-fixed-v5',"full backdrop");
s=one(s,'<SheetHeader className="','<SheetHeader data-apois-driver-menu-header-v5 className="',"header marker");
s=one(s,'<div className="space-y-5 px-4 pb-[calc(env(safe-area-inset-bottom)+20px)] pt-5">',
 '<div data-apois-driver-menu-scroll-v5 className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-4 pt-5 pb-[max(84px,calc(env(safe-area-inset-bottom)+24px))]">',"drawer own scroll");
save(p,s);
}
{
const p="src/components/profile/ProfileForm.tsx";let s=get(p);
s=one(s,'  onLoaded?: (ctx: { userId: string }) => void;',
 '  onLoaded?: (ctx: { userId: string }) => void;\n  onBackToHub?: () => void;',"optional back");
s=one(s,'  role, title, description, headerSlot, extraSlot, onLoaded,',
 '  role, title, description, headerSlot, extraSlot, onLoaded, onBackToHub,',"back handler");
s=one(s,'  Loader2, Save, Lock, MailCheck, ShieldAlert, Trash2, BadgeCheck, X,',
 '  ArrowLeft, Loader2, Save, Lock, MailCheck, ShieldAlert, Trash2, BadgeCheck, X,',"back icon");
s=one(s,'    <div className="flex min-h-dvh flex-col bg-background">\n      <MovviHeader logoutRedirect="/" />\n      <main className="flex-1 px-4 py-6 pb-28"',
 '    <div data-apois-driver-profile-edit-v5={role === "driver" ? "true" : undefined} className={role === "driver" ? "flex min-h-dvh flex-col bg-[#F7F7F8] text-[#111827]" : "flex min-h-dvh flex-col bg-background"}>\n      <MovviHeader logoutRedirect="/" />\n      {role === "driver" && onBackToHub ? (\n        <div className="mx-auto w-full max-w-2xl px-4 pt-4">\n          <button type="button" onClick={onBackToHub} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#D9DEE6] bg-white px-4 text-sm font-semibold text-[#111827] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9141B]">\n            <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Voltar ao perfil\n          </button>\n        </div>\n      ) : null}\n      <main className="flex-1 px-4 py-6 pb-28"',"inline back and scope");
for(const m of ['rpc("update_own_profile"','onSubmit={onSave}','rpc("request_own_account_deletion"'])if(!s.includes(m))throw Error("[FAIL] Profile persistence lost "+m);
save(p,s);
}
{
const p="src/routes/motorista.perfil.tsx";let s=get(p);
const start=s.indexOf('  if (mode === "edit") {'),end=s.indexOf('  if (loading && !driver)',start);
if(start<0||end<start)throw Error("[FAIL] Driver edit state not found");
let part=s.slice(start,end);
const btnStart=part.indexOf('        <div className="fixed left-3 z-40"');
const btnEnd=part.indexOf('        <ProfileForm',btnStart);
if(btnStart<0||btnEnd<btnStart)throw Error("[FAIL] Floating back button changed");
const old=part.slice(btnStart,btnEnd);
if(!old.includes('onClick={() => setMode("hub")}')||!old.includes('Voltar'))throw Error("[FAIL] Original profile back action lost");
part=part.slice(0,btnStart)+part.slice(btnEnd);
part=one(part,'          role="driver"\n','          role="driver"\n          onBackToHub={() => setMode("hub")}\n',"back handler pass");
part=one(part,'<div className="relative min-h-dvh bg-background">','<div className="relative min-h-dvh bg-[#F7F7F8] text-[#111827]">',"edit wrapper");
s=s.slice(0,start)+part+s.slice(end);
if(s.includes('className="fixed left-3 z-40"'))throw Error("[FAIL] Fixed back remains");
save(p,s);
}
{
const p="src/styles.css";let s=get(p);
const css=readFileSync(resolve("scripts/qa/driver-menu-profile-v5.css"),"utf8");
if(s.includes("/* APOIS_DRIVER_DRAWER_PROFILE_V5 */"))throw Error("[FAIL] CSS applied twice");
s+="\n"+css;
save(p,s);
}
console.log("[OK] Driver V5 full-height opaque Radix menu & internal scroll; profile contrast and inline back; driver RPCs preserved.");
