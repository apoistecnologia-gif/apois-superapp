import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.goto('http://127.0.0.1:4173/#/', { waitUntil: 'domcontentloaded' });
for (const t of [2000, 8000, 15000, 25000]) {
  await page.waitForTimeout(t === 2000 ? 2000 : t - (t === 8000 ? 2000 : t === 15000 ? 8000 : 15000));
  const s = await page.evaluate(() => ({ text: document.body.innerText.trim().slice(0, 40), len: document.body.innerText.trim().length }));
  console.log(`t=${t}ms`, JSON.stringify(s));
}
await browser.close();
