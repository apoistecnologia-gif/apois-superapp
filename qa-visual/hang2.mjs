import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errs = []; page.on('pageerror', e => errs.push(e.message));
await page.goto('http://127.0.0.1:4173/#/', { waitUntil: 'networkidle' });
await page.waitForTimeout(800);
await page.evaluate(() => { location.hash = '#/pedidos'; });
for (const t of [1500, 5000, 12000]) {
  await page.waitForTimeout(t === 1500 ? 1500 : t === 5000 ? 3500 : 7000);
  const s = await page.evaluate(() => ({ hash: location.hash, text: document.body.innerText.trim().slice(0, 45), len: document.body.innerText.trim().length }));
  console.log(`t=${t}`, JSON.stringify(s));
}
console.log('errs', JSON.stringify(errs.slice(0,3)));
await page.screenshot({ path: 'qa-visual/hang-pedidos.png', fullPage: true });
await browser.close();
