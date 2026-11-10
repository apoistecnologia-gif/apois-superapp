// APOIS_RIDE_GPS_STABILITY_V1 — only disposable protected-snapshot Corridas workspace.
// Prevent irrelevant GPS jitter (<85m) from invalidating a priced route between
// review and "Solicitar corrida"; keep live GPS and all anti-stale quote guards.
// Recompute for destination/stop changes, origin displacement >85m, and manual retry.
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
const root=resolve(process.env.APOIS_CORRIDAS_WORKSPACE || ".work/corridas");
function edit(relative, transform) {
  const path=resolve(root,relative),source=readFileSync(path,"utf8");
  const result=transform(source);
  if(result===source)throw Error("[FAIL] GPS stability unchanged "+relative);
  writeFileSync(path,result,"utf8");
  console.log("[OK] Ride GPS stability "+relative);
}
function once(source,from,to,label) {
  const n=source.split(from).length-1;
  if(n!==1)throw Error("[FAIL] GPS stability "+label+" anchor count "+n);
  return source.replace(from,to);
}
edit("src/hooks/use-route.tsx",(original)=>{
  if(!original.includes("APOIS_REPORT09_ROUTE_CURRENT_V1")||
     !original.includes("APOIS_ROUTE_CLEAR_SAFE_V1"))
    throw Error("[FAIL] GPS stability requires the Report09 safety and route clear gates");
  if(original.includes("APOIS_RIDE_GPS_STABILITY_V1")) throw Error("[FAIL] Applied twice");
  let s=once(original,
    '  const [status, setStatus] = useState<RouteStatus>("idle");',
    '  const [status, setStatus] = useState<RouteStatus>("idle");\n'+
    '  // APOIS_RIDE_GPS_STABILITY_V1: route intention, not GPS watcher ticks, defines recalculation.\n'+
    '  const routeRequestSnapshotRef = useRef<{ intent: string; origin: RouteCoordinates } | null>(null);',
    'route request snapshot');
  s=once(s,
    '  const calculateRoute = useCallback(async () => {\n    const generation=++routeGenerationRef.current;',
    '  const calculateRoute = useCallback(async () => {\n'+
    '    const generation=++routeGenerationRef.current;\n'+
    '    // Track the actual request at START (not promise completion): stale responses\n'+
    '    // remain discarded by routeGenerationRef and Report09 guards.\n'+
    '    routeRequestSnapshotRef.current = location && destination ? {\n'+
    '      intent: JSON.stringify([destination.latitude, destination.longitude,\n'+
    '        ...orderedStops.map(s => [s.latitude, s.longitude])]),\n'+
    '      origin: { lat: location.latitude, lng: location.longitude },\n'+
    '    } : null;',
    'record routing intent');
  const effectBefore = [
    '  useEffect(() => {',
    '    const timer = setTimeout(() => {',
    '      calculateRoute();',
    '    }, 500);',
    '    setStatus("debouncing");',
    '    return () => clearTimeout(timer);',
    '  }, [calculateRoute]);',
  ].join("\n");
  const effectAfter = [
    '  useEffect(() => {',
    '    // GPS watcher may deliver a new location object every second. Retain the',
    '    // official route/price until a truly different itinerary is requested.',
    '    const previous = routeRequestSnapshotRef.current;',
    '    const intent = destination ? JSON.stringify([destination.latitude, destination.longitude,',
    '      ...orderedStops.map(s => [s.latitude, s.longitude])]) : "";',
    '    const meters = previous && location ? Math.hypot(',
    '      (location.latitude - previous.origin.lat) * 111320,',
    '      (location.longitude - previous.origin.lng) * 111320 * Math.cos(location.latitude * Math.PI / 180)',
    '    ) : Infinity;',
    '    // Same threshold already enforced by APOIS_REPORT09_ROUTE_CURRENT_V1.',
    '    // Skip BOTH debounce/status and a new backend route call on sub-85m jitter.',
    '    if (location && destination && previous && previous.intent === intent && meters <= 85) return;',
    '    const timer = setTimeout(() => {',
    '      void calculateRoute();',
    '    }, 500);',
    '    setStatus("debouncing");',
    '    return () => clearTimeout(timer);',
    '  }, [calculateRoute, destination, location, orderedStops]);',
  ].join("\n");
  s=once(s,effectBefore,effectAfter,'GPS route effect');
  s=once(s,
    '          ++routeGenerationRef.current;\n          setHasUnrecoveredRouteError(false);',
    '          ++routeGenerationRef.current;\n          routeRequestSnapshotRef.current = null;\n          setHasUnrecoveredRouteError(false);',
    'clearRoute discards prior snapshot');
  return s;
});
edit("src/routes/_authenticated.revisar-solicitacao.tsx",(s)=>{
  if(!s.includes("APOIS_REPORT09_REVIEW_GUARD_V1")||!s.includes("APOIS_RIDE_COMFORT_PREFS_V1"))
    throw Error("[FAIL] GPS pricing display requires approved review safety and comfort");
  const old='{formatCurrency(checkout.finalTotal)}';
  const replacement='{checkout.blockingReasons.some((reason) => ["route_missing", "route_outdated", "pricing_invalid"].includes(reason))\n'+
    '                ? "Recalculando tarifa..." : formatCurrency(checkout.finalTotal)}';
  return once(s,old,replacement,'review price must not present R$0.00 during invalid quote');
});
