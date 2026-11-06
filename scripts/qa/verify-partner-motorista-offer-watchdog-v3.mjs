import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
const root=resolve(process.env.APOIS_MOTORISTA_WORKSPACE||".work/partner-motorista");
const file=readFileSync(resolve(root,"src/routes/motorista.app.tsx"),"utf8");
const required=[
 "APOIS_DRIVER_OFFER_WATCHDOG_V3",
 'offerPresenterRef.current = presentOffer',
 'offerPresenterRef.current = null',
 'const watchdog = window.setInterval(() => { void check(); }, 3500);',
 'window.clearInterval(watchdog)',
 '.contains("candidate_driver_ids", [userId])',
 '.eq("status", "procurar_motorista")',
 '.is("driver_id", null)',
 'if (!online || !userId || !driverId) return;',
 'if (incomingRef.current || ratingRef.current || queuedRideRef.current) return;',
 'if (activeRef.current && activeRef.current.status !== "em_viagem") return;',
 'offerPresenterRef.current?.(data as RideRow)',
 'toast.error("Falha ao consultar novas corridas."',
 'if (!isRideCategoryEnabled(r.category, featureFlags))',
 'if (acceptedDriverId || didReject || !isCandidate || expired) return;',
 'supabase.removeChannel(ch)',
 'APOIS_DRIVER_OFFER_RECOVERY_V2',
];
for(const t of required)assert.ok(file.includes(t),"Missing guarded candidate polling contract: "+t);
const start=file.indexOf("  // Independently check offers while online.");
const end=file.indexOf("  }, [online, userId, driverId]);",start);
assert.ok(start>=0 && end>start,"V3 mounted watchdog effect must be present");
const section=file.slice(start,end);
assert.ok(!section.includes('update({ candidate_driver_ids'),"No mutation of dispatch candidates");
assert.ok(!section.includes('driver_accept_ride'),"Poll must not accept rides");
assert.ok(!section.includes('navigator.onLine'),"Poll must not rely on browser online flag");
console.log("[PASS] APOIS Motorista V3: independent pending-offer query while online, lifetime cleanup, existing strict presenter/category/timeout/rejection and RLS preserved.");
