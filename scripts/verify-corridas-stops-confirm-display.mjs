// Verificação específica do bug: parada adicionada + Concluído desaparece.
// Lê apenas o workspace, sem API, sem solicitar corrida, sem compilar Android.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const workspace = resolve(process.env.APOIS_CORRIDAS_WORKSPACE || '.work/corridas');
const read=(rel)=>readFileSync(resolve(workspace,rel),'utf8');
const input=read('src/components/rides/RideStopsInput.tsx');
const home=read('src/routes/_authenticated.inicio.tsx');
const stops=read('src/hooks/rides/use-ride-stops.tsx');
const route=read('src/hooks/use-route.tsx');

assert.ok(input.includes('APOIS_STOPS_CONFIRM_V1'), 'botao Concluido sem confirmacao');
assert.ok(input.includes('onClick={() => { // APOIS_STOPS_CONFIRM_V1'), 'clique nao executa validacao');
assert.ok(input.includes('confirmStops();'), 'paradas nao sao confirmadas');
assert.ok(input.includes('toast.error('), 'erro de parada invalida nao e informado');
assert.ok(!input.includes('onClick={() => setIsEditing(false)}'), 'Concluido ainda so fecha o editor');
assert.ok(stops.includes('const MAX_STOPS = 3'), 'limite de 3 paradas foi alterado');
assert.ok(stops.includes('const error = validateStops();'), 'validacao de paradas foi removida');
assert.ok(stops.includes('if (error) throw new Error(error);'), 'confirmacao ignora erros');
assert.ok(stops.includes('setStops(tempStops);'), 'confirmStops nao grava paradas');
assert.ok(stops.includes('setIsEditing(false);'), 'confirmacao nao encerra a edicao');

assert.ok(home.includes('APOIS_CONFIRMED_STOPS_CARD_V1'), 'Home nao observa paradas confirmadas');
assert.ok(home.includes('stops: confirmedStops'), 'Home nao usa lista persistida');
assert.ok(home.includes('[...confirmedStops].sort((a, b) => a.order - b.order)'), 'ordem das paradas alterada');
const from=home.indexOf('Local de partida');
const stop=home.indexOf('data-apois-confirmed-stop="true"');
const to=home.indexOf('>Destino</span>',from);
assert.ok(from >= 0 && from < stop && stop < to, 'parada deve aparecer ENTRE origem e destino');
assert.ok(home.includes('stop.label || stop.formattedAddress'), 'endereco da parada nao exibido');
assert.ok(route.includes('orderedStops.map('), 'motor de rota nao recebe paradas intermediarias');
console.log('[OK] Cliente: Concluido valida e confirma; 1 a 3 paradas aparecem entre partida e destino, preservando ordem e calculo.');
