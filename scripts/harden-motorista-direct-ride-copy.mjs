import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const workspace = process.env.APOIS_MOTORISTA_WORKSPACE || '.work/motorista';
const appPath = resolve(root, workspace, 'src/routes/motorista.app.tsx');
let source = readFileSync(appPath, 'utf8');

source = source
  .replaceAll('Pagamento confirmado. Siga até o ponto de embarque.', 'Corrida aceita. Siga até o ponto de embarque.')
  .replaceAll('Pagamento efetuado. Siga até o embarque em ${pickupVoice}.', 'Corrida aceita. Siga até o embarque em ${pickupVoice}.')
  .replaceAll('Pagamento efetuado. Siga até o embarque.', 'Corrida aceita. Siga até o embarque.');

// O estado aguardando_pagamento pertence ao fluxo Pix legado. Sem gateway ativo,
// ele não pode controlar a jornada do Motorista no release atual.
source = source
  .replaceAll('"aguardando_pagamento", ', '')
  .replaceAll('"aguardando_pagamento",', '')
  .replaceAll('r.status === "aguardando_pagamento" || ', '')
  .replaceAll('active.status !== "aguardando_pagamento" && ', '');

// Caso um hardener legado tenha injetado o card visual inteiro, falhe em vez de
// tentar apagá-lo por regex e correr o risco de produzir JSX inválido.
for (const forbidden of [
  'Aguardando pagamento do passageiro',
  'mercadopago-create-ride-pix',
  'Pagamento efetuado. Siga até o embarque',
  'Pagamento confirmado. Siga até o ponto de embarque.',
]) {
  if (source.includes(forbidden)) {
    throw new Error(`[FAIL] motorista: fluxo de corrida ainda contém dependência de gateway legado (${forbidden})`);
  }
}

for (const required of [
  'Corrida aceita. Siga até o ponto de embarque.',
  'motorista_a_caminho',
  'motorista_chegou',
  'em_viagem',
]) {
  if (!source.includes(required)) {
    throw new Error(`[FAIL] motorista: contrato da jornada direta mudou (${required})`);
  }
}

writeFileSync(appPath, source, 'utf8');
console.log(`[OK] motorista: jornada da corrida usa linguagem neutra sem gateway em ${workspace}`);
