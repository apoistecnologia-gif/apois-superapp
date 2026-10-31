import assert from 'node:assert/strict';
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
const report = { target, network: 'All non-loopback requests blocked; no backend/auth/payment/maps calls permitted', scope: 'Anonymous render and public interactions only; no form submissions, authenticated E2E or Android', results: [] };
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
        item.assetReferences = await page.evaluate(() =>
          [...document.querySelectorAll('link[href],script[src]')].map(e => e.getAttribute('href') || e.getAttribute('src'))
            .filter(value => value && value.includes('assets/')));
        const entryPath = resolve(root, path.split('#')[0].slice(1));
        const entryHtml = readFileSync(entryPath, 'utf8');
        item.assetSerialization = (entryHtml.match(/.{0,24}assets.{0,90}/g) || []).slice(0, 40);
        item.blockedHosts = [...blocked].sort();
        item.screenshot = name + '-' + width + '.png';
        await page.screenshot({ path: resolve(output, item.screenshot), fullPage: true });
        item.passed = metrics.textLength > 20 && metrics.visibleControls > 0 && !metrics.horizontalOverflow && pageErrors.length === 0 && localFailures.length === 0;

        item.interactions = [];
        if (name !== 'seletor') {
          const password = page.locator('input[type="password"]').first();
          await password.waitFor({ state: 'visible' });
          const samplePassword = 'QA-only-not-a-real-password';
          await password.fill(samplePassword);
          const markedToggle = await password.evaluate(input => {
            let parent = input.parentElement;
            for (let level = 0; parent && level < 3; level++, parent = parent.parentElement) {
              const buttons = [...parent.querySelectorAll('button')].filter(button =>
                button.type === 'button' && button.querySelector('svg') && !button.innerText.trim());
              if (buttons.length === 1) { buttons[0].dataset.apoisQaPasswordToggle = 'true'; return true; }
            }
            return false;
          });
          assert.ok(markedToggle, name + ': password toggle not found');
          const toggle = page.locator('[data-apois-qa-password-toggle="true"]');
          await toggle.click();
          assert.equal(await page.locator('input').evaluateAll(inputs =>
            inputs.find(input => input.value === 'QA-only-not-a-real-password')?.type), 'text', name + ': reveal password');
          await toggle.click();
          assert.equal(await password.inputValue(), samplePassword, name + ': toggle changed password');
          await password.fill('');
          item.interactions.push({ action: 'password reveal/hide without changing value', passed: true });

          await page.goto(origin + path, { waitUntil: 'networkidle' });
          await page.getByText('Esqueci minha senha', { exact: true }).first().click();
          await page.waitForTimeout(600);
          const recoveryText = await page.locator('body').innerText();
          assert.match(recoveryText, /recuper|redefin|enviar.*(?:link|instru|c[oó]digo)/i, name + ': recovery UI did not open');
          await page.screenshot({ path: resolve(output, name + '-recovery-' + width + '.png'), fullPage: true });
          item.interactions.push({ action: 'open password recovery without submitting', passed: true });

          await page.goto(origin + path, { waitUntil: 'networkidle' });
          const registration = page.getByText(/^(?:Criar conta|Criar minha conta|Cadastrar como motorista|Cadastre-se)$/i).first();
          const beforeRegistrationText = await page.locator('body').innerText();
          await registration.click();
          await page.waitForTimeout(600);
          const registrationText = await page.locator('body').innerText();
          assert.notEqual(registrationText, beforeRegistrationText, name + ': registration click did not change the page');
          assert.match(registrationText, /cadastro|cadastr|crie sua|criar (?:uma |sua )?conta|nome completo/i, name + ': registration UI did not open');
          assert.ok(await page.locator('input').count() >= 2, name + ': registration form absent');
          if (name === 'entregas-login') {
            const expectedBrand = 'data:image/png;base64,' + readFileSync(resolve('superapp/branding/apois-client-red-logo.b64'), 'utf8').trim();
            item.registrationOfficialBrand = await page.locator('img').evaluateAll((images, expected) => images.some(image => image.src === expected && image.getBoundingClientRect().width > 0 && ['normal', 'none'].includes(getComputedStyle(image).content)), expectedBrand);
            assert.equal(item.registrationOfficialBrand, true, 'Customer Entregas registration does not render the official embedded brand');
          }
          // Dismiss the previous feedback toast through its real close control.
          const toastClose = page.locator('[data-sonner-toast] button[data-close-button]').first();
          if (await toastClose.isVisible()) await toastClose.click();
          await page.screenshot({ path: resolve(output, name + '-register-' + width + '.png'), fullPage: true });
          item.interactions.push({ action: 'open registration without submitting', passed: true });
        } else {
          // Both role/service entries must navigate to the correct packaged module.
          for (const module of target === 'cliente' ? ['corridas', 'entregas'] : ['motorista', 'entregador']) {
            await page.goto(origin + path, { waitUntil: 'networkidle' });
            await page.locator('[data-module="' + module + '"]').first().click();
            await page.waitForURL(url => url.pathname.includes('/modules/' + module + '/index.html'), { timeout: 10000 });
            item.interactions.push({ action: 'selector opens ' + module, passed: true });
          }
        }
        assert.equal(pageErrors.length, 0, name + ': runtime errors during public interactions');
        assert.equal(localFailures.length, 0, name + ': missing resources during public interactions');

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
