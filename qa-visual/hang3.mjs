import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errs = []; page.on('pageerror', e => errs.push(e.message));
await page.goto('http://127.0.0.1:4175/#/', { waitUntil: 'networkidle' });
await page.waitForTimeout(800);
await page.evaluate(() => { location.hash = '#/courier'; });
for (const t of [2000, 6000, 15000, 30000]) {
  await page.waitForTimeout(t === 2000 ? 2000 : t === 6000 ? 4000 : t === 15000 ? 9000 : 15000);
  const s = await page.evaluate(() => ({ hash: location.hash, text: document.body.innerText.trim().slice(0, 45), len: document.body.innerText.trim().length }));
  console.log(`t=${t}`, JSON.stringify(s));
}
console.log('errs', JSON.stringify(errs.slice(0,3)));
await page.screenshot({ path: 'qa-visual/courier-blocked-hang.png', fullPage: true });
await browser.close();
