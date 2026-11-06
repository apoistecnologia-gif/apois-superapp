// Correcoes Motorista APOIS Corridas E2E. Altera apenas .work/partner-motorista.
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
const root = resolve(process.env.APOIS_MOTORISTA_WORKSPACE || ".work/partner-motorista");
function patch(file, transform, marker) {
  const path=resolve(root,file), before=readFileSync(path,"utf8");
  if(before.includes(marker)) { console.log("[OK] Motorista E2E ja aplicado: "+file); return; }
  const after=transform(before);
  if(after===before || !after.includes(marker)) throw Error("[FAIL] Motorista E2E: "+file);
  writeFileSync(path,after,"utf8"); console.log("[OK] Motorista E2E: "+file);
}
patch("src/routes/motorista.app.tsx",(source)=>{
  let s=source;
  // Nao desenhar polylines remanescentes apos a conclusao/cancelamento.
  if(!s.includes('polyline.length > 0 && (')) throw Error("[FAIL] route render contract changed");
  s=s.replace('polyline.length > 0 && (','active && polyline.length > 0 && (');
  // "motorista_chegou" e fase de espera, nao uma rota ativa ao embarque.
  const pick='const toPickup = active.status === "motorista_a_caminho" || active.status === "motorista_chegou";';
  if(!s.includes(pick)) throw Error("[FAIL] pickup state changed");
  s=s.replace(pick,'// APOIS_DRIVER_ROUTE_E2E_V1: encerrada a aproximacao, limpar ETA e rota.\n    const toPickup = active.status === "motorista_a_caminho";');
  const noDest='if (!dest) { setPolyline([]); return; }';
  if(!s.includes(noDest)) throw Error("[FAIL] route null cleanup changed");
  s=s.replace(noDest,'if (!dest) { setPolyline([]); setEtaSeconds(null); setLegKm(null); setRouteSteps([]); return; }');
  // Nunca apresentar linha reta nem ETA ficticio como se fosse rota rodoviaria.
  const fallback=s.match(/const fallback = \[pos, dest\];[\s\S]*?focusRoute\(fallback\);/);
  if(!fallback)throw Error("[FAIL] fallback route changed");
  s=s.replace(fallback[0],'setPolyline([]);\n        setRouteSteps([]);\n        setLegKm(null);\n        setEtaSeconds(null);');
  // Quando nao existe comprovante do destino, dizer "encerrada" e nao "chegou".
  s=s.replaceAll('O passageiro chegou com segurança.', 'A corrida foi encerrada. Confira os dados antes de avaliar.');
  // Evita que mensagens do trajeto anterior permaneçam na navegacao encerrada.
  const last='      lastRouteRequestKeyRef.current = null;\n      return;';
  if(s.includes(last))s=s.replace(last,'      lastRouteRequestKeyRef.current = null;\n      setRouteSteps([]);\n      resetSpokenCache();\n      return;');
  return s;
},"APOIS_DRIVER_ROUTE_E2E_V1");

patch("src/lib/driverRideLifecycle.mobile.ts",(source)=>{
  let s=source;
  // Edge Functions historicas de rejeicao/cancelamento NAO estao implantadas.
  // Os wrappers abaixo existem em producao e validam auth.uid no servidor.
  const reject=/return callDriverRedispatchFunction\("driver-reject-redispatch",\s*\{\s*ride_id:\s*data\.rideId,\s*\}\);/;
  const cancel=/return callDriverRedispatchFunction\("driver-cancel-redispatch",\s*\{\s*ride_id:\s*data\.rideId,\s*reason:\s*reason \|\| null,\s*\}\);/;
  if(!reject.test(s)||!cancel.test(s))throw Error("[FAIL] lifecycle source changed; no blind rewrite");
  s=s.replace(reject,'// APOIS_DRIVER_RPC_LIFECYCLE_E2E_V1: chamada autenticada existente.\n  return callRpc("driver_reject_ride", { _ride_id: data.rideId });');
  s=s.replace(cancel,'return callRpc("driver_cancel_ride", { _ride_id: data.rideId, _reason: reason || null });');
  // Esta revisao nao assume redispatch automatico: exigir QA de outra oferta.
  return s;
},"APOIS_DRIVER_RPC_LIFECYCLE_E2E_V1");

patch("src/routes/motorista.app.tsx",(source)=>{
  // O codigo anterior podia consultar somente public.users com RLS, exibindo
  // Passageiro generico quando faltava permissao. Usar o RPC associado a oferta.
  if(source.includes("APOIS_DRIVER_PASSENGER_OFFER_LOOKUP_E2E_V1"))return source;
  const anchor='const assignedRideId = active?.id ?? null;';
  if(!source.includes(anchor))throw Error("[FAIL] assigned passenger hook changed");
  return source.replace(anchor,'// APOIS_DRIVER_PASSENGER_OFFER_LOOKUP_E2E_V1\n    const assignedRideId = active?.id ?? incoming?.id ?? ratingRide?.id ?? null;');
},"APOIS_DRIVER_PASSENGER_OFFER_LOOKUP_E2E_V1");

console.log("[OK] Motorista: rota/ETA, recusa/cancelamento via RPC existente e nome do passageiro.");
