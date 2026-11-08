import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errs = [];
page.on('pageerror', e => errs.push('pageerror: ' + e.message));
page.on('requestfailed', r => errs.push('reqfail: ' + r.url().slice(-60) + ' ' + (r.failure()?.errorText||'')));
await page.goto('http://127.0.0.1:4173/login', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
const info = await page.evaluate(() => ({
  hash: location.hash, path: location.pathname,
  h1: [...document.querySelectorAll('h1,h2')].map(e=>e.textContent.trim()).slice(0,5),
  inputs: document.querySelectorAll('input').length,
  buttons: [...document.querySelectorAll('button')].map(b=>b.textContent.trim()).slice(0,10),
  rootHtmlLen: document.body.innerHTML.length,
  scripts: [...document.scripts].map(s=>s.src.slice(-50)).filter(Boolean).slice(0,5),
}));
console.log(JSON.stringify({ info, errs: errs.slice(0,8) }, null, 1));
await page.screenshot({ path: 'qa-visual/login-390.png', fullPage: true });
await browser.close();
