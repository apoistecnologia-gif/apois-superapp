import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.goto('http://127.0.0.1:4183/#/register', { waitUntil: 'networkidle' });
await page.waitForTimeout(700);
const r = await page.evaluate(() => {
  const cb = document.querySelector('[role=checkbox], input[type=checkbox]');
  if (!cb) return { found: false };
  const b = cb.getBoundingClientRect();
  const cx = b.left + b.width / 2, cy = b.top + b.height / 2;
  const probe = (dx, dy) => { const t = document.elementFromPoint(cx + dx, cy + dy); return !!(t && (t === cb || cb.contains(t) || t.closest('[role=checkbox]') === cb)); };
  return { found: true, box: `${Math.round(b.width)}x${Math.round(b.height)}`, left20: probe(-20,0), right20: probe(20,0), up20: probe(0,-20), down20: probe(0,20) };
});
console.log(JSON.stringify(r));
await browser.close();
