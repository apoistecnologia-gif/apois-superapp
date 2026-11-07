// Shim mínimo de Deno.test + assertEquals para rodar as suítes com Bun/Node,
// sem instalar Deno (indisponível no ambiente). Cada teste é coletado e o
// processo falha se qualquer asserção falhar — mesmo efeito do deno test.
import { readdirSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const tests = [];
globalThis.Deno = {
  test(name, fn) { tests.push([name, fn]); },
  env: { get: () => undefined },
  readTextFile: (path) => Promise.resolve(readFileSync(path, 'utf8')),
  readTextFileSync: (path) => readFileSync(path, 'utf8'),
  serve: () => {},
};

const dir = resolve('tests/unit');
for (const file of readdirSync(dir).filter((f) => f.endsWith('.test.ts'))) {
  await import(pathToFileURL(resolve(dir, file)).href);
}

let pass = 0;
const failures = [];
for (const [name, fn] of tests) {
  try { await fn(); pass += 1; }
  catch (error) { failures.push([name, error.message]); }
}

console.log(`pass ${pass}`);
console.log(`fail ${failures.length}`);
for (const [name, message] of failures) console.log(`  FAIL ${name}: ${message}`);
process.exit(failures.length ? 1 : 0);
