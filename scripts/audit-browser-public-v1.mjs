import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, extname, sep } from 'node:path';
import { createRequire } from 'node:module';

const target = process.argv[2];
if (!['cliente', 'parceiro'].includes(target)) throw Error('Expected cliente or parceiro');
const require = createRequire(resolve(process.env.APOIS_PLAYWRIGHT_ROOT, 'package.json'));
const { chromium } = require('playwright');
const root = resolve(target === 'cliente' ? 'superapp/shell/dist' : 'superapp/partner-shell/dist');
const output = resolve('qa-browser', target);
mkdirSync(output, { recursive: true });
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.woff2': 'font/woff2', '.json': 'application/json' };
const server = createServer((req, res) => {
  const path = resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname));
  if (path !== root && !path.startsWith(root + sep)) { res.writeHead(403).end(); return; }
  const file = existsSync(path) && statSync(path).isDirectory() ? resolve(path, 'index.html') : path;
  if (!existsSync(file) || !statSync(file).isFile()) { res.writeHead(404).end(); return; }
  res.writeHead(200, { 'Content-Type': mime[extname(file)] || 'application/octet-stream' });
  res.end(readFileSync(file));
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const origin = 'http://127.0.0.1:' + server.address().port;
const routes = target === 'cliente'
  ? [['seletor', '/index.html'], ['corridas-login', '/modules/corridas/index.html#/login'], ['entregas-login', '/modules/entregas/index.html#/login']]
  : [['seletor', '/index.html'], ['motorista-login', '/modules/motorista/index.html#/motorista/login'], ['entregador-login', '/modules/entregador/index.html#/courier']];
const report = { target, network: 'All non-loopback requests blocked; no backend/auth/payment/maps calls permitted', scope: 'Anonymous initial render only, not authenticated E2E or Android', results: [] };
let browser;
let failed = false;
try {
  browser = await chromium.launch({ headless: true });
  for (const [width, height] of [[360, 800], [1280, 900]]) {
    for (const [name, path] of routes) {
      const context = await browser.newContext({ viewport: { width, height }, serviceWorkers: 'block', reducedMotion: 'reduce' });
      // No persistence, credentials or mocked successful authentication.
      const blocked = new Set();
      await context.route('**/*', route => {
        const url = new URL(route.request().url());
        if (url.origin === origin) return route.continue();
        blocked.add(url.hostname); // Never store URL query strings or credentials.
        return route.abort('blockedbyclient');
      });
      const page = await context.newPage();
      const pageErrors = [];
      page.on('pageerror', e => pageErrors.push(e.message.replace(/https?:\/\/\S+/g, '[url]').slice(0, 300)));
      const localFailures = [];
      page.on('response', response => {
        if (response.url().startsWith(origin) && response.status() >= 400) {
          localFailures.push(new URL(response.url()).pathname);
        }
      });
      const item = { name, width, height, blockedHosts: [], pageErrors, localFailures };
      try {
        await page.goto(origin + path, { waitUntil: 'networkidle', timeout: 30000 });
        await page.locator('body').waitFor({ state: 'visible' });
        await page.evaluate(() => document.fonts.ready);
        // Wait for hydration and any initial auth fallback without contacting backend.
        await page.waitForTimeout(1500);
        const metrics = await page.evaluate(() => ({
          textLength: document.body.innerText.trim().length,
          horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 2,
          visibleControls: [...document.querySelectorAll('button,a,input')].filter(e => e.getBoundingClientRect().width > 0).length,
        }));
        Object.assign(item, metrics);
        item.blockedHosts = [...blocked].sort();
        item.screenshot = name + '-' + width + '.png';
        await page.screenshot({ path: resolve(output, item.screenshot), fullPage: true });
        item.passed = metrics.textLength > 20 && metrics.visibleControls > 0 && !metrics.horizontalOverflow && pageErrors.length === 0 && localFailures.length === 0;
        if (!item.passed) failed = true;
      } catch (error) {
        item.passed = false;
        item.error = String(error.message).replace(/https?:\/\/\S+/g, '[url]').slice(0, 300);
        failed = true;
      } finally {
        report.results.push(item);
        await context.close();
      }
    }
  }
} finally {
  if (browser) await browser.close();
  await new Promise(r => server.close(r));
  writeFileSync(resolve(output, 'report.json'), JSON.stringify(report, null, 2));
}
console.log(JSON.stringify(report, null, 2));
if (failed) process.exitCode = 1;
