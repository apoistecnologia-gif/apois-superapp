import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const script = resolve(root, 'scripts/harden-motorista-feature-flags-rejection.mjs');
const original = [
  'import { useEffect, useState } from "react";',
  'import { DISABLED_RIDE_FEATURE_FLAGS, fetchRideFeatureFlags } from "@/lib/rideFeatureFlags";',
  'export function useRideFeatureFlags() {',
  '  const [flags, setFlags] = useState(DISABLED_RIDE_FEATURE_FLAGS);',
  '  useEffect(() => {',
  '    let alive = true;',
  '    void fetchRideFeatureFlags().then((next) => {',
  '      if (alive) setFlags(next);',
  '    });',
  '    return () => {',
  '      alive = false;',
  '    };',
  '  }, []);',
  '  return flags;',
  '}',
  '',
].join('\n');

test('Falha de RPC de flags não gera promessa rejeitada sem tratamento', () => {
  const temp = mkdtempSync(resolve(tmpdir(), 'apois-flags-'));
  const file = resolve(temp, 'src/hooks/useRideFeatureFlags.ts');
  mkdirSync(dirname(file), { recursive: true });
  try {
    writeFileSync(file, original, 'utf8');
    const run = () => execFileSync(process.execPath, [script], {
      cwd: root, env: { ...process.env, APOIS_MOTORISTA_WORKSPACE: temp },
    });
    run();
    const hardened = readFileSync(file, 'utf8');
    assert.match(hardened, /\.catch\(\(error\) =>/);
    assert.match(hardened, /setFlags\(\{ \.\.\.DISABLED_RIDE_FEATURE_FLAGS \}\)/);
    assert.match(hardened, /if \(alive\) setFlags\(next\)/);
    run();
    assert.equal(readFileSync(file, 'utf8'), hardened, 'hardener precisa ser idempotente');
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
});

test('Os dois builds embutidos aplicam a proteção antes de compilar', () => {
  for (const path of ['scripts/build-motorista-module.mjs', 'scripts/build-partner-modules.sh']) {
    const content = readFileSync(resolve(root, path), 'utf8');
    assert.ok(content.includes('harden-motorista-feature-flags-rejection.mjs'), path);
    assert.ok(content.indexOf('harden-motorista-feature-flags-rejection.mjs') < content.indexOf('build:motorista'), path);
  }
});
