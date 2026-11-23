// APOIS_PASSENGER_AUDIT_GPS_WATCH_20261123
// Run after the visual/map byte-integrity guard, BEFORE the intentional post-visual
// Maps/GPS snapshot. Do not apply late: the build verifies these files byte-for-byte.
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const path = resolve(process.env.APOIS_CORRIDAS_WORKSPACE || ".work/corridas", "src/hooks/use-location.tsx");
const marker = "APOIS_PASSENGER_AUDIT_GPS_WATCH_20261123";
let source = readFileSync(path, "utf8");

function replaceOnce(from, to, label) {
  const matches = source.split(from).length - 1;
  if (matches !== 1) throw new Error("[FAIL] GPS watcher " + label + ": anchors=" + matches);
  source = source.replace(from, to);
}

if (!source.includes(marker)) {
  replaceOnce(
    "  useEffect(() => {\n    mountedRef.current = true;",
    "  useEffect(() => {\n    // " + marker + "\n    let disposed = false;\n    mountedRef.current = true;",
    "dispose flag");
  replaceOnce(
    "watchIdRef.current = await Geolocation.watchPosition(",
    "const pendingWatchId = await Geolocation.watchPosition(",
    "pending registration");
  replaceOnce(
    "        );\n      } catch (watchError) {",
    '        );\n        if (disposed) {\n          await Geolocation.clearWatch({ id: pendingWatchId });\n        } else {\n          watchIdRef.current = pendingWatchId;\n        }\n      } catch (watchError) {',
    "late watcher cleanup");
  replaceOnce(
    "    return () => {\n      mountedRef.current = false;",
    "    return () => {\n      disposed = true;\n      mountedRef.current = false;",
    "on-unmount cleanup");
  writeFileSync(path, source, "utf8");
}
for (const token of [marker, "const pendingWatchId = await Geolocation.watchPosition(", "disposed = true;", "await Geolocation.clearWatch({ id: pendingWatchId });"]) {
  if (!source.includes(token)) throw new Error("[FAIL] GPS watcher missing " + token);
}
console.log("[OK] Passageiro: GPS watcher cleans up even when registered after component unmount.");
