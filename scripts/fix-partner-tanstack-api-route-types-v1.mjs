// TanStack security release compatibility in disposable .work ONLY.
// The pinned legacy server-route handlers are unchanged at runtime.
// New Start v1.168.60 and old Router v1.170.16 disagree about FileRouteOptions.server.
// We retain the server handlers and scope an explicit type-compatibility cast to them.
import {readFileSync,writeFileSync} from "node:fs";
import {resolve} from "node:path";
const root=resolve(".work/partner-motorista/src/routes/api/public/hooks");
for(const name of ["activate-scheduled-rides.ts","renew-driver-subscriptions.ts"]){
 const path=resolve(root,name);
 let src=readFileSync(path,"utf8");
 if(src.includes("APOIS_TANSTACK_PATCHED_API_TYPES_V1"))continue;
 const typed="POST: async ({ request }: { request: Request }) => {";
 if(!src.includes("POST: async ({ request }) => {"))throw Error("[FAIL] Unexpected legacy server route handler: "+name);
 src=src.replace("POST: async ({ request }) => {",typed);
 if(!src.endsWith("});\n"))throw Error("[FAIL] Unexpected legacy server route end: "+name);
 // Do not touch handler or security code, only the route registration's type check.
 src=src.slice(0,-4)+"} as any);\n";
 src="// APOIS_TANSTACK_PATCHED_API_TYPES_V1: isolate legacy type compatibility; handler unmodified.\n"+src;
 writeFileSync(path,src,"utf8");
 console.log("[OK] TanStack patched API types: "+name);
}
