import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.goto('http://127.0.0.1:4202/motorista/corridas', { waitUntil: 'domcontentloaded', timeout: 12000 }).catch(()=>{});
await page.waitForTimeout(2500);
const r = await page.evaluate(() => ({ path: location.pathname, text: document.body.innerText.replace(/\s+/g,' ').slice(0,220), inputs: document.querySelectorAll('input').length, buttons: [...document.querySelectorAll('button')].map(b=>b.textContent.trim()).slice(0,6) })).catch(e=>({err:e.message.slice(0,60)}));
console.log(JSON.stringify(r));
await page.screenshot({ path: 'qa-visual/mot-historico-sem-login.png', fullPage: true });
await browser.close();
