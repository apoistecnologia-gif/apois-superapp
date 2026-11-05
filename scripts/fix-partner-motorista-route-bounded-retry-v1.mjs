// RT-02/RT-01: reliable bounded route retry. Do not couple routing effect to every GPS tick.
// Applied after route-fail-closed and routing auth patch in isolated Motorista workspace.
import {readFileSync,writeFileSync} from "node:fs";
import {resolve} from "node:path";
const p=resolve(process.env.APOIS_MOTORISTA_WORKSPACE||".work/partner-motorista","src/routes/motorista.app.tsx");
let s=readFileSync(p,"utf8");
function one(old,next,label){const n=s.split(old).length-1;if(n!==1)throw Error("[FAIL] Route retry "+label+" count="+n);s=s.replace(old,next);}
one('  const [mapReadyNonce, setMapReadyNonce] = useState(0);',
`  const [mapReadyNonce, setMapReadyNonce] = useState(0);
  // APOIS_DRIVER_ROUTE_BOUNDED_RETRY_V1: maximum 2 extra calls per ride phase.
  const [routeRetryNonce,setRouteRetryNonce] = useState(0);
  const routeRetryCountRef=useRef(0);
  const routeRetryScopeRef=useRef<string|null>(null);
  useEffect(()=>{
    const onOnline=()=>{
      routeRetryCountRef.current=0;
      setRouteRetryNonce(v=>v+1);
    };
    window.addEventListener("online",onOnline);
    return ()=>window.removeEventListener("online",onOnline);
  },[]);`,"add bounded retry state");
one(`    if (!active) {
      setPolyline([]);`,`    if (!active) {
      routeRetryCountRef.current=0;
      routeRetryScopeRef.current=null;
      setPolyline([]);`,"reset on no ride");
one(`    const fitKey = \`\${active.id}-\${active.status}\`;
    const routeRequestKey = fitKey;`,
`    const fitKey = \`\${active.id}-\${active.status}\`;
    if (routeRetryScopeRef.current!==fitKey) {
      routeRetryScopeRef.current=fitKey;
      routeRetryCountRef.current=0;
    }
    const routeRequestKey = fitKey + ":" + routeRetryNonce;`,"retry request identity");
one(`    lastRouteRequestKeyRef.current = routeRequestKey;
    if (lastFitKeyRef.current !== fitKey) setPolyline([]);
    let cancelled = false;`,
`    lastRouteRequestKeyRef.current = routeRequestKey;
    if (lastFitKeyRef.current !== fitKey) setPolyline([]);
    let cancelled = false;
    let retryTimer: number | null=null;`,"timer lifetime");
one(`        resetSpokenCache();
        if (routeFailToastedRef.current === fitKey)`,
`        routeRetryCountRef.current=0;
        resetSpokenCache();
        if (routeFailToastedRef.current === fitKey)`,"reset on success");
one(`      .catch(() => {
        if (cancelled) return;
        // Fallback: mantém marcadores e desenha linha reta para não quebrar UX.
        // APOIS_DRIVER_ROUTE_FAIL_CLOSED_V1:`,
`      .catch(() => {
        if (cancelled) return;
        if (navigator.onLine && routeRetryCountRef.current<2) {
          routeRetryCountRef.current+=1;
          const backoffMs=routeRetryCountRef.current===1?30000:90000;
          retryTimer=window.setTimeout(()=>setRouteRetryNonce(v=>v+1),backoffMs);
        }
        // Fallback: mantém marcadores e desenha linha reta para não quebrar UX.
        // APOIS_DRIVER_ROUTE_FAIL_CLOSED_V1:`,"bounded backoff on failure");
one(`    return () => { cancelled = true; };
  }, [active?.id, active?.status, position?.lat, position?.lng, mapReadyNonce]);`,
`    return () => {
      cancelled = true;
      if (retryTimer!==null) window.clearTimeout(retryTimer);
      if (lastRouteRequestKeyRef.current===routeRequestKey) lastRouteRequestKeyRef.current=null;
    };
  }, [active?.id, active?.status, Boolean(position), mapReadyNonce, routeRetryNonce]);`,"stable dependencies");
for(const marker of ["APOIS_DRIVER_ROUTE_BOUNDED_RETRY_V1","routeRetryCountRef.current<2","Boolean(position), mapReadyNonce, routeRetryNonce","window.clearTimeout(retryTimer)"])if(!s.includes(marker))throw Error("[FAIL] Missing route recovery "+marker);
writeFileSync(p,s,"utf8");
console.log("[OK] Driver routes: GPS updates do not abort in-flight route; no infinite Maps retry loop; max 2 retries per phase.");
