import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, relative, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const read = path => readFileSync(path, 'utf8');

function snapshot(directory, base = directory, result = {}) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) snapshot(path, base, result);
    else result[relative(base, path)] = readFileSync(path).toString('base64');
  }
  return result;
}

for (const [target, workspace, stylesheet] of [
  ['corridas', '.work/corridas', 'src/styles.css'],
  ['entregas', '.work/entregas', 'src/customer-theme.css'],
  ['entregador', '.work/partner-entregador', 'src/system-theme.css'],
  ['motorista', '.work/partner-motorista', 'src/apois-motorista-theme.css'],
  ['admin', '.work/admin', 'src/apois-admin-theme.css'],
]) {
  test(`${target}: estados primários, semântica, contratos e segunda aplicação estável`, () => {
    const fixture = mkdtempSync(resolve(tmpdir(), 'apois-brand-applicator-'));
    try {
      cpSync(resolve(root, 'design-system'), resolve(fixture, 'design-system'), { recursive: true });
      mkdirSync(resolve(fixture, 'superapp/branding'), { recursive: true });
      for (const asset of ['apois-wordmark-v3.svg', 'apois-mark-v3.svg']) {
        cpSync(resolve(root, 'superapp/branding', asset), resolve(fixture, 'superapp/branding', asset));
      }
      const ws = resolve(fixture, workspace);
      mkdirSync(resolve(ws, 'src/hooks'), { recursive: true });
      mkdirSync(resolve(ws, 'public'), { recursive: true });
      writeFileSync(resolve(ws, stylesheet), '/* tema existente preservado */\n');
      if (target === 'entregas') writeFileSync(resolve(ws, 'src/system-theme.css'), '/* tema sistema */\n');
      const operational = 'export const status = { online: "#16A34A", warning: "#F59E0B", info: "#2563EB" };\nexport const google = ["#4285F4", "#34A853", "#FBBC05", "#EA4335"];\nexport const actions = { onSubmit: handleLogin, onAccept: handleAccept, request_key: "unchanged" };\n';
      const session = 'export const session = useSession();\nexport const channel = subscribeRealtime(session);\n';
      writeFileSync(resolve(ws, 'src/contracts.ts'), operational);
      writeFileSync(resolve(ws, 'src/hooks/use-session.ts'), session);
      const run = () => spawnSync(process.execPath, [resolve(root, 'scripts/apply-apois-brand-v2.mjs'), target], {
        cwd: fixture, encoding: 'utf8', env: {
          ...process.env, APOIS_MOTORISTA_WORKSPACE: workspace,
          APOIS_ADMIN_WORKSPACE: workspace, APOIS_ENTREGAS_WORKSPACE: workspace,
        },
      });
      const first = run();
      assert.equal(first.status, 0, first.stderr);
      const css = read(resolve(ws, stylesheet));
      assert.match(css, /APOIS_PRIMARY_CONTROL_STATES/);
      assert.match(css, /background-color: var\(--apois-surface-secondary\) !important/);
      assert.match(css, /color: var\(--apois-text-disabled\) !important/);
      assert.match(css, /:not\(:disabled\):not\(\[aria-disabled="true"\]\):active/);
      assert.match(css, /--apois-primary-pressed: #A90F15/);
      assert.match(css, /:not\(\.gm-style \*\)/);
      assert.equal(read(resolve(ws, 'src/contracts.ts')), operational);
      assert.equal(read(resolve(ws, 'src/hooks/use-session.ts')), session);
      assert.equal(read(resolve(ws, 'public/apois-mark-v3.svg')), read(resolve(root, 'superapp/branding/apois-mark-v3.svg')));
      if (target === 'motorista') {
        assert.match(css, /APOIS_DRIVER_BRAND_DETAILS/);
        assert.match(css, /\[class~="bg-\[#F6BE1C\]\/8"\].*var\(--apois-primary\) 8%/);
        assert.match(css, /\[class~="border-\[#F6BE1C\]\/25"\].*var\(--apois-primary\) 25%/);
      }
      const after = snapshot(ws);
      const second = run();
      assert.equal(second.status, 0, second.stderr);
      assert.deepEqual(snapshot(ws), after);
    } finally {
      rmSync(fixture, { recursive: true, force: true });
    }
  });
}

for (const target of ['shell-client', 'shell-partner']) {
  test(`${target}: script/rotas preservados e estado disabled prevalece sobre hover`, () => {
    const fixture = mkdtempSync(resolve(tmpdir(), 'apois-brand-shell-'));
    try {
      cpSync(resolve(root, 'design-system'), resolve(fixture, 'design-system'), { recursive: true });
      const path = resolve(fixture, 'index.html');
      const script = '<script>const route = "#/login"; button.onclick = enterExistingModule;</script>';
      writeFileSync(path, `<html><head><meta name="theme-color" content="#FFFFFF" /></head><body><button class="action" disabled>Entrar</button>${script}</body></html>`);
      const run = () => spawnSync(process.execPath, [resolve(root, 'scripts/apply-apois-brand-v2.mjs'), target, path], { cwd: fixture, encoding: 'utf8' });
      const first = run();
      assert.equal(first.status, 0, first.stderr);
      const after = read(path);
      assert.ok(after.includes(script));
      assert.ok(after.indexOf('.action:is(:disabled') > after.indexOf('.action:hover'));
      assert.match(after, /--apois-primary-pressed:#A90F15/);
      assert.match(after, /background:var\(--apois-surface-secondary\)!important/);
      const second = run();
      assert.equal(second.status, 0, second.stderr);
      assert.equal(read(path), after);
    } finally {
      rmSync(fixture, { recursive: true, force: true });
    }
  });
}
