import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

function fail(message) {
  throw new Error(`[FAIL] cancellation policy: ${message}`);
}

const servicePath = resolve('.work/corridas/src/services/rides/active-ride-service.ts');
let service = readFileSync(servicePath, 'utf8');

const oldAvailability = 'canCancel: ["procurar_motorista", "motorista_a_caminho"].includes(status),';
const newAvailability = 'canCancel: ["procurar_motorista", "motorista_a_caminho", "motorista_chegou"].includes(status),';
if (service.includes(oldAvailability)) {
  service = service.replace(oldAvailability, newAvailability);
}
if (!service.includes(newAvailability)) {
  fail('regra de disponibilidade do cancelamento não encontrada');
}
if (service.includes('canCancel: ["procurar_motorista", "motorista_a_caminho", "motorista_chegou", "em_viagem"')) {
  fail('em_viagem não pode permitir cancelamento');
}
writeFileSync(servicePath, service, 'utf8');

const dialogPath = resolve('.work/corridas/src/components/rides/active/CancellationDialog.tsx');
let dialog = readFileSync(dialogPath, 'utf8');
const oldDescription = `            Se você cancelar agora, poderá ser aplicada uma taxa de cancelamento caso o motorista já\n            esteja próximo.`;
const newDescription = `            Você pode cancelar até antes do início da corrida. Após 2 minutos do aceite, a taxa é\n            calculada pelo deslocamento do motorista; se ele já chegou ao embarque, aplica-se a taxa máxima.`;
if (dialog.includes(oldDescription)) {
  dialog = dialog.replace(oldDescription, newDescription);
}
const oldHelp = '              Taxas de cancelamento ajudam a compensar o tempo e combustível do motorista parceiro.';
const newHelp = '              Regra APOIS: R$ 5,00 + R$ 1,00 por km percorrido pelo motorista, limitada a R$ 15,00. Se o motorista já chegou ao embarque, a taxa é R$ 15,00.';
if (dialog.includes(oldHelp)) {
  dialog = dialog.replace(oldHelp, newHelp);
}
for (const required of ['Após 2 minutos do aceite', 'R$ 5,00 + R$ 1,00 por km', 'limitada a R$ 15,00']) {
  if (!dialog.includes(required)) fail(`texto de política ausente: ${required}`);
}
writeFileSync(dialogPath, dialog, 'utf8');

const routePath = resolve('.work/corridas/src/routes/_authenticated.corrida.$rideId.tsx');
let route = readFileSync(routePath, 'utf8');
const openNeedle = 'isOpen={isCancelDialogOpen}';
if (route.includes(openNeedle)) {
  route = route.replace(openNeedle, 'isOpen={Boolean(actionAvailability?.canCancel && isCancelDialogOpen)}');
}
if (!route.includes('isOpen={Boolean(actionAvailability?.canCancel && isCancelDialogOpen)}')) {
  fail('diálogo não está protegido pelo status atual');
}
writeFileSync(routePath, route, 'utf8');

console.log('[OK] Passageiro: cancelamento permitido até motorista_chegou, bloqueado em em_viagem e política progressiva exibida.');
