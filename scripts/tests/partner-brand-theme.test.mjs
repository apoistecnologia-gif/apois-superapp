import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

test('Motorista aplica light sem depender de uma chamada light preexistente e preserva sessão/configurações', () => {
  const fixture = mkdtempSync(resolve(tmpdir(), 'apois-brand-theme-'));
  try {
    mkdirSync(resolve(fixture, 'src/lib'), { recursive: true });
    mkdirSync(resolve(fixture, 'src/routes'), { recursive: true });
    // Contrato do pin: não existe applyThemeClass("light") antes do hardener.
    const theme = `function resolveTheme(_mode) { return "dark"; }
function ThemeProvider() {
  // Apply on mode change
  useEffect(() => { const r = resolveTheme(mode); setResolved(r); applyThemeClass(r); }, [mode]);
  // Listen to system changes while in "system" mode
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => { const r = mq.matches ? "dark" : "light"; setResolved(r); applyThemeClass(r); };
    mq.addEventListener?.("change", handler);
    return () => mq.removeEventListener?.("change", handler);
  }, [mode]);

  // Sync from Supabase user preferences on auth/state change
  useEffect(() => { syncFromSupabase(); supabase.auth.onAuthStateChange(onAuthStateChange); }, []);
  return children;
}
`;
    const settings = 'export const settings = { navigation: "/motorista/app", logout: handleLogout, notifications: prefs.notifications };\n';
    writeFileSync(resolve(fixture, 'src/lib/theme.tsx'), theme);
    writeFileSync(resolve(fixture, 'src/routes/motorista.configuracoes.tsx'), settings);
    const run = () => spawnSync(process.execPath, [resolve(root, 'scripts/harden-partner-motorista-brand-theme.mjs')], {
      cwd: root, encoding: 'utf8', env: { ...process.env, APOIS_MOTORISTA_WORKSPACE: fixture },
    });
    const first = run();
    assert.equal(first.status, 0, first.stderr);
    const after = readFileSync(resolve(fixture, 'src/lib/theme.tsx'), 'utf8');
    assert.match(after, /applyThemeClass\("light"\);/);
    assert.doesNotMatch(after, /applyThemeClass\("dark"\);/);
    const sync = '  // Sync from Supabase user preferences on auth/state change';
    assert.equal(after.slice(after.indexOf(sync)), theme.slice(theme.indexOf(sync)));
    assert.equal(readFileSync(resolve(fixture, 'src/routes/motorista.configuracoes.tsx'), 'utf8'), settings);
    const second = run();
    assert.equal(second.status, 0, second.stderr);
    assert.equal(readFileSync(resolve(fixture, 'src/lib/theme.tsx'), 'utf8'), after);
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});
