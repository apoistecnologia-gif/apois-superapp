// TanStack patched Router error contract for the isolated Entregador workspace.
import {readFileSync,writeFileSync} from "node:fs";
import {resolve} from "node:path";
const path=resolve(".","src/routes/__root.tsx");let s=readFileSync(path,"utf8");
if(!s.includes("APOIS_ENTREGAS_TANSTACK_ERROR_UNKNOWN_V1")){
 const before="function ErrorComponent({ error, reset }: { error: Error; reset: () => void })";
 const report='reportLovableError(error, { boundary: "tanstack_root_error_component" });';
 if(!s.includes(before)||!s.includes(report))throw Error("[FAIL] Entregador error boundary contract moved");
 s=s.replace(before,"function ErrorComponent({ error, reset }: { error: unknown; reset: () => void })");
 s=s.replace(report,'reportLovableError(error instanceof Error ? error : new Error(String(error)), { boundary: "tanstack_root_error_component" });');
 writeFileSync(path,"// APOIS_ENTREGAS_TANSTACK_ERROR_UNKNOWN_V1\n"+s,"utf8");
}
console.log("[OK] Entregador patched TanStack Router ErrorComponentProps compatibility.");
