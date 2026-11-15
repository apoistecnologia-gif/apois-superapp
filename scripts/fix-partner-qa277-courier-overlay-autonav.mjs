// APOIS_PARTNER_QA277_COURIER_OVERLAY_AUTONAV_AFTER_ACCEPT_V1
// The global CourierOfferOverlay has its own RPC accept path, independent from
// src/routes/courier.tsx. Hook only its confirmed success, never a poll or resume.
// Generated disposable Courier workspace only; no auth, GPS, PIN or DB changes.
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(process.env.APOIS_ENTREGAS_WORKSPACE || ".work/partner-entregador");
const path = resolve(root, "src/components/CourierOfferOverlay.tsx");
const marker = "APOIS_PARTNER_QA277_COURIER_OVERLAY_AUTONAV_AFTER_ACCEPT_V1";
let s = readFileSync(path, "utf8");
if (s.includes(marker)) throw Error("[FAIL] QA277 overlay already patched");

function once(a, b, label) {
  const occurrences = s.split(a).length - 1;
  if (occurrences !== 1) throw Error("[FAIL] QA277 " + label + " expected once, got " + occurrences);
  s = s.replace(a, b);
}

for (const t of [
  'export function CourierOfferOverlay() {',
  'const respond = async (action: "accept" | "reject") => {',
  'action === "accept" ? "accept_delivery_offer" : "reject_delivery_offer"',
  'await loadOffers();',
  'toast.success(action === "accept" ? "Entrega aceita." : "Oferta recusada.");',
]) if (!s.includes(t)) throw Error("[FAIL] QA277 original offer handler prerequisite absent: " + t);

once(
  'import { supabase } from "@/integrations/supabase/client";',
  'import { supabase } from "@/integrations/supabase/client";\n' +
  'import { isNativeCourierAndroid } from "@/lib/courier-push";\n' +
  'import { launchApoisNavigationAfterRideStart, validNavigationCoordinate } from "@/components/ApoisExternalNavigation";',
  "imports",
);

const respondStart = s.indexOf('  const respond = async (action: "accept" | "reject") => {');
const respondEnd = s.indexOf("\n  return (", respondStart);
if (respondStart < 0 || respondEnd <= respondStart) throw Error("[FAIL] QA277 offer callback bounds");
const before = s.slice(respondStart, respondEnd);
const success = [
  '    toast.success(action === "accept" ? "Entrega aceita." : "Oferta recusada.");',
  '    await loadOffers();',
].join("\n");

const addition = [
  '    toast.success(action === "accept" ? "Entrega aceita." : "Oferta recusada.");',
  '    await loadOffers();',
  '',
  "    // " + marker + ": only a deliberate, server-accepted offer opens external Maps.",
  '    if (action === "accept" && courierId && isNativeCourierAndroid()) {',
  "      try {",
  "        const { data: acceptedJob, error: jobError } = await (supabase as any)",
  '          .from("delivery_jobs")',
  '          .select("id,courier_id,status,pickup_latitude,pickup_longitude")',
  '          .eq("courier_id", courierId)',
  '          .in("status", ["accepted", "arriving_pickup"])',
  '          .order("accepted_at", { ascending: false })',
  "          .limit(1)",
  "          .maybeSingle();",
  "        if (jobError) throw jobError;",
  "        if (!acceptedJob || !validNavigationCoordinate(acceptedJob.pickup_latitude, acceptedJob.pickup_longitude)) {",
  '          throw Error("Endereço de retirada indisponível na entrega aceita.");',
  "        }",
  "        await launchApoisNavigationAfterRideStart(",
  "          Number(acceptedJob.pickup_latitude), Number(acceptedJob.pickup_longitude),",
  "        );",
  "      } catch (navigationError) {",
  '        console.warn("[APOIS COURIER] Navegação externa indisponível após oferta aceita", navigationError);',
  '        toast.info("Entrega aceita. Use Reabrir mapa para iniciar a rota.");',
  "      }",
  "    }",
].join("\n");
if (before.split(success).length !== 2) throw Error("[FAIL] QA277 overlay success anchor changed");
s = s.slice(0, respondStart) + before.replace(success, addition) + s.slice(respondEnd);

const changed = s.slice(s.indexOf('  const respond = async (action: "accept" | "reject") => {'),
  s.indexOf("\n  return (", s.indexOf('  const respond = async (action: "accept" | "reject") => {')));
if (!(changed.includes('if (error) {') && changed.includes('if (action === "accept" && courierId && isNativeCourierAndroid())'))) throw Error("[FAIL] QA277 invalid gating");
if (changed.indexOf('if (error) {') > changed.indexOf('if (action === "accept" && courierId && isNativeCourierAndroid())')) throw Error("[FAIL] QA277 navigation before RPC error guard");
if (!changed.includes('await loadOffers();\n\n    // ' + marker)) throw Error("[FAIL] QA277 navigation not after completed acceptance");
if (changed.split("launchApoisNavigationAfterRideStart(").length !== 2) throw Error("[FAIL] QA277 multiple nav launches");
writeFileSync(path, s, "utf8");
console.log("[OK] QA277 Courier offer overlay: auto-launch native Google Maps/Waze only after successful acceptance; no PIN, GPS or finance changes.");
