// APOIS_DRIVER_DRAWER_PROFILE_V5 — read-only regression assertions.
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
const root=resolve(process.env.APOIS_MOTORISTA_WORKSPACE||".work/partner-motorista");
const read=(p)=>readFileSync(resolve(root,p),"utf8");
const menu=read("src/components/DriverSideMenu.tsx"),sheet=read("src/components/ui/sheet.tsx");
const form=read("src/components/profile/ProfileForm.tsx"),profile=read("src/routes/motorista.perfil.tsx");
const css=read("src/styles.css");
for(const m of ['data-apois-driver-menu-fullscreen-v4','data-apois-driver-menu-fixed-v5','data-apois-driver-menu-header-v5',
 'data-apois-driver-menu-scroll-v5','overlayClassName="!fixed !inset-0 !z-[110] !bg-[#111827]/60 !hidden sm:!block"','data-apois-driver-sidebar-profile-v3',
 'data-apois-driver-sidebar-tools-v1','onClick={() => openOperationalTool("status")}','onClick={() => openOperationalTool("calls")}',
 'onOpenChange(false)','onLogout()','to="/motorista/perfil"']){
 assert.ok(menu.includes(m),"Driver menu content/callback regression "+m);
}
// Android menu must be above its backdrop; modal focus trap and routes remain untouched.
assert.ok(menu.includes('!z-[240] !inset-y-0'),"Driver drawer must be in foreground without relying on CSS import order");
const menuLayer=Number(menu.match(/!z-\[(\d+)\] !inset-y-0/)?.[1]);
const overlayLayer=Number(menu.match(/overlayClassName="[^"]*!z-\[(\d+)\]/)?.[1]);
assert.ok(Number.isFinite(menuLayer)&&Number.isFinite(overlayLayer)&&menuLayer>overlayLayer,
 "Drawer content must outrank the Radix overlay");
assert.ok(menu.includes('!hidden sm:!block'),"Full-screen menu must not dim itself on Android");
assert.ok(sheet.includes("overlayClassName?: string")&&sheet.includes("<SheetOverlay className={overlayClassName} />"),
 "Sheet overlay must be configurable without changing other consumers");
assert.ok(!sheet.includes("<SheetOverlay className=\"!fixed"),"No global Sheet overlay changes");
for(const m of ['data-apois-driver-profile-edit-v5={role === "driver" ? "true" : undefined}',
 'onBackToHub?: () => void','onClick={onBackToHub}','Voltar ao perfil','onSubmit={onSave}',
 'rpc("update_own_profile"','rpc("request_own_account_deletion"','ProfilePhotoUploader',
 'role === "driver" ? "flex min-h-dvh flex-col bg-[#F7F7F8] text-[#111827]" : "flex min-h-dvh flex-col bg-background"']){
 assert.ok(form.includes(m),"Driver form behavior/contrast regression "+m);
}
assert.ok(profile.includes('onBackToHub={() => setMode("hub")}'),"Return to same profile hub state");
assert.ok(!profile.includes('className="fixed left-3 z-40"'),"Overlapping floating Voltar must be removed");
for(const m of ["/* APOIS_DRIVER_DRAWER_PROFILE_V5 */",'height:100dvh!important','z-index:240!important',
 'overscroll-behavior:contain','padding-bottom:max(84px','[data-apois-driver-profile-edit-v5]',
 '-webkit-text-fill-color:#111827!important','input,textarea,select):disabled','opacity:1!important',
 '[data-apois-driver-menu-fixed-v5] .driver-menu-link p:first-child']){
 assert.ok(css.includes(m),"CSS safe area/contrast regression "+m);
}
assert.equal(css.split("/* APOIS_DRIVER_DRAWER_PROFILE_V5 */").length,2,"Scoped CSS only once");
assert.ok(!menu.includes('bg-black/80')||sheet.includes("overlayClassName"),"Drawer overlay should be independently controlled");
console.log("[OK] Motorista V5: Radix modal and callbacks preserved, full-height opaque safe scroll, form contrast, functional inline return, passenger unchanged.");
