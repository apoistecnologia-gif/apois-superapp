import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errs = [];
page.on('pageerror', e => errs.push(e.stack ? e.stack.split('\n').slice(0, 6).join(' | ') : e.message));
await page.goto('http://127.0.0.1:4173/#/merchant', { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);
console.log(JSON.stringify(errs.slice(0, 2), null, 1));
await browser.close();
