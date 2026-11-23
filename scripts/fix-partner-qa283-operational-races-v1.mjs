// APOIS_PARTNER_QA283_OPERATIONAL_RACES_V1
// Safe, fail-closed changes to disposable Partner workspaces ONLY.
// No RPC replacement, backend deploy, schema changes, payment or route modifications.
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const MARKER = "APOIS_PARTNER_QA283_OPERATIONAL_RACES_V1";

function replaceOnce(source, oldText, newText, label) {
  const matches = source.split(oldText).length - 1;
  if (matches !== 1) throw Error("[FAIL] Partner QA283 " + label + " anchor count=" + matches);
  return source.replace(oldText, newText);
}

export function fixDriverReject(source) {
  if (source.includes(MARKER)) throw Error("[FAIL] Partner QA283 driver already patched");
  const begin = source.indexOf("  async function handleReject() {");
  const finish = begin < 0 ? -1 : source.indexOf("  async function handleDriverCancelRide(", begin);
  if (begin < 0 || finish <= begin) throw Error("[FAIL] Partner QA283 driver reject bounds changed");
  const old = source.slice(begin, finish);
  for (const token of [
    "callReject({ data: { rideId: offer.id } })",
    'removeIncomingRequest(offer, "driver_rejected")',
  ]) if (!old.includes(token)) throw Error("[FAIL] Partner QA283 lost reject contract " + token);
  const rewritten = [
    "  // " + MARKER + ": never claim rejection before backend acknowledgement.",
    "  async function handleReject() {",
    "    const offer = incomingRef.current;",
    "    if (!offer) return;",
    "    try {",
    "      await callReject({ data: { rideId: offer.id } });",
    '      removeIncomingRequest(offer, "driver_rejected");',
    "    } catch (error) {",
    '      console.error("[APOIS MOTORISTA] erro ao recusar:", error);',
    '      toast.error("Falha ao recusar corrida", {',
    '        description: error instanceof Error ? error.message : "Confira a conexão e tente novamente.",',
    "      });",
    "    }",
    "  }",
    "",
  ].join("\n");
  return source.slice(0, begin) + rewritten + source.slice(finish);
}

export function fixCourierWatcher(source) {
  if (source.includes(MARKER)) throw Error("[FAIL] Partner QA283 courier watcher already patched");
  if (!source.includes("let disposed = false;") || !source.includes("nativeWatchId = await Geolocation.watchPosition("))
    throw Error("[FAIL] Partner QA283 native watcher lifecycle missing");
  const start = source.indexOf("nativeWatchId = await Geolocation.watchPosition(");
  const end = source.indexOf("\n      );", start);
  if (end < 0 || end - start > 1900) throw Error("[FAIL] Partner QA283 native watcher closure changed");
  const insertion = [
    "",
    "      // " + MARKER + ": a late native registration must never survive unmount.",
    "      if (disposed && nativeWatchId) {",
    "        const lateWatchId = nativeWatchId;",
    "        nativeWatchId = null;",
    "        await Geolocation.clearWatch({ id: lateWatchId });",
    "      }",
  ].join("\n");
  return source.slice(0, end + "\n      );".length) + insertion + source.slice(end + "\n      );".length);
}

export function fixCourierOfferPolling(source) {
  if (source.includes(MARKER)) throw Error("[FAIL] Partner QA283 courier offers already patched");
  source = replaceOnce(
    source,
    "  const alertTimerRef = useRef<number | null>(null);",
    "  const alertTimerRef = useRef<number | null>(null);\n  // " + MARKER + ": do not overlap repeated offer reads on slow networks.\n  const offersLoadingRef = useRef(false);",
    "offer loading ref",
  );
  source = replaceOnce(
    source,
    [
      "  const loadOffers = useCallback(async () => {",
      '    const { data, error } = await callRpc("get_courier_incoming_offers");',
      "    if (error) {",
      '      console.warn("courier incoming offers load failed", error.message);',
      "      return;",
      "    }",
      "    setOffers(Array.isArray(data) ? (data as IncomingOffer[]) : []);",
      "  }, []);",
    ].join("\n"),
    [
      "  const loadOffers = useCallback(async () => {",
      "    if (offersLoadingRef.current) return;",
      "    offersLoadingRef.current = true;",
      "    try {",
      '      const { data, error } = await callRpc("get_courier_incoming_offers");',
      "      if (error) {",
      '        console.warn("courier incoming offers load failed", error.message);',
      "        return;",
      "      }",
      "      setOffers(Array.isArray(data) ? (data as IncomingOffer[]) : []);",
      "    } finally {",
      "      offersLoadingRef.current = false;",
      "    }",
      "  }, []);",
    ].join("\n"),
    "single flight offers query",
  );
  source = replaceOnce(
    source,
    "    const poll = window.setInterval(refresh, 1000);",
    '    const poll = window.setInterval(() => {\n      if (document.visibilityState === "visible") refresh();\n    }, 1000);',
    "hidden screen polling pause",
  );
  return source;
}

function apply(file, fn, markers) {
  const original = readFileSync(file, "utf8");
  const next = fn(original);
  if (next === original) throw Error("[FAIL] Partner QA283 unchanged " + file);
  for (const token of markers) if (!next.includes(token)) throw Error("[FAIL] Partner QA283 missing contract " + token);
  writeFileSync(file, next);
  console.log("[OK] Partner QA283 " + file);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const driver = resolve(process.env.APOIS_MOTORISTA_WORKSPACE || ".work/partner-motorista");
  const courier = resolve(process.env.APOIS_ENTREGAS_WORKSPACE || ".work/partner-entregador");
  apply(resolve(driver, "src/routes/motorista.app.tsx"), fixDriverReject,
    [MARKER, "await callReject({ data: { rideId: offer.id } });",
     'removeIncomingRequest(offer, "driver_rejected");']);
  apply(resolve(courier, "src/components/CourierLocationTracker.tsx"), fixCourierWatcher,
    [MARKER, "await Geolocation.clearWatch({ id: lateWatchId });"]);
  apply(resolve(courier, "src/components/CourierOfferOverlay.tsx"), fixCourierOfferPolling,
    [MARKER, "offersLoadingRef.current = false;", 'document.visibilityState === "visible"']);
}
