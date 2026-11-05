import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
const root=resolve(process.env.APOIS_MOTORISTA_WORKSPACE||".work/partner-motorista");
const file=resolve(root,"src/lib/driverRoutes.mobile.ts");
let s=readFileSync(file,"utf8");
if(s.includes("APOIS_DRIVER_ROUTE_AUTH_V1"))throw Error("[FAIL] Route auth already applied");
const start=s.indexOf("  const { data: result, error } = await supabase.functions.invoke<DriverRouteResponse>(");
const end=s.indexOf("  const distanceMeters = Number(result.distanceMeters);",start);
if(start<0||end<start||end-start>1000)throw Error("[FAIL] Route invocation contract changed");
const old=s.slice(start,end);
for(const marker of ['"passenger-routes-compute"',"body: {","if (error || !result?.ok || !result.encodedPolyline)"])
  if(!old.includes(marker))throw Error("[FAIL] Original route flow missing "+marker);
const next="  // APOIS_DRIVER_ROUTE_AUTH_V1: use the authenticated driver's current token.\n  // Retry exactly once after HTTP 401. No anonymous routing or provider changes.\n  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();\n  const initialToken = sessionData.session?.access_token;\n  if (sessionError || !initialToken) {\n    throw new Error(\"Sua sessão de navegação expirou. Entre novamente para calcular a rota.\");\n  }\n  const invokeRoute = (jwt: string) => supabase.functions.invoke<DriverRouteResponse>(\n    \"passenger-routes-compute\", {\n      headers: { Authorization: \"Bearer \" + jwt },\n      body: { origin, destination, stops },\n    },\n  );\n  const isHttp401 = (e: unknown): boolean =>\n    Boolean(e && typeof e === \"object\" &&\n      Number((e as {context?: {status?: number}}).context?.status ?? 0) === 401);\n  let call = await invokeRoute(initialToken);\n  if (isHttp401(call.error)) {\n    const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();\n    if (!refreshError && refreshed.session?.access_token) {\n      call = await invokeRoute(refreshed.session.access_token);\n    }\n  }\n  const { data: result, error } = call;\n  if (isHttp401(error)) {\n    throw new Error(\"Não foi possível autenticar o cálculo da rota. Entre novamente na sua conta.\");\n  }\n  if (error || !result?.ok || !result.encodedPolyline) {\n    throw new Error(routeErrorMessage(error ?? new Error(\"route_not_found\")));\n  }\n\n";
s=s.slice(0,start)+next+s.slice(end);
for(const token of ["APOIS_DRIVER_ROUTE_AUTH_V1","supabase.auth.getSession()","supabase.auth.refreshSession()",'headers: { Authorization: "Bearer " + jwt }',"call = await invokeRoute(refreshed.session.access_token);","return {","encodedPolyline: result.encodedPolyline"])
  if(!s.includes(token))throw Error("[FAIL] Route-auth contract missing "+token);
writeFileSync(file,s,"utf8");
console.log("[OK] Driver route JWT: current auth token and one 401 retry; original geometry/provider intact.");
