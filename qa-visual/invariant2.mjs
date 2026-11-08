import { chromium } from 'playwright';
const browser = await chromium.launch();
// 1) cold load em rota de outro produto
const p1 = await browser.newPage({ viewport: { width: 390, height: 844 } });
const e1 = []; p1.on('pageerror', e => e1.push(e.message));
await p1.goto('http://127.0.0.1:4173/#/merchant', { waitUntil: 'networkidle' });
await p1.waitForTimeout(1200);
const r1 = await p1.evaluate(() => ({ hash: location.hash, textLen: document.body.innerText.trim().length }));
// 2) navegação por hash a partir da home
const p2 = await browser.newPage({ viewport: { width: 390, height: 844 } });
const e2 = []; p2.on('pageerror', e => e2.push(e.message));
await p2.goto('http://127.0.0.1:4173/#/', { waitUntil: 'networkidle' });
await p2.waitForTimeout(800);
await p2.evaluate(() => { location.hash = '#/courier'; });
await p2.waitForTimeout(1200);
const r2 = await p2.evaluate(() => ({ hash: location.hash, textLen: document.body.innerText.trim().length }));
console.log(JSON.stringify({ coldLoad: { ...r1, errors: e1.slice(0,1) }, hashNav: { ...r2, errors: e2.slice(0,1) } }, null, 1));
await browser.close();
