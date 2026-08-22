import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

function fail(message) {
  throw new Error(`[FAIL] cancellation policy: ${message}`);
}

const servicePath = resolve('.work/corridas/src/services/rides/active-ride-service.ts');
let service = readFileSync(servicePath, 'utf8');

const hardenedAvailability = 'canCancel: ["aguardando_pagamento", "procurar_motorista", "motorista_a_caminho", "motorista_chegou"].includes(status),';
service = service.replace(
  /canCancel:\s*\[[^\]]*\]\.includes\(status\),/,
  hardenedAvailability,
);
if (!service.includes(hardenedAvailability)) {
  fail('regra de disponibilidade do cancelamento não encontrada');
}
if (/canCancel:\s*\[[^\]]*"em_viagem"[^\]]*\]\.includes\(status\),/.test(service)) {
  fail('em_viagem não pode permitir cancelamento');
}
writeFileSync(servicePath, service, 'utf8');

const dialogPath = resolve('.work/corridas/src/components/rides/active/CancellationDialog.tsx');
let dialog = readFileSync(dialogPath, 'utf8');

// A fonte protegida atual já usa um diálogo dinâmico baseado em RPC e não contém
// mais os textos legados que este hardener substituía. Em vez de depender de uma
// frase antiga específica, normalizamos a descrição atual e acrescentamos a regra
// comercial de forma idempotente, preservando o cálculo/estado dinâmico existente.
const policyDescription = `            Você pode cancelar até antes do início da corrida. Após 2 minutos do aceite, a taxa é\n            calculada pelo deslocamento do motorista; se ele já chegou ao embarque, aplica-se a taxa máxima.`;

for (const candidate of [
  `            Se você cancelar agora, poderá ser aplicada uma taxa de cancelamento caso o motorista já\n            esteja próximo.`,
  '            Informe o motivo e confira a regra vigente antes de confirmar.',
]) {
  if (dialog.includes(candidate)) {
    dialog = dialog.replace(candidate, policyDescription);
    break;
  }
}

const oldHelp = '              Taxas de cancelamento ajudam a compensar o tempo e combustível do motorista parceiro.';
const policyHelp = '              Regra APOIS: R$ 5,00 + R$ 1,00 por km percorrido pelo motorista, limitada a R$ 15,00. Se o motorista já chegou ao embarque, a taxa é R$ 15,00.';
if (dialog.includes(oldHelp)) {
  dialog = dialog.replace(oldHelp, policyHelp);
}
if (!dialog.includes('R$ 5,00 + R$ 1,00 por km')) {
  const sectionNeedle = '          <section className="rounded-2xl border border-white/8 bg-zinc-900/70 p-4">';
  const sectionEnd = '          </section>';
  const start = dialog.indexOf(sectionNeedle);
  const end = start >= 0 ? dialog.indexOf(sectionEnd, start) : -1;
  if (start < 0 || end < 0) fail('bloco de política do diálogo não encontrado');
  const insertAt = end + sectionEnd.length;
  const infoBlock = `\n\n          <p className="rounded-xl border border-apois-yellow/20 bg-apois-yellow/5 px-3 py-2 text-[11px] leading-5 text-zinc-400">\n            Regra APOIS: R$ 5,00 + R$ 1,00 por km percorrido pelo motorista, limitada a R$ 15,00. Se o motorista já chegou ao embarque, a taxa é R$ 15,00.\n          </p>`;
  dialog = dialog.slice(0, insertAt) + infoBlock + dialog.slice(insertAt);
}

for (const required of ['Após 2 minutos do aceite', 'R$ 5,00 + R$ 1,00 por km', 'limitada a R$ 15,00']) {
  if (!dialog.includes(required)) fail(`texto de política ausente: ${required}`);
}
writeFileSync(dialogPath, dialog, 'utf8');

const routePath = resolve('.work/corridas/src/routes/_authenticated.corrida.$rideId.tsx');
let route = readFileSync(routePath, 'utf8');
const hardenedOpen = 'isOpen={Boolean(actionAvailability?.canCancel && isCancelDialogOpen)}';
if (!route.includes(hardenedOpen)) {
  const openNeedle = 'isOpen={isCancelDialogOpen}';
  if (route.includes(openNeedle)) {
    route = route.split(openNeedle).join(hardenedOpen);
  }
}
if (!route.includes(hardenedOpen)) {
  fail('diálogo não está protegido pelo status atual');
}
writeFileSync(routePath, route, 'utf8');

console.log('[OK] Passageiro: cancelamento permitido de aguardando_pagamento até motorista_chegou, bloqueado em em_viagem e política progressiva exibida.');
