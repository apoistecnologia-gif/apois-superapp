// APOIS STOPS CONFIRM V1 — somente Corridas Cliente.
// Corrige "Concluído" que apenas fechava o editor sem persistir tempStops.
// Exibe as paradas confirmadas ENTRE partida e destino no cartão principal.
// Preserva limite (3), validação de duplicados, ordem, cálculo de rota e pagamentos.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const work = resolve(process.env.APOIS_CORRIDAS_WORKSPACE || '.work/corridas');
function patch(rel, transform) {
  const file = resolve(work, rel);
  const before = readFileSync(file, 'utf8');
  const after = transform(before);
  if (after !== before) writeFileSync(file, after, 'utf8');
  console.log('[OK] APOIS paradas: ' + rel);
}
function replaceRequired(source, from, to, reason) {
  if (source.includes(to)) return source;
  const count = source.split(from).length - 1;
  if (count !== 1) throw new Error('[FAIL] APOIS paradas: ' + reason + ', ocorrencias=' + count);
  return source.replace(from, to);
}

patch('src/components/rides/RideStopsInput.tsx', (source) => {
  if (!source.includes('APOIS_STOPS_CONFIRM_V1')) {
    source = replaceRequired(
      source,
      'import React from "react";',
      'import React from "react";\nimport { toast } from "sonner";',
      'toast para validacao de paradas',
    );
    source = replaceRequired(
      source,
      'removeStop, reorderStops, isEditing, setIsEditing } =',
      'removeStop, reorderStops, isEditing, setIsEditing, confirmStops } =',
      'confirmStops do contexto',
    );
    source = replaceRequired(
      source,
      'onClick={() => setIsEditing(false)}',
      'onClick={() => { // APOIS_STOPS_CONFIRM_V1\n              try {\n                confirmStops();\n              } catch (error) {\n                toast.error(error instanceof Error ? error.message : "Não foi possível confirmar as paradas.");\n              }\n            }}',
      'Concluido deve gravar as paradas antes de fechar o editor',
    );
  }
  if (!source.includes('APOIS_STOPS_CONFIRM_V1') || !source.includes('confirmStops();')) {
    throw new Error('[FAIL] APOIS paradas: Concluido ainda descarta os dados temporarios');
  }
  return source;
});

patch('src/routes/_authenticated.inicio.tsx', (source) => {
  if (!source.includes('APOIS_CONFIRMED_STOPS_CARD_V1')) {
    source = replaceRequired(
      source,
      'import { RideStopsInput } from "@/components/rides/RideStopsInput";',
      'import { RideStopsInput } from "@/components/rides/RideStopsInput";\nimport { useRideStops } from "@/hooks/rides/use-ride-stops";',
      'import do contexto de paradas na Home',
    );
    source = replaceRequired(
      source,
      '  const { destination, hasDestination } = useDestination();',
      '  const { destination, hasDestination } = useDestination();\n  const { stops: confirmedStops } = useRideStops(); // APOIS_CONFIRMED_STOPS_CARD_V1',
      'obter somente paradas efetivamente confirmadas',
    );
    const destinationRow = '<button type="button" onClick={() => navigate({ to: "/buscar-destino", search: { stop: false } })} className="flex min-h-[54px] w-full items-center gap-3 text-left">';
    const stopsRows = [
      '{[...confirmedStops].sort((a, b) => a.order - b.order).map((stop, index) => (',
      '            <div key={stop.id} data-apois-confirmed-stop="true" className="flex min-h-[54px] w-full items-center gap-3 border-b border-[#ECEEF1]">',
      '              <span className="grid h-8 w-8 shrink-0 place-items-center">',
      '                <span className="grid h-6 w-6 place-items-center rounded-full border border-[#E51B23]/30 bg-[#FFF1F2] text-[11px] font-black text-[#E51B23]">{index + 1}</span>',
      '              </span>',
      '              <span className="min-w-0 flex-1">',
      '                <span className="block text-xs font-semibold text-[#7A8088]">Parada {index + 1}</span>',
      '                <span className="block truncate text-[15px] font-extrabold text-[#111111]">{stop.label || stop.formattedAddress}</span>',
      '              </span>',
      '            </div>',
      '          ))}',
      '          ',
    ].join('\n');
    source = replaceRequired(
      source,
      '          ' + destinationRow,
      '          ' + stopsRows + destinationRow,
      'paradas confirmadas entre origem e destino',
    );
  }
  for (const required of ['APOIS_CONFIRMED_STOPS_CARD_V1', 'data-apois-confirmed-stop="true"', 'stops: confirmedStops', 'Parada {index + 1}']) {
    if (!source.includes(required)) throw new Error('[FAIL] APOIS paradas: cartao principal incompleto (' + required + ')');
  }
  return source;
});
console.log('[OK] APOIS_STOPS_CONFIRM_V1: Concluido valida e grava; Home apresenta 1 a 3 paradas antes do destino.');

// APOIS_STOPS_REQUEST_V2 — repassa paradas confirmadas ao cálculo oficial de tarifa.
patch('src/hooks/rides/use-ride-request.tsx', (source) => {
  if (source.includes('APOIS_STOPS_REQUEST_V2')) return source;
  source = replaceRequired(source,
    '  const activeSubmissionRef =',
    '  const stopsSignatureRef = useRef<string>("");\n  const activeSubmissionRef =',
    'referência de paradas para idempotência');
  source = replaceRequired(source,
    '    const currentDestination = route?.destination ?? null;',
    '    const currentDestination = route?.destination ?? null;\n    const currentStopsSignature = JSON.stringify(route?.intermediates ?? []); // APOIS_STOPS_REQUEST_V2',
    'assinatura das paradas');
  source = replaceRequired(source,
    '!sameCoordinates(currentDestination, requestDataRef.current.destination) ||\n      selectedMethod !== requestDataRef.current.paymentMethod;',
    '!sameCoordinates(currentDestination, requestDataRef.current.destination) ||\n      selectedMethod !== requestDataRef.current.paymentMethod ||\n      currentStopsSignature !== stopsSignatureRef.current;',
    'invalidate request key quando paradas mudam');
  source = replaceRequired(source,
    '      requestDataRef.current = {',
    '      stopsSignatureRef.current = currentStopsSignature;\n      requestDataRef.current = {',
    'salvar assinatura de paradas');
  source = replaceRequired(source,
    '        destination: route.destination,\n        origin_name:',
    '        destination: route.destination,\n        intermediates: route.intermediates,\n        origin_name:',
    'enviar paradas ao backend');
  return source;
});

patch('src/types/rides/ride-request.ts', source => {
  if (source.includes('intermediates?: Array<{ lat: number; lng: number }>')) return source;
  return replaceRequired(source,
    '  duration_min?: number | null;',
    '  duration_min?: number | null;\n  intermediates?: Array<{ lat: number; lng: number }>;',
    'tipagem das paradas enviadas');
});
