import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

function fail(message) {
  throw new Error(`[FAIL] cancellation policy: ${message}`);
}

const servicePath = resolve('.work/corridas/src/services/rides/active-ride-service.ts');
let service = readFileSync(servicePath, 'utf8');

// No pin atual o pagamento é resolvido antes/na criação da corrida; não existe
// o estado frontend aguardando_pagamento. O passageiro pode cancelar até o
// motorista chegar ao embarque, nunca depois de iniciar a viagem.
const hardenedAvailability = 'canCancel: ["procurar_motorista", "motorista_a_caminho", "motorista_chegou"].includes(status),';
service = service.replace(
  /canCancel:\s*\[[^\]]*\]\.includes\(status\),/,
  hardenedAvailability,
);
if (!service.includes(hardenedAvailability)) fail('regra de disponibilidade não encontrada');
if (/canCancel:\s*\[[^\]]*"em_viagem"[^\]]*\]\.includes\(status\),/.test(service)) {
  fail('em_viagem não pode permitir cancelamento');
}
writeFileSync(servicePath, service, 'utf8');

const dialogPath = resolve('.work/corridas/src/components/rides/active/CancellationDialog.tsx');
let dialog = readFileSync(dialogPath, 'utf8');
const ruleText = 'Regra APOIS: R$ 5,00 + R$ 1,00 por km percorrido pelo motorista, limitada a R$ 15,00. Se o motorista já chegou ao embarque, a taxa é R$ 15,00.';
if (!dialog.includes(ruleText)) {
  const insertion = `\n        <p className="rounded-xl border border-apois-yellow/20 bg-apois-yellow/5 px-3 py-2 text-[11px] leading-5 text-zinc-400">\n          ${ruleText}\n        </p>\n`;
  const actionMarkers = [
    '<DialogFooter className="flex flex-col gap-2 mt-2">',
    '<DialogFooter',
    '<div className="flex gap-3">',
  ];
  const foundMarker = actionMarkers
    .map((marker) => ({ marker, index: dialog.indexOf(marker) }))
    .find(({ index }) => index >= 0);
  if (!foundMarker) fail('área de ações do diálogo não encontrada');
  dialog = dialog.slice(0, foundMarker.index) + insertion + dialog.slice(foundMarker.index);
}
if (!dialog.includes(ruleText)) fail('texto da política não foi inserido no diálogo');
writeFileSync(dialogPath, dialog, 'utf8');

const routePath = resolve('.work/corridas/src/routes/_authenticated.corrida.$rideId.tsx');
let route = readFileSync(routePath, 'utf8');
route = route.replace(
  'isOpen={isCancelDialogOpen}',
  'isOpen={Boolean(actionAvailability?.canCancel && isCancelDialogOpen)}',
);
if (!route.includes('isOpen={Boolean(actionAvailability?.canCancel && isCancelDialogOpen)}')) {
  fail('diálogo não está protegido pelo status atual');
}
writeFileSync(routePath, route, 'utf8');

console.log('[OK] Passageiro: cancelamento limitado aos estados pré-viagem do snapshot atual e política exibida.');
