// APOIS_DRIVER_OFFER_RECOVERY_V2
// Android foreground can report navigator.onLine=false even while Supabase works.
// Existing V1 silently skipped its 4s offer refresh; repair the existing timer
// to query only this authenticated driver's pending offers, without FCM.
// No backend mutation, changing ride status, push secret or dispatch policy.
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const file=resolve(process.env.APOIS_MOTORISTA_WORKSPACE || ".work/partner-motorista", "src/routes/motorista.app.tsx");
let code=readFileSync(file,"utf8");
if(code.includes("APOIS_DRIVER_OFFER_RECOVERY_V2")) throw Error("[FAIL] Offer recovery V2 already applied; refusing double patch");
const before = [
'    // APOIS_DRIVER_OFFER_POLL_V1: reconsulta ofertas quando Realtime/push falham.',
'    const offerPoll = window.setInterval(() => {',
'      if (!navigator.onLine) return;',
'      if (incomingRef.current || activeRef.current || queuedRideRef.current) return;',
'      void resyncDriverRides().catch(() => undefined);',
'    }, 4_000);',
].join("\n");
const after = [
'    // APOIS_DRIVER_OFFER_RECOVERY_V2: authoritative DB fallback, independent of navigator.onLine/FCM.',
'    let offerQueryInFlight = false;',
'    const offerPoll = window.setInterval(() => {',
'      if (offerQueryInFlight || !userId || !driverId) return;',
'      if (incomingRef.current || queuedRideRef.current || ratingRef.current) return;',
'      const activeRide = activeRef.current;',
'      if (activeRide && activeRide.status !== "em_viagem") return;',
'      offerQueryInFlight = true;',
'      void (async () => {',
'        const { data, error } = await supabase',
'          .from("rides").select("*")',
'          .contains("candidate_driver_ids", [userId as string])',
'          .eq("status", "procurar_motorista")',
'          .is("driver_id", null)',
'          .order("created_at", { ascending: false })',
'          .limit(1).maybeSingle();',
'        if (error) throw error;',
'        if (data) presentOffer(data as RideRow);',
'      })().catch((error: unknown) => {',
'        console.warn("[APOIS MOTORISTA] recuperação de ofertas falhou", error instanceof Error ? error.message : "erro desconhecido");',
'      }).finally(() => { offerQueryInFlight = false; });',
'    }, 4_000);',
].join("\n");
const n=code.split(before).length-1;
if(n!==1)throw Error("[FAIL] Driver V1 offer timer anchor changed: "+n);
code=code.replace(before,after);
for(const marker of [
"APOIS_DRIVER_OFFER_RECOVERY_V2",
'window.clearInterval(offerPoll)',
'.contains("candidate_driver_ids", [userId as string])',
'.eq("status", "procurar_motorista")',
'if (data) presentOffer(data as RideRow)',
'offerQueryInFlight = false',
'if (incomingRef.current || queuedRideRef.current || ratingRef.current) return',
]) if(!code.includes(marker))throw Error("[FAIL] Driver V2 missing: "+marker);
if(code.includes("if (!navigator.onLine) return;")) throw Error("[FAIL] Driver V2 retains stale browser connectivity gate");
writeFileSync(file,code,"utf8");
console.log("[OK] APOIS Driver V2: pending offers polled every 4s independent of FCM/browser online flag, without concurrent duplicate requests.");
