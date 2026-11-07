import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inspectSource } from './lib/source-git.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const modules = [
  ['APOIS Entregas', 'sources/apois-entregas'],
  ['APOIS Corridas Passageiro', 'sources/apois-corridas-passageiro'],
  ['APOIS Corridas Motorista/Admin', 'sources/apois-corridas-motorista-admin'],
];

const lock = JSON.parse(readFileSync(resolve(root, '.apois/source-lock.json'), 'utf8'));
const pins = {
  'sources/apois-entregas': lock.sources?.entregas?.commit,
  'sources/apois-corridas-passageiro': lock.sources?.corridas_passageiro?.commit,
  'sources/apois-corridas-motorista-admin': lock.sources?.corridas_motorista_admin?.commit,
};

for (const [label, path] of modules) {
  const source = inspectSource(root, path);
  const pinned = pins[path] ?? 'ausente';

  if (source.state === 'uninitialized') {
    console.log(`${label}: não inicializado (pin ${pinned.slice(0, 12)})`);
    continue;
  }
  if (source.state === 'broken') {
    console.log(`${label}: diretório inválido — não é um snapshot Git (pin ${pinned.slice(0, 12)})`);
    continue;
  }

  const head = source.commit.slice(0, 12);
  const drift = source.commit === pins[path] ? '' : ` — DIVERGE do pin ${pinned.slice(0, 12)}`;
  console.log(`${label}: ${head}${source.dirty ? ' (alterado localmente)' : ' (limpo)'}${drift}`);
}
