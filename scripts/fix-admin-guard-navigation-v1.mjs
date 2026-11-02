import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
// Admin Vercel QA only. Do NOT touch the pinned Motorista/Entregador sources.
const path = resolve(".work/partner-motorista/src/components/AdminGuard.tsx");
let s = readFileSync(path,"utf8");
function one(from,to,label){
 const count=s.split(from).length-1;
 if(count!==1)throw Error("[FAIL] Admin guard "+label+" occurrences="+count);
 s=s.replace(from,to);
}
if(s.includes("APOIS_ADMIN_GUARD_NAV_CACHE_V1"))throw Error("[FAIL] Guard patch already applied");
one('import { loadAdminAccess } from "@/lib/adminAccess";',
  'import { loadAdminAccess } from "@/lib/adminAccess";',
  "access import");
const cacheBlock = [
  '// APOIS_ADMIN_GUARD_NAV_CACHE_V1: reuse a freshly authorized session only during',
  '// same-tab navigation, while revalidating with Supabase on every route change.',
  '// Server/RLS remains authoritative; no privilege is introduced or stored locally.',
  'type NavigationGrant = { userId: string; permissions: string[]; checkedAt: number };',
  'let navigationGrant: NavigationGrant | null = null;',
  'const NAV_GRANT_TTL_MS = 12_000;',
  'function routeGrantState(path: string): State {',
  '  const grant = navigationGrant;',
  '  if (!grant || Date.now() - grant.checkedAt > NAV_GRANT_TTL_MS) return "loading";',
  '  const allowed = ADMIN_NAV.find((item) => path === item.to || path.startsWith(item.to + "/"));',
  '  return allowed && grant.permissions.includes(allowed.permission) ? "ok" : "no-permission";',
  '}',
  ''
].join("\n");
one('export function AdminGuard({ children }: { children: ReactNode }) {',
  cacheBlock+'export function AdminGuard({ children }: { children: ReactNode }) {',
  "navigation grant declaration");
one('const [state, setState] = useState<State>("loading");',
  'const [state, setState] = useState<State>(() => routeGrantState(pathname));',
  "initial route guard");
one('    setState("loading");\n    setFallbackRoute(null);',
  '    setState(routeGrantState(pathname));\n    setFallbackRoute(null);',
  "navigation loading");
one('        if (!sessionData.session) {\n          setState("no-session");',
  '        if (!sessionData.session) {\n          navigationGrant = null;\n          setState("no-session");',
  "signed out");
one('        const access = await loadAdminAccess();',
  '        if (navigationGrant && navigationGrant.userId !== sessionData.session.user.id) {\n' +
  '          navigationGrant = null;\n' +
  '          setState("loading");\n' +
  '        }\n' +
  '        const access = await loadAdminAccess();',
  "session user id verification");
one('        if (!access?.authorized) {\n          setState("no-admin");',
  '        if (!access?.authorized) {\n          navigationGrant = null;\n          setState("no-admin");',
  "unauthorized grant eviction");
one('        const permissionSet = new Set((access.permissions ?? []).filter(Boolean));',
  '        navigationGrant = { userId: sessionData.session.user.id, permissions: access.permissions ?? [], checkedAt: Date.now() };\n' +
  '        const permissionSet = new Set((access.permissions ?? []).filter(Boolean));',
  "grant refresh");
one('        setState("error");\n        if (import.meta.env.DEV)',
  '        navigationGrant = null;\n        setState("error");\n        if (import.meta.env.DEV)',
  "error fails closed");
one('      if (event === "SIGNED_OUT" || !session) {\n        requestRef.current += 1;',
  '      if (event === "SIGNED_OUT" || !session) {\n        navigationGrant = null;\n        requestRef.current += 1;',
  "logout cache clear");
one('      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "USER_UPDATED") {\n        setRetryNonce',
  '      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "USER_UPDATED") {\n        if (navigationGrant && navigationGrant.userId !== session.user.id) navigationGrant = null;\n        setRetryNonce',
  "session change cache clear");
one('  return <>{children}</>;', '  return <><span hidden aria-hidden="true" data-apois-admin-guard-cache-v1 />{children}</>;', "stable QA-only bundle marker");
if(!s.includes("NAV_GRANT_TTL_MS = 12_000")||!s.includes('navigationGrant = null;'))throw Error("[FAIL] Admin nav auth cache missing");
writeFileSync(path,s,"utf8");
console.log("[OK] Corridas Admin QA route transitions reuse short validated access; Supabase RBAC reverified on every route and cache purged on auth changes.");
