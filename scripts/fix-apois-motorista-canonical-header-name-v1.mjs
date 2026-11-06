// APOIS_DRIVER_CANONICAL_HEADER_NAME_V1 — source-only, Motorista-scoped.
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
const path=resolve(process.env.APOIS_MOTORISTA_WORKSPACE||".work/partner-motorista","src/components/MovviHeader.tsx");
let s=readFileSync(path,"utf8");
if(!s.includes("APOIS_DRIVER_CANONICAL_HEADER_NAME_V1")){
  const before='import { Link, useNavigate, useRouter } from "@tanstack/react-router";';
  if(s.split(before).length!==2)throw Error("[FAIL] header router import changed");
  s=s.replace(before,'import { Link, useNavigate, useRouter, useRouterState } from "@tanstack/react-router";');
  const routerAnchor='  const router = useRouter();';
  if(s.split(routerAnchor).length!==2)throw Error("[FAIL] header hook anchor changed");
  s=s.replace(routerAnchor,routerAnchor+'\n  const isDriverRoute = useRouterState({ select: (state) => state.location.pathname.startsWith("/motorista/") });');
  const mounted='  const mountedRef = useRef(true);';
  if(s.split(mounted).length!==2)throw Error("[FAIL] header ref anchor changed");
  s=s.replace(mounted,mounted+'\n  const nameSequenceRef = useRef(0);');
  const start=s.indexOf('  useEffect(() => {\n    mountedRef.current = true;');
  const end=s.indexOf('  async function handleLogout() {',start);
  if(start<0||end<start||end-start>2700)throw Error("[FAIL] auth name effect changed");
  const old=s.slice(start,end);
  for(const marker of ["supabase.auth.getUser()","supabase.auth.onAuthStateChange","displayNameFromUser"])if(!old.includes(marker))throw Error("[FAIL] original identity logic missing "+marker);
  const effect=[
    '  // APOIS_DRIVER_CANONICAL_HEADER_NAME_V1',
    '  useEffect(() => {',
    '    mountedRef.current = true;',
    '    let cancelled = false;',
    '    const loadName = async (user: Parameters<typeof displayNameFromUser>[0]) => {',
    '      const request = ++nameSequenceRef.current;',
    '      if (!user) { if (!cancelled && mountedRef.current) setName(""); return; }',
    '      const fallback = displayNameFromUser(user);',
    '      if (!isDriverRoute) { if (!cancelled && mountedRef.current) setName(fallback); return; }',
    '      // A foto e o nome da conta Google nao sao o cadastro operacional do motorista.',
    '      if (!cancelled && mountedRef.current) setName("");',
    '      try {',
    '        const { data: driver, error } = await (supabase as any).rpc("driver_get_profile");',
    '        const canonical = !error && driver && typeof driver.name === "string" ? driver.name.trim() : "";',
    '        if (!cancelled && mountedRef.current && request === nameSequenceRef.current) setName(canonical || fallback);',
    '      } catch {',
    '        if (!cancelled && mountedRef.current && request === nameSequenceRef.current) setName(fallback);',
    '      }',
    '    };',
    '    void supabase.auth.getUser().then(({ data, error }) => {',
    '      if (cancelled || !mountedRef.current) return;',
    '      if (error) { setName(""); return; }',
    '      void loadName(data.user);',
    '    }).catch(() => { if (!cancelled && mountedRef.current) setName(""); });',
    '    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {',
    '      if (cancelled || !mountedRef.current) return;',
    '      if (session?.user) setLogoutError(null);',
    '      // Adiar RPC para fora do callback da auth, evitando trava de sessao.',
    '      queueMicrotask(() => { if (!cancelled && mountedRef.current) void loadName(session?.user); });',
    '    });',
    '    return () => {',
    '      cancelled = true;',
    '      nameSequenceRef.current += 1;',
    '      mountedRef.current = false;',
    '      subscription.subscription.unsubscribe();',
    '    };',
    '  }, [isDriverRoute]);',
    ''
  ].join("\n");
  s=s.slice(0,start)+effect+s.slice(end);
  writeFileSync(path,s,"utf8");
}
for(const marker of [
  "APOIS_DRIVER_CANONICAL_HEADER_NAME_V1",
  "state.location.pathname.startsWith",
  'rpc("driver_get_profile")',
  "queueMicrotask", "request === nameSequenceRef.current",
])if(!s.includes(marker))throw Error("[FAIL] driver canonical name "+marker);
console.log("[OK] Motorista headers use canonical driver profile name; other roles keep auth label.");
