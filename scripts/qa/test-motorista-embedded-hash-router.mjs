import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const hardener = resolve(root, 'scripts/harden-motorista-embedded-hash-router.mjs');

const original = [
  'import { createRouter, RouterProvider } from "@tanstack/react-router";',
  'export function bootstrap() {',
  '  const router = createRouter({',
  '    routeTree,',
  '    context: { queryClient },',
  '  });',
  '  return router;',
  '}',
  '',
].join('\n');

function fixture(testFn) {
  const temp = mkdtempSync(resolve(tmpdir(), 'apois-driver-router-'));
  const file = resolve(temp, 'src/mobile.tsx');
  mkdirSync(dirname(file), { recursive: true });
  try {
    testFn({ temp, file });
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
}

function run(workspace) {
  execFileSync(process.execPath, [hardener], {
    cwd: root,
    env: { ...process.env, APOIS_MOTORISTA_WORKSPACE: workspace },
    encoding: 'utf8',
  });
}

test('Motorista embutido: configura hash history e preserva as outras opções', () => {
  fixture(({ temp, file }) => {
    writeFileSync(file, original, 'utf8');
    run(temp);
    const after = readFileSync(file, 'utf8');
    assert.match(after, /import \{ createHashHistory, createRouter, RouterProvider \} from "@tanstack\/react-router";/);
    assert.match(after, /const router = createRouter\(\{\s*history: createHashHistory\(\),/);
    assert.match(after, /routeTree,/);
    assert.match(after, /context: \{ queryClient \},/);
    run(temp);
    assert.equal(readFileSync(file, 'utf8'), after, 'segunda execução deve ser idempotente');
    assert.equal((after.match(/history: createHashHistory\(\)/g) ?? []).length, 1);
  });
});

test('Motorista embutido: falha fechado quando o contrato do roteador muda', () => {
  fixture(({ temp, file }) => {
    writeFileSync(file, original.replace('createRouter({', 'createRouterWithContext({'), 'utf8');
    assert.throws(() => run(temp));
    assert.equal(readFileSync(file, 'utf8').includes('createHashHistory'), false);
  });
});

test('Ambos os builds embutidos aplicam o hardener antes de compilar', () => {
  const isolated = readFileSync(resolve(root, 'scripts/build-motorista-module.mjs'), 'utf8');
  const partner = readFileSync(resolve(root, 'scripts/build-partner-modules.sh'), 'utf8');
  const apply = 'harden-motorista-embedded-hash-router.mjs';
  assert.ok(isolated.indexOf(apply) >= 0 && isolated.indexOf(apply) < isolated.indexOf("run('bun', ['install']"));
  assert.ok(partner.indexOf(apply) > partner.indexOf('harden-partner-motorista-mobile-base.mjs'));
  assert.ok(partner.indexOf(apply) < partner.indexOf('npm run build:motorista'));
  assert.ok(isolated.includes('harden-partner-motorista-mobile-base.mjs'), 'o RootShell SSR também precisa ser isolado');
  assert.ok(isolated.indexOf('harden-partner-motorista-mobile-base.mjs') < isolated.indexOf(apply));
  assert.match(isolated, /const authStorageKey='sb-vqtucstyduxrqjgyigfk-auth-token'/, 'a ponte deve ler a chave padrão do Supabase Corridas');
});
