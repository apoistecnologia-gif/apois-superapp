// APOIS_MOTORISTA_MENU_OVERLAY_V4
// Fullscreen native sidebar: preserve Radix focus trap, routes and modal callbacks.
import {readFileSync,writeFileSync} from "node:fs";
import {resolve} from "node:path";
const root=resolve(process.env.APOIS_MOTORISTA_WORKSPACE || ".work/partner-motorista");
const file=resolve(root,"src/components/DriverSideMenu.tsx");
const cssFile=resolve(root,"src/styles.css");
let src=readFileSync(file,"utf8");
let css=readFileSync(cssFile,"utf8");
const marker="data-apois-driver-menu-fullscreen-v4";
if(src.includes(marker)) throw Error("[FAIL] Sidebar V4 applied twice");
const before='side="left"\n        className="w-[90vw] max-w-sm';
const after='side="left"\n        '+marker+'\n        className="!z-[180] !inset-y-0 !left-0 !h-[100dvh] !w-[100vw] !max-w-none sm:!w-[420px] sm:!max-w-sm';
if(src.split(before).length!==2)throw Error("[FAIL] SideMenu drawer class anchor changed");
src=src.replace(before,after);
for(const needle of ['<SheetContent','onOpenChange={onOpenChange}','to="/motorista/perfil"','className="driver-menu-link']) {
  if(!src.includes(needle)) throw Error("[FAIL] Sidebar navigation contract: "+needle);
}
const theme=[
  "",
  "/* APOIS_MOTORISTA_MENU_OVERLAY_V4 — opaque, scrollable and modal on Android. */",
  "[data-apois-driver-menu-fullscreen-v4] {",
  "  background:#FFFFFF !important; color:#111827 !important; border-color:#E5E7EB !important;",
  "  height:100dvh !important; overscroll-behavior:contain; scrollbar-width:thin;",
  "  box-shadow:0 20px 80px rgba(0,0,0,.32) !important;",
  "}",
  "[data-apois-driver-menu-fullscreen-v4] .driver-menu-icon {",
  "  background:#FFF1F2 !important; background-image:none !important; color:#C9141B !important;",
  "  border:1px solid #FAD2D7 !important; box-shadow:none !important;",
  "}",
  "[data-apois-driver-menu-fullscreen-v4] .driver-menu-active,",
  "[data-apois-driver-menu-fullscreen-v4] .driver-menu-active .driver-menu-icon { background-image:none !important; }",
  "[data-apois-driver-menu-fullscreen-v4] .driver-menu-link {",
  "  border-color:#E5E7EB !important; background:#FFFFFF !important; background-image:none !important;",
  "}",
  "[data-apois-driver-menu-fullscreen-v4] .driver-menu-link:focus-visible { outline:2px solid #C9141B !important; outline-offset:1px; }",
  "@media (max-width:639px) {",
  "  [data-apois-driver-menu-fullscreen-v4] { width:100vw !important; max-width:100vw !important; padding-bottom:env(safe-area-inset-bottom); }",
  "}",
  "",
].join("\n");
if(css.includes("/* APOIS_MOTORISTA_MENU_OVERLAY_V4"))throw Error("[FAIL] CSS applied twice");
css+="\n"+theme;
writeFileSync(file,src,"utf8");
writeFileSync(cssFile,css,"utf8");
console.log("[OK] Motorista sidebar: fullscreen opaque on mobile; neutral home icon; original routes/modal handlers intact.");
