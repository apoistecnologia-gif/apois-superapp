import { chromium } from 'playwright';
const browser = await chromium.launch();
for (const p of ['/', '/motorista/login']) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  try { await page.goto('http://127.0.0.1:4202' + p, { waitUntil: 'domcontentloaded', timeout: 10000 }); } catch {}
  await page.waitForTimeout(2500);
  let r = {};
  try { r = await page.evaluate(() => ({ path: location.pathname, len: document.body.innerText.trim().length, h1: ([...document.querySelectorAll('h1')].map(e=>e.textContent.trim())[0]||'').slice(0,40), inputs: document.querySelectorAll('input').length })); } catch (e) { r = { err: e.message.slice(0,50) }; }
  console.log(p, JSON.stringify(r));
  await page.close();
}
await browser.close();
