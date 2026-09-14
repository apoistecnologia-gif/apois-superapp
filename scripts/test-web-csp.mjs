import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = mkdtempSync(resolve(tmpdir(), 'apois-csp-'));
const fixture = resolve(root, 'dist');
const moduleDir = resolve(fixture, 'modules/corridas');
const capacitor = resolve(root, 'capacitor.config.ts');
mkdirSync(moduleDir, { recursive: true });

const shellHtml = '<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0}</style></head><body><script>window.APOIS=true;</script><script src="./assets/app.js"></script></body></html>';
const moduleHtml = '<!doctype html><html><head><meta charset="utf-8"></head><body><script type="module">console.log("module")</script></body></html>';
writeFileSync(resolve(fixture, 'index.html'), shellHtml);
writeFileSync(resolve(moduleDir, 'index.html'), moduleHtml);
writeFileSync(capacitor, "export default { android: { allowMixedContent: false } };\n");

function run(script, args) {
  return spawnSync(process.execPath, [resolve('scripts', script), ...args], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });
}

try {
  const apply = run('apply-web-csp.mjs', [fixture]);
  if (apply.status !== 0) throw new Error(`apply failed:\n${apply.stdout}\n${apply.stderr}`);

  const verify = run('verify-web-csp.mjs', [fixture, capacitor]);
  if (verify.status !== 0) throw new Error(`verify failed:\n${verify.stdout}\n${verify.stderr}`);

  for (const file of [resolve(fixture, 'index.html'), resolve(moduleDir, 'index.html')]) {
    const html = readFileSync(file, 'utf8');
    if (!html.includes('Content-Security-Policy')) throw new Error(`${file}: CSP missing`);
    if (html.includes("'unsafe-eval'")) throw new Error(`${file}: unsafe-eval found`);
    if (/script-src[^;]*'unsafe-inline'/.test(html)) throw new Error(`${file}: unsafe-inline found in script-src`);
    if (!/script-src[^;]*'sha256-[A-Za-z0-9+/=]+'/.test(html)) throw new Error(`${file}: inline hash missing`);
  }

  // Prove that a post-build mutation invalidates the hash and is rejected.
  const moduleIndex = resolve(moduleDir, 'index.html');
  writeFileSync(moduleIndex, readFileSync(moduleIndex, 'utf8').replace('console.log("module")', 'console.log("tampered")'));
  const tampered = run('verify-web-csp.mjs', [fixture, capacitor]);
  if (tampered.status === 0) throw new Error('verifier accepted a mutated inline script');

  console.log('[OK] CSP fixture test passed: shell + module + tamper detection');
} finally {
  rmSync(root, { recursive: true, force: true });
}
