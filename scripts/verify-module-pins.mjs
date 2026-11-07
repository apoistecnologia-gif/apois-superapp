import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { indexSubmoduleCommit, inspectSource } from './lib/source-git.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const lock = JSON.parse(readFileSync(resolve(root, '.apois/source-lock.json'), 'utf8'));
const modules = [
  ['entregas', 'sources/apois-entregas'],
  ['corridas_passageiro', 'sources/apois-corridas-passageiro'],
  ['corridas_motorista_admin', 'sources/apois-corridas-motorista-admin'],
];

let failed = false;

for (const [key, path] of modules) {
  const expected = lock.sources?.[key]?.commit;
  if (!expected) {
    console.error(`[FAIL] ${key}: commit fixado ausente em .apois/source-lock.json`);
    failed = true;
    continue;
  }

  const source = inspectSource(root, path);

  if (source.state === 'broken') {
    console.error(`[FAIL] ${key}: ${path} não é um snapshot Git válido. Rode npm run sources:clone.`);
    failed = true;
    continue;
  }

  if (source.state === 'uninitialized') {
    // Antes de `git submodule update --init`, o diretório é vazio e o único
    // registro do commit é o gitlink do índice. Sem esta checagem o
    // `git -C sources/<modulo> rev-parse HEAD` lia o HEAD do próprio Superapp
    // e reprovava (ou aprovava) o snapshot pelo commit errado.
    const pinned = indexSubmoduleCommit(root, path);
    if (pinned !== expected) {
      console.error(`[FAIL] ${key}: gitlink do índice ${pinned ?? 'ausente'} != ${expected}`);
      failed = true;
    } else {
      console.log(`[OK] ${key}: ${expected} (fixado no índice; snapshot não inicializado)`);
    }
    continue;
  }

  if (source.commit !== expected) {
    console.error(`[FAIL] ${key}: ${source.commit} != ${expected}`);
    failed = true;
    continue;
  }

  if (source.dirty) {
    console.error(`[FAIL] ${key}: snapshot ${source.commit} possui alterações locais em ${path}`);
    failed = true;
    continue;
  }

  console.log(`[OK] ${key}: ${source.commit}`);
}

process.exit(failed ? 1 : 0);
