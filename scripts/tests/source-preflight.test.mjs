import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { DEFAULT_SOURCE_SPECS, runSourcePreflight } from '../lib/source-preflight.mjs';

const PINS = {
  entregas: '1111111111111111111111111111111111111111',
  corridas_passageiro: '2222222222222222222222222222222222222222',
  corridas_motorista_admin: '3333333333333333333333333333333333333333',
};

function silentLogger() {
  return { log() {}, warn() {}, error() {} };
}

function write(root, relative, content = 'x') {
  const full = join(root, relative);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, content, 'utf8');
}

function populateSource(root, spec) {
  mkdirSync(join(root, spec.path), { recursive: true });
  for (const sentinel of spec.sentinels) {
    const target = join(spec.path, sentinel.path);
    if (sentinel.type === 'dir') {
      mkdirSync(join(root, target), { recursive: true });
      write(root, join(target, 'sentinel.txt'), 'ready');
    } else if (sentinel.json) {
      write(root, target, JSON.stringify({ name: spec.key, private: true }));
    } else {
      write(root, target, 'sentinel');
    }
  }
}

function makeRoot({ withGit = true } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'apois-source-preflight-'));
  write(root, '.apois/source-lock.json', JSON.stringify({
    sources: Object.fromEntries(Object.entries(PINS).map(([key, commit]) => [key, { commit }])),
  }));
  write(root, '.gitmodules', DEFAULT_SOURCE_SPECS.map((spec) => [
    `[submodule "${spec.path}"]`,
    `\tpath = ${spec.path}`,
    `\turl = https://example.invalid/${spec.key}.git`,
  ].join('\n')).join('\n'));
  if (withGit) mkdirSync(join(root, '.git'), { recursive: true });
  for (const spec of DEFAULT_SOURCE_SPECS) populateSource(root, spec);
  return root;
}

function correctGitStatus(_root, sourcePath) {
  const spec = DEFAULT_SOURCE_SPECS.find((item) => item.path === sourcePath);
  return ` ${PINS[spec.key]} ${sourcePath} (heads/test)\n`;
}

function removeRoot(root) {
  rmSync(root, { recursive: true, force: true });
}

test('1. sources completos passam com metadata Git e pins corretos', () => {
  const root = makeRoot();
  try {
    const result = runSourcePreflight({ root, gitStatusProvider: correctGitStatus, logger: silentLogger() });
    assert.equal(result.ok, true);
    assert.equal(result.errors.length, 0);
    assert.equal(result.warnings.length, 0);
    assert.deepEqual(result.results.map((item) => item.source), ['complete', 'complete', 'complete']);
    assert.deepEqual(result.results.map((item) => item.pin), ['verified', 'verified', 'verified']);
  } finally {
    removeRoot(root);
  }
});

test('2. source vazio falha cedo como SOURCE_EMPTY', () => {
  const root = makeRoot();
  try {
    const target = DEFAULT_SOURCE_SPECS[1];
    rmSync(join(root, target.path), { recursive: true, force: true });
    mkdirSync(join(root, target.path), { recursive: true });
    const result = runSourcePreflight({ root, gitStatusProvider: correctGitStatus, logger: silentLogger() });
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((issue) => issue.key === target.key && issue.code === 'SOURCE_EMPTY'));
  } finally {
    removeRoot(root);
  }
});

test('3. source inexistente falha como SOURCE_MISSING', () => {
  const root = makeRoot();
  try {
    const target = DEFAULT_SOURCE_SPECS[2];
    rmSync(join(root, target.path), { recursive: true, force: true });
    const result = runSourcePreflight({ root, gitStatusProvider: correctGitStatus, logger: silentLogger() });
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((issue) => issue.key === target.key && issue.code === 'SOURCE_MISSING'));
  } finally {
    removeRoot(root);
  }
});

test('4. export sem .git aceita sources completos e marca pins como não verificáveis', () => {
  const root = makeRoot({ withGit: false });
  try {
    const result = runSourcePreflight({
      root,
      gitStatusProvider() { throw new Error('não deve chamar Git em export'); },
      logger: silentLogger(),
    });
    assert.equal(result.ok, true);
    assert.equal(result.rootGitMetadata, false);
    assert.equal(result.errors.length, 0);
    assert.equal(result.warnings.length, DEFAULT_SOURCE_SPECS.length);
    assert.ok(result.warnings.every((issue) => issue.code === 'PIN_UNVERIFIABLE_NO_GIT_METADATA'));
    assert.ok(result.results.every((item) => item.source === 'complete'));
  } finally {
    removeRoot(root);
  }
});

test('5. submodule disponível com commit incorreto falha como PIN_MISMATCH', () => {
  const root = makeRoot();
  try {
    const wrong = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    const result = runSourcePreflight({
      root,
      gitStatusProvider(_root, sourcePath) {
        const spec = DEFAULT_SOURCE_SPECS.find((item) => item.path === sourcePath);
        const commit = spec.key === 'corridas_passageiro' ? wrong : PINS[spec.key];
        return ` ${commit} ${sourcePath} (heads/test)\n`;
      },
      logger: silentLogger(),
    });
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((issue) => issue.key === 'corridas_passageiro' && issue.code === 'PIN_MISMATCH'));
  } finally {
    removeRoot(root);
  }
});
