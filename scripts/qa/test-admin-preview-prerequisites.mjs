import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const previewBuilder = resolve(root, 'scripts/build-corridas-admin-spa-v1.mjs');
const browserAuditor = resolve(root, 'scripts/audit-admin-preview-render-v2.mjs');

test('Admin: workspace ausente produz diagnóstico explícito, sem ENOENT', () => {
  const temp = mkdtempSync(resolve(tmpdir(), 'apois-admin-'));
  try {
    const result = spawnSync(process.execPath, [previewBuilder], { cwd: temp, encoding: 'utf8' });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /\[BLOCKED\] Admin preview: workspace/);
    assert.doesNotMatch(result.stderr, /\bENOENT\b/);
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
});

test('Admin: auditor visual sem preview falha com instrução, não com TypeError', () => {
  const temp = mkdtempSync(resolve(tmpdir(), 'apois-admin-'));
  try {
    const result = spawnSync(process.execPath, [browserAuditor], {
      cwd: temp, encoding: 'utf8', env: { ...process.env, APOIS_PLAYWRIGHT_ROOT: '' },
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /\[BLOCKED\] Admin Corridas: preview não compilado/);
    assert.doesNotMatch(result.stderr, /\bERR_INVALID_ARG_TYPE\b/);
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
});
