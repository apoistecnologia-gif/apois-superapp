import { chromium } from 'playwright';
// O Motorista usa Hash Router e redireciona durante a navegação; o evaluate
// precisa tolerar "Execution context was destroyed".
const routes = ['/', '/motorista/login', '/motorista/cadastro', '/motorista/recuperar-senha', '/motorista/redefinir-senha', '/motorista/termos', '/motorista/privacidade', '/motorista/app', '/motorista/corridas', '/motorista/ganhos', '/motorista/carteira', '/motorista/perfil', '/motorista/documentos', '/motorista/assinatura', '/motorista/configuracoes', '/motorista/seguranca', '/motorista/notificacoes', '/motorista/suporte', '/motorista/regalias', '/motorista/status', '/motorista/preferencias-notificacoes', '/admin/dashboard', '/admin/login'];
const browser = await chromium.launch();
const out = [];
for (const route of routes) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errs = [];
  page.on('pageerror', e => errs.push(e.message.slice(0, 80)));
  page.on('console', m => { if (m.type() === 'error' && !/vibrate|Failed to load resource|GoogleMaps/.test(m.text())) errs.push('c:' + m.text().slice(0, 60)); });
  try { await page.goto('http://127.0.0.1:4202' + route, { waitUntil: 'networkidle', timeout: 20000 }); } catch (e) { errs.push('nav:' + e.message.slice(0, 40)); }
  await page.waitForTimeout(1200);
  let info = { hash: '?', h1: '', len: -1, inputs: -1 };
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      info = await page.evaluate(() => ({
        hash: location.hash,
        h1: ([...document.querySelectorAll('h1')].map(e => e.textContent.trim())[0] || '').slice(0, 34),
        len: document.body.innerText.trim().length,
        inputs: document.querySelectorAll('input').length,
      }));
      break;
    } catch { await page.waitForTimeout(700); }
  }
  out.push({ route, ...info, errors: errs.slice(0, 2) });
  await page.screenshot({ path: `qa-visual/mot-${route.replace(/[\/]/g, '_') || 'root'}.png` }).catch(() => {});
  await page.close();
}
console.log(JSON.stringify(out, null, 1));
await browser.close();
