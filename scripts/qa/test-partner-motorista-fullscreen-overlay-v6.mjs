// Regression: Radix's backdrop must NEVER tint the fullscreen Motorista menu.
// The menu itself covers the full viewport, so the backdrop is redundant.
// Scoped to .work/partner-motorista; no mutation of dialogs used elsewhere.
import assert from "node:assert/strict";
import {readFileSync,readdirSync} from "node:fs";
import {resolve,join} from "node:path";
const root=resolve(process.env.APOIS_MOTORISTA_WORKSPACE||".work/partner-motorista");
const menu=readFileSync(resolve(root,"src/components/DriverSideMenu.tsx"),"utf8");
const sheet=readFileSync(resolve(root,"src/components/ui/sheet.tsx"),"utf8");
assert.ok(menu.includes('overlayClassName="!hidden"'),"Fullscreen menu must not paint an overlay over its own content");
assert.ok(!menu.includes('overlayClassName="!fixed !inset-0 !z-[220] !bg-[#111827]/70"'),"Dark backdrop must not return");
for(const marker of [
 'data-apois-driver-menu-fullscreen-v4',
 'data-apois-driver-menu-fixed-v5',
 'data-apois-driver-menu-scroll-v5',
 'onOpenChange={onOpenChange}',
 'onClick={() => onOpenChange(false)}',
 'openOperationalTool("status")',
 'openOperationalTool("calls")',
 'to="/motorista/perfil"',
]){
 assert.ok(menu.includes(marker),"Drawer navigation/accessibility contract changed: "+marker);
}
assert.ok(sheet.includes("<SheetOverlay className={overlayClassName} />"),"Per-dialog overlay remains configurable");
assert.ok(sheet.includes("SheetPrimitive.Content"),"Keep Radix modal/focus trap in place");
assert.ok(sheet.includes("SheetPrimitive.Close"),"Keep accessible close button");
if(process.argv.includes("--dist")){
 const dist=resolve("superapp/partner-shell/dist/modules/motorista/assets");
 const assets=readdirSync(dist);
 const js=assets.filter(f=>f.endsWith(".js")).map(f=>readFileSync(join(dist,f),"utf8")).join("\n");
 const css=assets.filter(f=>f.endsWith(".css")).map(f=>readFileSync(join(dist,f),"utf8")).join("\n");
 assert.ok(/overlayClassName\s*:\s*[`"']!hidden[`"']/.test(js),"Built Android menu does not carry hidden overlay class");
 assert.ok(css.includes(".\\!hidden{display:none!important}"),"Tailwind must emit the actual !hidden display rule");
 assert.ok(!js.includes("!bg-[#111827]/70"),"Android payload must not contain old tinted drawer overlay");
}
console.log("[PASS] Fullscreen DriverSideMenu keeps Radix dialog and navigation, but renders no dimming backdrop.");
