// APOIS_DRIVER_OFFER_WATCHDOG_V3 — independent offline-safe read-only polling.
// Keep existing offer eligibility guards, RLS, acceptance, subscription and maps.
import {readFileSync,writeFileSync} from "node:fs";
import {resolve} from "node:path";
const file=resolve(process.env.APOIS_MOTORISTA_WORKSPACE||".work/partner-motorista","src/routes/motorista.app.tsx");
let src=readFileSync(file,"utf8");
function once(before,after,label){const n=src.split(before).length-1;if(n!==1)throw Error("[FAIL] Driver V3 "+label+": "+n);src=src.replace(before,after);}
if(src.includes("APOIS_DRIVER_OFFER_WATCHDOG_V3"))throw Error("[FAIL] V3 applied twice");
once("  const incomingRef = useRef<RideRow | null>(null);",
  "  const incomingRef = useRef<RideRow | null>(null);\n  // APOIS_DRIVER_OFFER_WATCHDOG_V3\n  const offerPresenterRef = useRef<((ride: RideRow) => void) | null>(null);",
  "presenter ref");
once("    const applyActive = (r: RideRow) => {",
  "    offerPresenterRef.current = presentOffer;\n    const applyActive = (r: RideRow) => {",
  "reuse original strict presenter");
once("    return () => {\n      supabase.removeChannel(ch);",
  "    return () => {\n      offerPresenterRef.current = null;\n      supabase.removeChannel(ch);",
  "cleanup");
const effect = [
'  // Independently check offers while online. Realtime/push may not wake Android WebView.',
'  // Reuses presentOffer for category, expiration, rejection, active-ride guards.',
'  useEffect(() => {',
'    if (!online || !userId || !driverId) return;',
'    let cancelled = false;',
'    let busy = false;',
'    let failures = 0;',
'    const check = async () => {',
'      if (cancelled || busy || !offerPresenterRef.current) return;',
'      if (incomingRef.current || ratingRef.current || queuedRideRef.current) return;',
'      if (activeRef.current && activeRef.current.status !== "em_viagem") return;',
'      busy = true;',
'      try {',
'        const { data, error } = await supabase.from("rides").select("*")',
'          .contains("candidate_driver_ids", [userId])',
'          .eq("status", "procurar_motorista")',
'          .is("driver_id", null)',
'          .order("created_at", { ascending: false })',
'          .limit(1).maybeSingle();',
'        if (error) throw error;',
'        failures = 0;',
'        if (!cancelled && data) offerPresenterRef.current?.(data as RideRow);',
'      } catch (error) {',
'        failures += 1;',
'        console.warn("[APOIS DRIVER] failed to retrieve candidate offers", error instanceof Error ? error.message : "unknown");',
'        if (!cancelled && failures === 2) toast.error("Falha ao consultar novas corridas.", {',
'          description: "Verifique sua conexão ou sessão e reabra a tela do motorista.",',
'        });',
'      } finally { busy = false; }',
'    };',
'    void check();',
'    const watchdog = window.setInterval(() => { void check(); }, 3500);',
'    return () => { cancelled = true; window.clearInterval(watchdog); };',
'  }, [online, userId, driverId]);',
'',
].join("\n");
once("  // carrega dados do passageiro",effect+"  // carrega dados do passageiro","watchdog insertion");
for(const t of ["APOIS_DRIVER_OFFER_WATCHDOG_V3",'offerPresenterRef.current = presentOffer','offerPresenterRef.current = null','window.setInterval(() => { void check(); }, 3500)','window.clearInterval(watchdog)','setIncoming(r);','contains("candidate_driver_ids", [userId])'])if(!src.includes(t))throw Error("[FAIL] Driver watchdog marker missing "+t);
writeFileSync(file,src,"utf8");
console.log("[OK] APOIS Motorista: independent 3.5s candidate polling with strict original offer presenter and cancellation on unmount.");
