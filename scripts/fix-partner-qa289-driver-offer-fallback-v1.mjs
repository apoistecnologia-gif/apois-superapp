/**
 * APOIS_PARTNER_QA289_DRIVER_OFFER_VISIBLE_FALLBACK_V1
 *
 * Physical Android QA: dispatch candidate ids included the ONLINE driver,
 * but 'rides' is NOT published on supabase_realtime. Existing postgres_changes
 * subscription cannot deliver an offer; existing 8-second poll handles only
 * accepted/queued rides. This applies a read-only ONLINE+visible fallback.
 *
 * No database schema, auth, dispatch, PIN, wallet, or payment writes.
 */
import {readFileSync,writeFileSync} from "node:fs";
import {resolve} from "node:path";
const file=resolve(".work/partner-motorista/src/routes/motorista.app.tsx");
let source=readFileSync(file,"utf8");
const marker="APOIS_PARTNER_QA289_DRIVER_OFFER_VISIBLE_FALLBACK_V1";
if(source.includes(marker))throw Error("[FAIL] QA289 already applied");
function once(before,after,label){
 const n=source.split(before).length-1;
 if(n!==1)throw Error("[FAIL] QA289 "+label+" expected one anchor, found "+n);
 source=source.replace(before,after);
}
for(const required of [
 'const presentOffer = (r: RideRow) => {',
 'const resyncDriverRides = async () => {',
 '.contains("candidate_driver_ids", [userId as string])',
 '      setIncoming(r);',
 'const poll = window.setInterval(async () => {',
 '      window.clearInterval(poll);',
 '  }, [userId, driverId, loadTodayStats, featureFlags]);',
 'startRideRingtone();',
 'stopRideRingtone();',
 'const RIDE_OFFER_TIMEOUT_SECONDS = 60;'
])if(!source.includes(required))throw Error("[FAIL] QA289 existing module feature missing: "+required);
const fallback = "\n    // APOIS_PARTNER_QA289_DRIVER_OFFER_VISIBLE_FALLBACK_V1\n    // Realtime postgres_changes is unavailable until 'rides' is published.\n    // Foreground-only read fallback; no presence or dispatch writes here.\n    let qa289OfferPollClosed = false;\n    let qa289OfferPollInFlight = false;\n    const qa289OfferPoll = window.setInterval(async () => {\n      if (qa289OfferPollClosed ||\n          !online || !driverId ||\n          document.visibilityState !== \"visible\" ||\n          ratingRef.current || incomingRef.current || queuedRideRef.current ||\n          qa289OfferPollInFlight) return;\n      const existingRide = activeRef.current;\n      if (existingRide && existingRide.status !== \"em_viagem\") return;\n\n      qa289OfferPollInFlight = true;\n      try {\n        const since = new Date(Date.now() - 90000).toISOString();\n        const {data, error} = await supabase.from(\"rides\")\n          .select(\"*\")\n          .contains(\"candidate_driver_ids\", [userId as string])\n          .eq(\"status\", \"procurar_motorista\")\n          .is(\"driver_id\", null)\n          .gte(\"created_at\", since)\n          .order(\"created_at\", {ascending:false})\n          .limit(3);\n        if (qa289OfferPollClosed || document.visibilityState !== \"visible\" ||\n            !online || incomingRef.current || ratingRef.current) return;\n        if (error) {\n          if (import.meta.env.DEV)\n            console.warn(\"[APOIS QA289] falha na consulta de ofertas:\", error.message);\n          return;\n        }\n        const fresh = (data as RideRow[] | null)?.find(r =>\n          computeOfferCountdown(r) > 0 &&\n          !handledRidesRef.current.has(r.id)\n        );\n        if (fresh) presentOffer(fresh);\n      } catch (error) {\n        if (import.meta.env.DEV)\n          console.warn(\"[APOIS QA289] oferta temporariamente indisponível:\", error);\n      } finally {\n        qa289OfferPollInFlight = false;\n      }\n    }, 7000);\n\n";
const markerStart="    return () => {\n      supabase.removeChannel(ch);\n";
once(markerStart,fallback+markerStart,"append read-only offer poll alongside existing active ride poll");
once("      window.clearInterval(poll);\n",
     "      window.clearInterval(poll);\n      qa289OfferPollClosed = true;\n      window.clearInterval(qa289OfferPoll);\n",
     "stop offer polling on cleanup");
once("  }, [userId, driverId, loadTodayStats, featureFlags]);",
     "  }, [userId, driverId, loadTodayStats, featureFlags, online]);",
     "refresh fallback on ONLINE toggle");
for(const expected of [
 marker,
 "const qa289OfferPoll = window.setInterval",
 'document.visibilityState !== "visible"',
 '!online || !driverId',
 '.contains("candidate_driver_ids", [userId as string])',
 '.eq("status", "procurar_motorista")',
 '.gte("created_at", since)',
 ".limit(3)",
 "if (fresh) presentOffer(fresh)",
 "window.clearInterval(qa289OfferPoll)",
 "  }, [userId, driverId, loadTodayStats, featureFlags, online]);",
 ".subscribe(async (status) => {",
 "const poll = window.setInterval(async () => {",
 "startRideRingtone();",
 "stopRideRingtone();"
])if(!source.includes(expected))throw Error("[FAIL] QA289 lost required functionality: "+expected);
source="// "+marker+"\n"+source;
writeFileSync(file,source,"utf8");
console.log("[OK] QA289: foreground ONLINE RLS-scoped pending offers recovered every 7 seconds.");
