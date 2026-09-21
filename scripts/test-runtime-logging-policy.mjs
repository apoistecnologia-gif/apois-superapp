import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { auditRuntimeLogging, classifyLoggingPath, extractConsoleCalls, hardenRuntimeLogging } from './runtime-logging-policy.mjs';

assert.equal(classifyLoggingPath('src/app.ts'), 'runtime');
assert.equal(classifyLoggingPath('supabase/functions/pay/index.ts'), 'runtime');
assert.equal(classifyLoggingPath('scripts/build.mjs'), 'tooling');
assert.equal(classifyLoggingPath('tests/pay.test.ts'), 'tooling');
assert.equal(classifyLoggingPath('src/app.test.ts'), 'tooling');
assert.equal(extractConsoleCalls('console.log("ok");\nconsole.error("x", { status: 500 });').length, 2);

const root = mkdtempSync(resolve(tmpdir(), 'apois-log-audit-'));
try {
  mkdirSync(resolve(root, 'src'), { recursive: true });
  mkdirSync(resolve(root, 'scripts'), { recursive: true });
  writeFileSync(resolve(root, 'src', 'safe.ts'), 'console.error("ride.failed", { rideId: "r1", status: 502 });\n');
  writeFileSync(resolve(root, 'scripts', 'tool.mjs'), 'console.log(process.env.SERVICE_ROLE_KEY);\n');
  const safe = auditRuntimeLogging(root, { label: 'fixture-safe', failOnSensitive: true });
  assert.equal(safe.failures.length, 0);
  assert.equal(safe.runtimeCalls, 1);
  assert.equal(safe.toolingCalls, 1);

  writeFileSync(resolve(root, 'src', 'unsafe.ts'), 'console.error("auth", { authorization });\n');
  assert.throws(() => auditRuntimeLogging(root, { label: 'fixture-unsafe', failOnSensitive: true }), /unsafe runtime log/);
  rmSync(resolve(root, 'src', 'unsafe.ts'));

  mkdirSync(resolve(root, 'supabase/functions/request-ride'), { recursive: true });
  const rideFile = resolve(root, 'supabase/functions/request-ride/index.ts');
  writeFileSync(rideFile, 'if (!response.ok) console.error("[request-ride] push failed", response.status, await response.text());\n');
  hardenRuntimeLogging(root, 'fixture');
  const hardened = auditRuntimeLogging(root, { label: 'fixture-hardened', failOnSensitive: true });
  assert.equal(hardened.failures.length, 0);

  console.log('[OK] runtime logging policy tests passed');
} finally {
  rmSync(root, { recursive: true, force: true });
}
