import { spawn, spawnSync } from 'node:child_process';
import { chromium } from 'playwright';
import { setTimeout as sleep } from 'node:timers/promises';

const modes = [
  { mode: 'merchant', port: 4191, routes: ['/', '/login', '/merchant', '/configuracoes-estabelecimento', '/courier', '/admin'] },
  { mode: 'courier',  port: 4192, routes: ['/', '/login', '/courier', '/merchant', '/admin'] },
  { mode: 'admin',    port: 4193, routes: ['/', '/login', '/admin', '/merchant', '/courier'] },
];

const results = [];
for (const { mode, port, routes } of modes) {
  const build = spawnSync(process.platform === 'win32' ? 'bun.cmd' : 'bun', ['run', 'build'], {
    cwd: '.work/entregas', shell: process.platform === 'win32', encoding: 'utf8',
    env: { ...process.env, VITE_APOIS_PRODUCT_MODE: mode, APOIS_MOBILE_BUILD: '1' },
  });
  const built = build.status === 0;
  if (!built) { results.push({ mode, built, error: (build.stderr || '').slice(-300) }); continue; }

  const srv = spawn(process.execPath, ['.output/server/index.mjs'], {
    cwd: '.work/entregas', env: { ...process.env, HOST: '127.0.0.1', PORT: String(port) }, stdio: 'ignore',
  });
  await sleep(7000);
  const browser = await chromium.launch();
  const modeRoutes = [];
  for (const route of routes) {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const errs = [];
    page.on('pageerror', e => errs.push(e.message.slice(0, 90)));
    try { await page.goto(`http://127.0.0.1:${port}/#${route}`, { waitUntil: 'networkidle', timeout: 20000 }); await page.waitForTimeout(900); }
    catch (e) { errs.push('nav: ' + e.message.slice(0, 60)); }
    const info = await page.evaluate(() => ({
      hash: location.hash,
      h1: ([...document.querySelectorAll('h1')].map(e => e.textContent.trim())[0] || '').slice(0, 40),
      len: document.body.innerText.trim().length,
      inputs: document.querySelectorAll('input').length,
    }));
    modeRoutes.push({ route, ...info, errors: errs.slice(0, 2) });
    await page.close();
  }
  await browser.close();
  srv.kill();
  results.push({ mode, built, routes: modeRoutes });
}
console.log(JSON.stringify(results, null, 1));
