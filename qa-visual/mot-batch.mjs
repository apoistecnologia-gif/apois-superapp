import { chromium } from 'playwright';
const routes = ['/motorista/login','/motorista/cadastro','/motorista/recuperar-senha','/motorista/app','/motorista/corridas','/motorista/ganhos','/motorista/perfil','/motorista/documentos','/admin/login','/admin/dashboard'];
const browser = await chromium.launch();
const out = [];
for (const p of routes) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errs = []; page.on('pageerror', e => errs.push(e.message.slice(0,60)));
  try { await page.goto('http://127.0.0.1:4202' + p, { waitUntil: 'domcontentloaded', timeout: 10000 }); } catch (e) { errs.push('nav'); }
  await page.waitForTimeout(2000);
  let r = { path:'?', len:-1, h1:'', inputs:-1 };
  try { r = await page.evaluate(() => ({ path: location.pathname, len: document.body.innerText.trim().length, h1: ([...document.querySelectorAll('h1')].map(e=>e.textContent.trim())[0]||'').slice(0,32), inputs: document.querySelectorAll('input').length })); } catch { errs.push('eval'); }
  out.push({ route: p, ...r, errors: errs.slice(0,1) });
  await page.close();
}
console.log(JSON.stringify(out));
await browser.close();
