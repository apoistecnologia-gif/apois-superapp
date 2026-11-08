import { chromium } from 'playwright';
const browser = await chromium.launch();
// /admin e /motorista/app renderizam 9 caracteres: investigar o que é.
for (const route of ['/admin', '/motorista/app', '/redefinir-senha']) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errs = []; page.on('pageerror', e => errs.push(e.message.slice(0,80)));
  await page.goto('http://127.0.0.1:4200/#' + route, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  const info = await page.evaluate(() => ({ text: document.body.innerText.trim().slice(0,120), html: document.body.innerHTML.length, hash: location.hash }));
  console.log(route, JSON.stringify(info), errs.join(';'));
  await page.screenshot({ path: `qa-visual/corridas-deep-${route.replace(/\//g,'_')}.png`, fullPage: true });
  await page.close();
}
await browser.close();
