import { chromium } from 'playwright';
const browser = await chromium.launch();
for (const route of ['/pedidos', '/enderecos', '/login']) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errs = [];
  page.on('pageerror', e => errs.push(e.message.slice(0, 120)));
  await page.goto('http://127.0.0.1:4173' + route, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  const info = await page.evaluate(() => ({
    path: location.pathname,
    h1: [...document.querySelectorAll('h1')].map(e => e.textContent.trim()).slice(0, 3),
    text: document.body.innerText.replace(/\s+/g, ' ').slice(0, 160),
    inputs: document.querySelectorAll('input').length,
    btns: document.querySelectorAll('button').length,
  }));
  console.log(route, JSON.stringify(info), errs.length ? 'ERRS:' + errs.join(';') : '');
  await page.screenshot({ path: `qa-visual/${route.replace(/\//g, '_') || 'root'}-390.png`, fullPage: true });
  await page.close();
}
await browser.close();
