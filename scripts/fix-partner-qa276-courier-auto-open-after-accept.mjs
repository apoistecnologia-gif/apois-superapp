// APOIS_PARTNER_QA276_COURIER_AUTONAV_AFTER_ACCEPT_V1
// Scope: generated disposable Courier workspace only. No Supabase migrations,
// no changes to accept/reject RPC, GPS tracker, delivery state machine or PIN.
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const workspace = resolve(process.env.APOIS_ENTREGAS_WORKSPACE || ".work/partner-entregador");
const path = resolve(workspace, "src/routes/courier.tsx");
const marker = "APOIS_PARTNER_QA276_COURIER_AUTONAV_AFTER_ACCEPT_V1";
let source = readFileSync(path, "utf8");

function replaceExactlyOnce(from, to, label) {
  const count = source.split(from).length - 1;
  if (count !== 1) throw Error("[FAIL] QA276 " + label + ": expected once, got " + count);
  source = source.replace(from, to);
}

if (source.includes(marker)) throw Error("[FAIL] QA276 auto-navigation already installed");
for (const required of [
  'const acceptedOfferId = offerId;',
  'rpc("accept_delivery_offer", { _offer_id: acceptedOfferId })',
  'const rejectOffer = async (offerId: string) => {',
  'courierActionWithTimeout(',
  'isNativeCourierAndroid()',
  'useApoisOperationalNotification',
  'onComplete={completeDelivery}',
]) {
  if (!source.includes(required)) throw Error("[FAIL] QA276 prerequisite missing: " + required);
}

replaceExactlyOnce(
  'import { useApoisOperationalNotification } from "@/components/ApoisExternalNavigation";',
  'import { useApoisOperationalNotification, launchApoisNavigationAfterRideStart, validNavigationCoordinate, setApoisOperationalNotification } from "@/components/ApoisExternalNavigation";',
  "shared native navigator import",
);

const helper = [
  "// " + marker + ": runs once only after a successful, user-initiated offer acceptance.",
  "// The accepted courier's own active job supplies authenticated pickup coordinates.",
  "// Never launch on Realtime refresh, app resume, rejected offer or job restoration.",
  "async function apoisOpenPickupAfterCourierAcceptance(courierId: string): Promise<void> {",
  "  if (!isNativeCourierAndroid()) return;",
  "  const { data, error } = await (supabase as any)",
  '    .from("delivery_jobs")',
  '    .select("id,courier_id,status,pickup_latitude,pickup_longitude")',
  '    .eq("courier_id", courierId)',
  '    .in("status", ["accepted", "arriving_pickup"])',
  '    .order("accepted_at", { ascending: false })',
  "    .limit(1)",
  "    .maybeSingle();",
  "  if (error) throw error;",
  "  if (!data || !validNavigationCoordinate(data.pickup_latitude, data.pickup_longitude)) {",
  '    throw Error("Não foi possível confirmar as coordenadas da retirada.");',
  "  }",
  "  // QA278: persist the accepted delivery role before Android pauses for Waze/Maps.",
  '  await setApoisOperationalNotification("entregador", true);',
  "  await launchApoisNavigationAfterRideStart(",
  "    Number(data.pickup_latitude), Number(data.pickup_longitude),",
  "  );",
  "}",
].join("\n");

replaceExactlyOnce("function CourierApp() {", helper + "\n\nfunction CourierApp() {", "courier-only helper");

const acceptStart = source.indexOf("  const acceptOffer = async (offerId: string) => {");
const rejectStart = source.indexOf("  const rejectOffer = async (offerId: string) => {", acceptStart);
if (acceptStart < 0 || rejectStart <= acceptStart) {
  throw Error("[FAIL] QA276 accepted offer callback bounds changed");
}
const accept = source.slice(acceptStart, rejectStart);
const success = '      toast.success("Entrega aceita.");\n      await loadCourierOperations(courier.id);';
if (accept.split(success).length !== 2) {
  throw Error("[FAIL] QA276 accepted offer success sequence changed");
}
const afterAcceptance = [
  '      toast.success("Entrega aceita.");',
  '      await loadCourierOperations(courier.id);',
  "      // QA276: accepted at the server; external navigation must never undo the acceptance.",
  "      try {",
  "        await apoisOpenPickupAfterCourierAcceptance(courier.id);",
  "      } catch (navigationError) {",
  '        console.warn("[APOIS COURIER] Navegação automática indisponível após aceite", navigationError);',
  '        toast.info("Entrega aceita. Use Reabrir mapa para abrir o Google Maps ou Waze.");',
  "      }",
].join("\n");
source = source.slice(0, acceptStart) + accept.replace(success, afterAcceptance) + source.slice(rejectStart);

const nextAccept = source.slice(
  source.indexOf("  const acceptOffer = async (offerId: string) => {"),
  source.indexOf("  const rejectOffer = async (offerId: string) => {"),
);
if (
  !nextAccept.includes('rpc("accept_delivery_offer"') ||
  !nextAccept.includes("if (error)") ||
  !nextAccept.includes("apoisOpenPickupAfterCourierAcceptance(courier.id)") ||
  nextAccept.indexOf('toast.success("Entrega aceita.");') > nextAccept.indexOf("apoisOpenPickupAfterCourierAcceptance(courier.id)")
) {
  throw Error("[FAIL] QA276 success-only navigation invariant not satisfied");
}
writeFileSync(path, source, "utf8");
console.log("[OK] QA276 Entregador: Google Maps/Waze auto-open only after confirmed acceptance; manual return fallback and operational state preserved.");
