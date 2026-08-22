import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const workspace = process.env.APOIS_ENTREGAS_WORKSPACE || '.work/partner-entregador';
const path = resolve(root, workspace, 'src/routes/courier.tsx');
let source = readFileSync(path, 'utf8');

const oldCall = `        const { error: locationError } = await rpc("update_courier_location", {\n          _latitude: initialPosition.lat,\n          _longitude: initialPosition.lng,\n          _accuracy_meters: initialPosition.accuracy,\n          _heading: initialPosition.heading,\n          _speed_mps: initialPosition.speed,\n        });`;
const newCall = `        // O entregador ainda está offline neste ponto. update_courier_location\n        // exige disponibilidade online e criava um deadlock: era impossível\n        // gravar o GPS necessário para passar pela validação de set_courier_online.\n        // O bootstrap é restrito a entregador autenticado, aprovado e ativo.\n        const { error: locationError } = await rpc("bootstrap_courier_location", {\n          _latitude: initialPosition.lat,\n          _longitude: initialPosition.lng,\n          _accuracy_meters: initialPosition.accuracy,\n          _heading: initialPosition.heading,\n          _speed_mps: initialPosition.speed,\n        });`;
if (source.includes(oldCall)) source = source.replace(oldCall, newCall);

for (const marker of [
  'rpc("bootstrap_courier_location"',
  'O entregador ainda está offline neste ponto.',
  'const { error: onlineError } = await rpc("set_courier_online"',
]) {
  if (!source.includes(marker)) throw new Error(`[FAIL] Entregador Parceiro: bootstrap online incompleto (${marker}).`);
}

const toggleStart = source.indexOf('  const toggleOnline = async () => {');
const toggleEnd = source.indexOf('\n  const acceptOffer = async', toggleStart);
const toggleBlock = toggleStart >= 0 && toggleEnd > toggleStart ? source.slice(toggleStart, toggleEnd) : '';
if (!toggleBlock) throw new Error('[FAIL] Entregador Parceiro: toggleOnline não encontrado.');
if (toggleBlock.includes('rpc("update_courier_location"')) {
  throw new Error('[FAIL] Entregador Parceiro: ficar online ainda tenta atualizar localização com RPC que exige estado online.');
}

writeFileSync(path, source, 'utf8');
console.log('[OK] Entregador Parceiro: GPS inicial é gravado por bootstrap seguro antes de ativar disponibilidade, eliminando o deadlock do botão Ficar online.');
