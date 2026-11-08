import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 200)); });
const routes = ['/', '/inicio', '/login', '/register', '/enderecos', '/pedidos', '/perfil', '/sacola', '/checkout', '/buscar', '/favoritos', '/notificacoes'];
const results = [];
for (const route of routes) {
  const before = errors.length;
  let status = 'ok';
  try {
    const resp = await page.goto('http://127.0.0.1:4173' + route, { waitUntil: 'networkidle', timeout: 20000 });
    status = resp ? String(resp.status()) : 'no-response';
  } catch (e) { status = 'nav-error: ' + e.message.slice(0, 60); }
  await page.waitForTimeout(600);
  const bodyText = (await page.locator('body').innerText().catch(() => '')).trim();
  const url = page.url();
  results.push({ route, status, finalUrl: url.replace('http://127.0.0.1:4173', ''), textLen: bodyText.length, head: bodyText.slice(0, 70).replace(/\n/g, ' | '), newErrors: errors.length - before });
}
console.log(JSON.stringify({ results, errors: errors.slice(0, 15) }, null, 1));
await browser.close();
