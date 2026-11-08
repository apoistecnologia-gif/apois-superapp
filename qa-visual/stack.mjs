import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
page.on('pageerror', e => console.log('STACK:', (e.stack||e.message).split('\n').slice(0,10).join('\n')));
await page.goto('http://127.0.0.1:4174/#/courier', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
console.log('hash', await page.evaluate(()=>location.hash), 'len', await page.evaluate(()=>document.body.innerText.trim().length));
await browser.close();
