import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { auditRuntimeLogging } from './runtime-logging-policy.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(readFileSync(resolve(root, '.apois/modules.json'), 'utf8'));
const requested = process.argv.slice(2);
const names = requested.length ? requested : Object.keys(manifest.modules);
let audited = 0;

for (const name of names) {
  const config = manifest.modules[name];
  if (!config) {
    console.error(`[LOG-FAIL] unknown module: ${name}`);
    process.exitCode = 1;
    continue;
  }
  const workspace = resolve(root, config.workspace);
  if (!existsSync(workspace)) {
    console.error(`[LOG-FAIL] ${name}: workspace missing (${config.workspace}); run prepare/build first`);
    process.exitCode = 1;
    continue;
  }
  auditRuntimeLogging(workspace, { label: name, failOnSensitive: true });
  audited += 1;
}

if (audited > 0 && !process.exitCode) console.log(`[OK] runtime logging audit passed for ${audited} module(s)`);
