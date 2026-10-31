// Safe compatibility for Router 1.170.41 error boundary type changes.
// Isolated QA workspace only; React behavior unchanged.
import {readFileSync,writeFileSync,existsSync} from "node:fs";
import {resolve} from "node:path";
const root=existsSync("src/components/routing/DefaultBoundaries.tsx") ? resolve(".") : resolve(".work/partner-motorista");
const files=[
 {path:"src/components/routing/DefaultBoundaries.tsx",original:"  error: Error;\n  reset: () => void;",replacement:"  error: unknown;\n  reset: () => void;",report:'reportLovableError(error, { boundary: "tanstack_default_error_component" });'},
 {path:"src/routes/__root.tsx",original:"function ErrorComponent({ error, reset }: { error: Error; reset: () => void })",replacement:"function ErrorComponent({ error, reset }: { error: unknown; reset: () => void })",report:'reportLovableError(error, { boundary: "tanstack_root_error_component" });'}
];
for(const {path,original,replacement,report} of files){
 const full=resolve(root,path);let s=readFileSync(full,"utf8");
 if(s.includes("APOIS_TANSTACK_ERROR_UNKNOWN_V1"))continue;
 if(!s.includes(original)||!s.includes(report))throw Error("[FAIL] TanStack error component moved "+path);
 s=s.replace(original,replacement);
 s=s.replace(report,report.replace("reportLovableError(error,","reportLovableError(error instanceof Error ? error : new Error(String(error)),"));
 s="// APOIS_TANSTACK_ERROR_UNKNOWN_V1: preserve error boundary behavior under patched Router.\n"+s;
 writeFileSync(full,s,"utf8");
 console.log("[OK] TanStack error unknown adapter: "+path);
}
