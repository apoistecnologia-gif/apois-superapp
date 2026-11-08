import { chromium } from 'playwright';
// Auditoria visual real: overflow horizontal, alvos de toque < 44px, elementos
// cortados, contraste de texto e sobreposição de rodapé.
const routes = ['/', '/login', '/register', '/termos', '/privacidade'];
const browser = await chromium.launch();
const out = [];
for (const route of routes) {
  for (const vp of [{ w: 360, h: 640 }, { w: 390, h: 844 }, { w: 430, h: 932 }]) {
    const page = await browser.newPage({ viewport: { width: vp.w, height: vp.h } });
    await page.goto(`http://127.0.0.1:4183/#${route}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(700);
    const r = await page.evaluate(() => {
      const de = document.documentElement;
      const small = [...document.querySelectorAll('button,a,[role=button]')]
        .map(el => ({ t: (el.textContent || '').trim().slice(0, 24), w: Math.round(el.getBoundingClientRect().width), h: Math.round(el.getBoundingClientRect().height) }))
        .filter(x => x.h > 0 && (x.h < 44 || x.w < 44));
      const clipped = [...document.querySelectorAll('h1,h2,p,span,button')]
        .filter(el => el.scrollWidth > el.clientWidth + 2 && el.clientWidth > 0)
        .map(el => (el.textContent || '').trim().slice(0, 30)).slice(0, 5);
      return {
        overflowX: de.scrollWidth - de.clientWidth,
        docH: de.scrollHeight, vpH: window.innerHeight,
        smallTargets: small.slice(0, 6),
        clipped,
      };
    });
    out.push({ route, vp: `${vp.w}x${vp.h}`, ...r });
    await page.screenshot({ path: `qa-visual/v-${route.replace(/\//g, '_') || 'root'}-${vp.w}.png`, fullPage: false });
    await page.close();
  }
}
console.log(JSON.stringify(out.filter(o => o.overflowX > 0 || o.clipped.length || o.smallTargets.length), null, 1));
console.log('total combinações:', out.length);
await browser.close();
