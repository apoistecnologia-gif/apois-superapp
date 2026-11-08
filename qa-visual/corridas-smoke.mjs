import { chromium } from 'playwright';
const routes = ['/', '/login', '/cadastro', '/recuperar-senha', '/redefinir-senha', '/inicio', '/buscar-destino', '/revisar-solicitacao', '/corridas', '/carteira', '/notificacoes', '/perfil', '/admin', '/motorista/app'];
const browser = await chromium.launch();
const out = [];
for (const route of routes) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errs = [];
  page.on('pageerror', e => errs.push(e.message.slice(0, 90)));
  page.on('console', m => { if (m.type() === 'error' && !/vibrate|Failed to load resource/.test(m.text())) errs.push('console: ' + m.text().slice(0, 80)); });
  try { await page.goto('http://127.0.0.1:4200/#' + route, { waitUntil: 'networkidle', timeout: 20000 }); await page.waitForTimeout(900); }
  catch (e) { errs.push('nav: ' + e.message.slice(0, 50)); }
  const info = await page.evaluate(() => ({
    hash: location.hash,
    h1: ([...document.querySelectorAll('h1')].map(e => e.textContent.trim())[0] || '').slice(0, 40),
    len: document.body.innerText.trim().length,
    inputs: document.querySelectorAll('input').length,
    buttons: document.querySelectorAll('button').length,
  }));
  out.push({ route, ...info, errors: errs.slice(0, 2) });
  await page.screenshot({ path: `qa-visual/corridas-${route.replace(/[\/]/g, '_') || 'root'}.png`, fullPage: false });
  await page.close();
}
console.log(JSON.stringify(out, null, 1));
await browser.close();
