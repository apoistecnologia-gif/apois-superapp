import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(process.env.APOIS_MOTORISTA_WORKSPACE || ".work/partner-motorista");
const file = resolve(root,"src/components/MovviMap.tsx");
if(!existsSync(file))throw Error("[FAIL] Source of Motorista map is missing");
const original = readFileSync(file,"utf8");
let source=original;

function exact(before,after,label){
 if(source.includes(after))return;
 if(!source.includes(before))throw Error("[FAIL] Motorista map changed: "+label);
 source=source.replace(before,after);
}

// The old driver-only fallback disabled the official visual style by passing
// styles=[]. The client reference instead uses neutral land, legible roads and
// dark-navy waterways. Restore the existing validated APOIS palette while
// keeping the current zoom, GPS, routes, directions and native integration.
exact(
 'const styles = useMemo(() => isDriverRole ? [] : getMapStyleForTheme(theme), [isDriverRole,theme]);',
 'const styles = useMemo(() => isDriverRole ? getMapStyleForTheme("light") : getMapStyleForTheme(theme), [isDriverRole,theme]);',
 'restore shared client palette'
);
exact(
 'const bgColor = useMemo(() => isDriverRole ? "#F8F9FA" : getMapBackgroundForTheme(theme), [isDriverRole,theme]);',
 'const bgColor = useMemo(() => isDriverRole ? getMapBackgroundForTheme("light") : getMapBackgroundForTheme(theme), [isDriverRole,theme]);',
 'restore client land tone'
);
const marker='// APOIS_MOTORISTA_CLIENT_MAP_STYLE_V1';
if(!source.includes(marker))source=source.replace(
 'const styles = useMemo(() => isDriverRole ? getMapStyleForTheme("light") : getMapStyleForTheme(theme), [isDriverRole,theme]);',
 marker+'\n  const styles = useMemo(() => isDriverRole ? getMapStyleForTheme("light") : getMapStyleForTheme(theme), [isDriverRole,theme]);'
);
for (const check of [marker,'getMapStyleForTheme("light")','getMapBackgroundForTheme("light")','clickableIcons: isDriverRole']) {
 if(!source.includes(check))throw Error("[FAIL] Map/client style verification: "+check);
}
if(source!==original)writeFileSync(file,source,"utf8");
console.log("[OK] Motorista uses the same APOIS map palette as the passenger; location and navigation remain untouched");
