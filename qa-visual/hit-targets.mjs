import { chromium } from 'playwright';
// Mede a ÁREA DE TOQUE REAL por hit-test: para cada controle, testa pontos ao
// redor do centro e conta quantos ainda acertam o próprio controle. Isso captura
// áreas ampliadas por pseudo-elemento (::after), que getBoundingClientRect ignora.
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.goto('http://127.0.0.1:4181/#/register', { waitUntil: 'networkidle' });
await page.waitForTimeout(700);
const res = await page.evaluate(() => {
  const out = [];
  for (const el of document.querySelectorAll('button,a,[role=button],input[type=checkbox]')) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const hits = (dx, dy) => { const t = document.elementFromPoint(cx + dx, cy + dy); return t === el || el.contains(t) || (t && t.closest && t.closest('[role=checkbox],button,a') === el); };
    let w = 0, h = 0;
    for (let d = 0; d <= 40; d += 2) { if (hits(d, 0) && hits(-d, 0)) w = d * 2; else break; }
    for (let d = 0; d <= 40; d += 2) { if (hits(0, d) && hits(0, -d)) h = d * 2; else break; }
    out.push({ label: el.getAttribute('aria-label') || (el.textContent || '').trim().slice(0, 18), box: `${Math.round(r.width)}x${Math.round(r.height)}`, hit: `${w}x${h}` });
  }
  return out;
});
console.log(JSON.stringify(res.filter(x => { const [w,h] = x.hit.split('x').map(Number); return w < 44 || h < 44; }), null, 1));
await browser.close();
