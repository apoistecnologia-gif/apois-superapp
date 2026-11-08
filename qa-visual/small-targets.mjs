import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.goto('http://127.0.0.1:4181/#/register', { waitUntil: 'networkidle' });
await page.waitForTimeout(700);
const small = await page.evaluate(() => [...document.querySelectorAll('button,a,[role=button]')]
  .map(el => { const r = el.getBoundingClientRect(); return { tag: el.tagName, label: el.getAttribute('aria-label') || (el.textContent||'').trim().slice(0,20), cls: el.className.toString().slice(0,60), w: Math.round(r.width), h: Math.round(r.height) }; })
  .filter(x => x.h > 0 && (x.h < 44 || x.w < 44)));
console.log(JSON.stringify(small, null, 1));
await browser.close();
