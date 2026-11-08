import { chromium } from 'playwright';
// O Cliente Entregas usa Hash Router (createHashHistory). Rotas por pathname
// caem na landing; a navegação real é /#/rota.
const routes = ['/', '/inicio', '/login', '/register', '/enderecos', '/enderecos/novo', '/pedidos', '/perfil', '/sacola', '/checkout', '/buscar', '/favoritos', '/notificacoes', '/perfil/pagamentos', '/perfil/ajuda', '/perfil/legal', '/termos', '/privacidade', '/apois-plus', '/merchant', '/courier', '/admin'];
const browser = await chromium.launch();
const out = [];
for (const route of routes) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errs = [];
  page.on('pageerror', e => errs.push('pageerror: ' + e.message.slice(0, 100)));
  page.on('console', m => { if (m.type() === 'error' && !/vibrate/.test(m.text())) errs.push('console: ' + m.text().slice(0, 100)); });
  try {
    await page.goto('http://127.0.0.1:4175/#' + route, { waitUntil: 'networkidle', timeout: 20000 });
    await page.waitForTimeout(900);
  } catch (e) { errs.push('nav: ' + e.message.slice(0, 60)); }
  const info = await page.evaluate(() => ({
    hash: location.hash,
    h1: [...document.querySelectorAll('h1')].map(e => e.textContent.trim())[0] || '',
    textLen: document.body.innerText.trim().length,
    inputs: document.querySelectorAll('input').length,
    buttons: document.querySelectorAll('button').length,
  }));
  out.push({ route, ...info, errors: errs.slice(0, 3) });
  await page.close();
}
console.log(JSON.stringify(out, null, 1));
await browser.close();
