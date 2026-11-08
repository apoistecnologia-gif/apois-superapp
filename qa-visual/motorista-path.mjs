import { chromium } from 'playwright';
// O Motorista usa history de browser (não hash). Testamos por pathname, com
// timeout curto para não travar em rotas que redirecionam.
const routes = ['/', '/motorista/login', '/motorista/cadastro', '/motorista/recuperar-senha', '/motorista/app', '/motorista/corridas', '/motorista/ganhos', '/motorista/perfil', '/motorista/documentos', '/admin/login', '/admin/dashboard'];
const browser = await chromium.launch();
const out = [];
for (const route of routes) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errs = [];
  page.on('pageerror', e => errs.push(e.message.slice(0, 70)));
  try { await page.goto('http://127.0.0.1:4202' + route, { waitUntil: 'domcontentloaded', timeout: 12000 }); } catch (e) { errs.push('nav:' + e.message.slice(0, 30)); }
  await page.waitForTimeout(1500);
  let info = { path: '?', h1: '', len: -1, inputs: -1 };
  for (let i = 0; i < 3; i++) {
    try { info = await page.evaluate(() => ({ path: location.pathname, h1: ([...document.querySelectorAll('h1')].map(e => e.textContent.trim())[0] || '').slice(0, 32), len: document.body.innerText.trim().length, inputs: document.querySelectorAll('input').length })); break; }
    catch { await page.waitForTimeout(600); }
  }
  out.push({ route, ...info, errors: errs.slice(0, 2) });
  await page.close();
}
console.log(JSON.stringify(out, null, 1));
await browser.close();
