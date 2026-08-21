import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const workspace = process.env.APOIS_MOTORISTA_WORKSPACE || '.work/motorista-test';

function patch(relativePath, transform, label) {
  const path = resolve(root, workspace, relativePath);
  const before = readFileSync(path, 'utf8');
  const after = transform(before);
  if (after === before) {
    console.log(`[OK] ${label} (já aplicado/sem alteração)`);
    return;
  }
  writeFileSync(path, after, 'utf8');
  console.log(`[OK] ${label}`);
}

patch('src/routes/motorista.app.tsx', (source) => {
  let next = source;

  // Recalcula a rota conforme o motorista realmente se desloca. Antes a chave
  // era somente rideId/status, então a primeira rota (ou uma falha inicial)
  // ficava congelada durante toda a fase.
  next = next.replace(
    '  const routeFailToastedRef = useRef<string | null>(null);',
    '  const routeFailToastedRef = useRef<string | null>(null);\n  const lastRouteFailureAtRef = useRef(0);',
  );
  next = next.replace(
    '    const routeRequestKey = fitKey;',
    '    const routeRequestKey = `${fitKey}:${pos.lat.toFixed(3)}:${pos.lng.toFixed(3)}`;',
  );
  next = next.replace(
    '    lastRouteRequestKeyRef.current = routeRequestKey;\n    if (lastFitKeyRef.current !== fitKey) setPolyline([]);',
    '    if (routeFailToastedRef.current === fitKey && Date.now() - lastRouteFailureAtRef.current < 12000 && polyline.length > 0) return;\n    lastRouteRequestKeyRef.current = routeRequestKey;\n    if (lastFitKeyRef.current !== fitKey) setPolyline([]);',
  );
  next = next.replace(
    '        const points = decodePolyline(res.encodedPolyline);\n        setPolyline(points);',
    '        const points = decodePolyline(res.encodedPolyline);\n        if (points.length < 2) throw new Error("route_polyline_empty");\n        setPolyline(points);',
  );
  next = next.replace(
    '        // Fallback: mantém marcadores e desenha linha reta para não quebrar UX.\n        const fallback = [pos, dest];',
    '        // Fallback: mantém marcadores e desenha linha reta para não quebrar UX.\n        // Libera nova tentativa após um intervalo curto em vez de congelar a falha.\n        lastRouteFailureAtRef.current = Date.now();\n        lastRouteRequestKeyRef.current = null;\n        const fallback = [pos, dest];',
  );

  // Quando o motorista já está muito perto do embarque, centraliza motorista +
  // ponto de coleta em vez de projetar a câmera 105 m à frente. Isso evita a
  // sensação de mapa perdido/fora do ponto justamente na chegada.
  next = next.replace(
    '  const center = heading == null ? position : offsetLatLng(position, heading, NAVIGATION_CENTER_AHEAD_METERS);',
    '  const destinationKm = destination ? haversineKm(position, destination) : null;\n  const nearDestination = destinationKm != null && destinationKm <= 0.12;\n  const center = nearDestination && destination\n    ? { lat: (position.lat + destination.lat) / 2, lng: (position.lng + destination.lng) / 2 }\n    : heading == null\n      ? position\n      : offsetLatLng(position, heading, NAVIGATION_CENTER_AHEAD_METERS);\n  const targetZoom = nearDestination ? 18 : NAVIGATION_ZOOM;',
  );
  next = next.replace(
    '        zoom: NAVIGATION_ZOOM,\n        heading: heading ?? undefined,\n        tilt: heading == null ? 0 : 45,',
    '        zoom: targetZoom,\n        heading: nearDestination ? 0 : (heading ?? undefined),\n        tilt: nearDestination || heading == null ? 0 : 45,',
  );
  next = next.replace(
    '    if ((map.getZoom() ?? 0) < 17) map.setZoom(NAVIGATION_ZOOM);\n    if (heading != null) {',
    '    if ((map.getZoom() ?? 0) < 17 || nearDestination) map.setZoom(targetZoom);\n    if (nearDestination) {\n      navMap.setHeading?.(0);\n      navMap.setTilt?.(0);\n    } else if (heading != null) {',
  );

  // A transição depois do Pix deve ser inequívoca para o motorista.
  next = next.replaceAll(
    'Corrida aceita. Siga até o ponto de embarque.',
    'Pagamento confirmado. Siga até o ponto de embarque.',
  );

  // Cards de navegação: preto/grafite + dourado APOIS, eliminando o branco com
  // texto claro que ficou ilegível no APK de campo.
  next = next
    .replaceAll(
      'rounded-[22px] border border-white/70 bg-white/85 px-4 py-3 shadow-[0_12px_36px_-16px_rgba(0,0,0,0.35)] backdrop-blur-md backdrop-saturate-150',
      'rounded-[22px] border border-white/10 bg-[#080B11]/95 px-4 py-3 text-white shadow-[0_18px_46px_-18px_rgba(0,0,0,0.85)] backdrop-blur-xl backdrop-saturate-150',
    )
    .replaceAll(
      'rounded-[22px] bg-white/85 border border-white/70 backdrop-blur-md backdrop-saturate-150 px-4 py-3 shadow-[0_12px_36px_-16px_rgba(0,0,0,0.35)]',
      'rounded-[22px] bg-[#080B11]/95 border border-white/10 backdrop-blur-xl backdrop-saturate-150 px-4 py-3 text-white shadow-[0_18px_46px_-18px_rgba(0,0,0,0.85)]',
    )
    .replaceAll(
      'rounded-[22px] border border-white/70 bg-white/90 px-4 py-3 shadow-[0_12px_36px_-16px_rgba(0,0,0,0.35)] backdrop-blur-md backdrop-saturate-150',
      'rounded-[22px] border border-white/10 bg-[#080B11]/95 px-4 py-3 text-white shadow-[0_18px_46px_-18px_rgba(0,0,0,0.85)] backdrop-blur-xl backdrop-saturate-150',
    )
    .replaceAll('className="h-9 w-px bg-black/10"', 'className="h-9 w-px bg-white/10"')
    .replaceAll(
      'className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-black/[0.04] text-black/60 ring-1 ring-black/10 transition hover:bg-black/[0.08] hover:text-destructive disabled:opacity-50"',
      'className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/[0.06] text-white/75 ring-1 ring-white/10 transition hover:bg-white/[0.10] hover:text-destructive disabled:opacity-50"',
    );

  // TopStat é usado nos cards escuros de navegação; força contraste alto.
  next = next.replace(
    'className={`flex items-center gap-1.5 ${highlight ? "text-primary" : "text-foreground/85"}`}',
    'className={`flex items-center gap-1.5 ${highlight ? "text-primary" : "text-white/90"}`}',
  );
  next = next.replace(
    'className="mt-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{label}</div>',
    'className="mt-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-400">{label}</div>',
  );

  // Fase "indo até o passageiro" fica explícita e não parece que o motorista
  // já está na etapa seguinte. O CTA continua sendo a ação futura correta.
  next = next.replaceAll(
    '<span className="truncate text-[11px] font-bold uppercase tracking-[0.16em] text-primary">Indo até o passageiro</span>',
    '<div className="min-w-0"><div className="truncate text-[11px] font-black uppercase tracking-[0.16em] text-primary">Indo até o passageiro</div><div className="mt-0.5 truncate text-[10px] font-medium text-zinc-400">Siga a rota até o ponto de embarque</div></div>',
  );

  next = next.replaceAll(
    'className="flex h-12 w-full items-center justify-center gap-2 rounded-[14px] bg-[#F6BE1C] text-[15px] font-bold uppercase tracking-[0.06em] text-black shadow-[0_10px_22px_-14px_rgba(246,190,28,0.45)] transition active:scale-[0.98] hover:brightness-[1.05] disabled:cursor-not-allowed disabled:opacity-60"',
    'className="flex h-14 w-full items-center justify-center gap-2 rounded-[18px] bg-[#F6BE1C] text-[15px] font-black uppercase tracking-[0.06em] text-black shadow-[0_14px_32px_-14px_rgba(246,190,28,0.55)] transition active:scale-[0.98] hover:brightness-[1.05] disabled:cursor-not-allowed disabled:opacity-60"',
  );

  next = next.replaceAll(
    'bg-[#0B0F17]/95 backdrop-blur-xl',
    'bg-[#080B11]/[.97] backdrop-blur-xl',
  );

  return next;
}, 'motorista: fluxo pós-Pix, rota dinâmica e UI de navegação premium');

console.log(`[OK] hardening de corrida do Motorista concluído em ${workspace}`);
