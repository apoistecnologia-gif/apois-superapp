import {readFileSync,writeFileSync} from "node:fs";
import {resolve} from "node:path";
const root=resolve(process.env.APOIS_MOTORISTA_WORKSPACE||".work/partner-motorista");
function read(path){return readFileSync(resolve(root,path),"utf8");}
function write(path,source){writeFileSync(resolve(root,path),source,"utf8");}
function once(source,before,after,what){
  const n=source.split(before).length-1;
  if(n!==1)throw Error("[FAIL] Motorista voice V5 "+what+": count="+n);
  return source.replace(before,after);
}
const arrivalCode = "  // Never announce arrival from one GPS proximity reading or an old route.\n  // Require plausible displacement since this ride entered \"em_viagem\".\n  const destinationEvidenceRef = useRef<{\n    rideKey: string; firstAt: number; lastAt: number; last: LatLng;\n    travelledKm: number; nearFixes: number;\n  } | null>(null);\n  useEffect(() => {\n    if (!active || !position || active.status !== \"em_viagem\") {\n      destinationEvidenceRef.current = null;\n      return;\n    }\n    const rideKey = active.id + \":em_viagem\";\n    const now = Date.now();\n    const dest = { lat: active.destination_lat, lng: active.destination_lng };\n    if (!isBrazilCoordinate(dest.lat, dest.lng)) return;\n    let evidence = destinationEvidenceRef.current;\n    if (!evidence || evidence.rideKey !== rideKey) {\n      destinationEvidenceRef.current = {\n        rideKey, firstAt: now, lastAt: now,\n        last: { lat: position.lat, lng: position.lng },\n        travelledKm: 0, nearFixes: 0,\n      };\n      return;\n    }\n    const seconds = Math.max(0, (now - evidence.lastAt) / 1000);\n    const movedKm = haversineKm(evidence.last, position);\n    if (movedKm > Math.max(0.03, seconds * 0.05)) {\n      // Bad GPS jump or a stale first fix: restart, never claim arrival.\n      evidence.firstAt = now;\n      evidence.lastAt = now;\n      evidence.last = { lat: position.lat, lng: position.lng };\n      evidence.travelledKm = 0;\n      evidence.nearFixes = 0;\n      return;\n    }\n    if (movedKm >= 0.008) {\n      evidence.travelledKm += movedKm;\n      evidence.lastAt = now;\n      evidence.last = { lat: position.lat, lng: position.lng };\n    }\n    evidence.nearFixes = haversineKm(position, dest) <= 0.05\n      ? evidence.nearFixes + 1 : 0;\n    if (evidence.travelledKm >= 0.12 &&\n        evidence.nearFixes >= 2 &&\n        now - evidence.firstAt >= 20000) {\n      void speak(\n        \"Você chegou ao destino final. Quando o passageiro desembarcar, toque em finalizar corrida.\",\n        { dedupKey: active.id + \":destination-arrival\" },\n      );\n    }\n  }, [position?.lat, position?.lng, active?.id, active?.status]); // eslint-disable-line react-hooks/exhaustive-deps\n\n";
{
 let v=read("src/lib/voiceNav.ts");
 v=once(v,
  '    const step = steps[i];\n    const distance = distTo(step);',
  '    const step = steps[i];\n    const instruction = cleanVoiceInstruction(step.instruction);\n    const maneuver = String(step.maneuver ?? "").toLowerCase();\n    // Arrival is only allowed by the GPS movement guard, never by stale turn-by-turn steps.\n    if (/destino|destination|arriv|você chegou|chegou ao|fim da rota|end of route/i.test(instruction) || /arriv|destinat|end_of_road/i.test(maneuver)) continue;\n    const distance = distTo(step);',
  "filter stale destination step");
 write("src/lib/voiceNav.ts",v);
}
{
 let s=read("src/routes/motorista.app.tsx");
 s=once(s,
  '  const [routeSteps, setRouteSteps] = useState<NavStep[]>([]);',
  '  const [routeSteps, setRouteSteps] = useState<NavStep[]>([]);\n  const [routeStepsPhase, setRouteStepsPhase] = useState<string | null>(null);',
  "phase tag");
 s=once(s,
  '  const lastRouteRequestKeyRef = useRef<string | null>(null);',
  '  const lastRouteRequestKeyRef = useRef<string | null>(null);\n  const lastRoutePhaseRef = useRef<string | null>(null);',
  "phase ref");
 s=once(s,
  '      setEtaSeconds(null);\n      setLegKm(null);\n      lastFitKeyRef.current = null;',
  '      setEtaSeconds(null);\n      setLegKm(null);\n      setRouteSteps([]);\n      setRouteStepsPhase(null);\n      lastRoutePhaseRef.current = null;\n      lastFitKeyRef.current = null;',
  "clear route on end");
 const tick=String.fromCharCode(96);
 const fitLine='    const fitKey = '+tick+'$'+'{active.id}-$'+'{active.status}'+tick+';';
 s=once(s,fitLine,
  fitLine+'\n    if (lastRoutePhaseRef.current !== fitKey) {\n      lastRoutePhaseRef.current = fitKey;\n      setRouteSteps([]);\n      setRouteStepsPhase(null);\n      setEtaSeconds(null);\n      setLegKm(null);\n    }',
  "clear old stage ETA and steps");
 s=once(s,
  '        if (points.length < 2) throw new Error("route_polyline_empty");',
  '        if (points.length < 2) throw new Error("route_polyline_empty");\n        const directMeters = haversineKm(pos, dest) * 1000;\n        if (directMeters > 150 && (res.distanceMeters < directMeters * 0.55 || res.durationSeconds < Math.max(15, directMeters / 55))) {\n          throw new Error("route_distance_inconsistent");\n        }',
  "reject implausible 0km/1min route when destination is far");
 s=once(s,
  '        setRouteSteps(nextSteps);\n        const firstInstruction =',
  '        setRouteSteps(nextSteps);\n        setRouteStepsPhase(fitKey);\n        const firstInstruction =',
  "tag fresh steps");
 s=once(s,
  'if (firstInstruction && (active.status === "motorista_a_caminho" || active.status === "em_viagem")) {',
  'if (firstInstruction && !/destino|destination|arriv|você chegou|chegou ao|fim da rota|end of route/i.test(firstInstruction) && (active.status === "motorista_a_caminho" || active.status === "em_viagem")) {',
  "skip route-ready arrival sentence");
 s=once(s,
  '        setRouteSteps([]);\n        const km = haversineKm(pos, dest);',
  '        setRouteSteps([]);\n        setRouteStepsPhase(null);\n        const km = haversineKm(pos, dest);',
  "failed routes have no directions");
 s=once(s,
  '        setLegKm(km); setEtaSeconds(Math.round((km / 35) * 3600));',
  '        // Straight-line distance is not a verified road route.\n        setLegKm(null); setEtaSeconds(null);',
  "do not invent fallback ETA");
 s=once(s,
  '    if (routeSteps.length === 0) return;\n    if (active.status !== "motorista_a_caminho"',
  '    if (routeSteps.length === 0) return;\n    if (routeStepsPhase !== active.id + "-" + active.status) return;\n    if (active.status !== "motorista_a_caminho"',
  "voice respects fresh route status");
 s=once(s,
  '}, [position?.lat, position?.lng, routeSteps, active?.id, active?.status]); // eslint-disable-line react-hooks/exhaustive-deps',
  '}, [position?.lat, position?.lng, routeSteps, routeStepsPhase, active?.id, active?.status]); // eslint-disable-line react-hooks/exhaustive-deps',
  "voice dependency includes phase");
 const start=s.indexOf('  // Avisos automáticos de chegada exigidos pelo checklist do Motorista.');
 const end=s.indexOf('  // Fala transições de status importantes.',start);
 if(start<0||end<=start)throw Error("[FAIL] Motorista voice V5 arrival effect boundaries");
 s=s.slice(0,start)+arrivalCode+s.slice(end);
 if(!s.includes('evidence.travelledKm >= 0.12')||!s.includes('res.distanceMeters < directMeters * 0.55'))throw Error("[FAIL] missing safety guard");
 write("src/routes/motorista.app.tsx",s);
}
console.log("[OK] Motorista voice V5: fresh stage directions, consistent route metrics and movement-confirmed destination arrival.");
