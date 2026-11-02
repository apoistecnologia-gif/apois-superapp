import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, extname, sep } from 'node:path';
import { createRequire } from 'node:module';

const target = process.argv[2];
if (!['cliente', 'parceiro'].includes(target)) throw Error('Expected cliente or parceiro');
const require = createRequire(resolve(process.env.APOIS_PLAYWRIGHT_ROOT, 'package.json'));
const { chromium } = require('playwright');
const root = resolve(target === 'cliente' ? 'superapp/shell/dist' : 'superapp/partner-shell/dist');
const output = resolve('qa-browser', target);
mkdirSync(output, { recursive: true });
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.woff2': 'font/woff2', '.json': 'application/json' };
const server = createServer((req, res) => {
  const path = resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname));
  if (path !== root && !path.startsWith(root + sep)) { res.writeHead(403).end(); return; }
  const file = existsSync(path) && statSync(path).isDirectory() ? resolve(path, 'index.html') : path;
  if (!existsSync(file) || !statSync(file).isFile()) { res.writeHead(404).end(); return; }
  res.writeHead(200, { 'Content-Type': mime[extname(file)] || 'application/octet-stream' });
  res.end(readFileSync(file));
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const origin = 'http://127.0.0.1:' + server.address().port;
const routes = target === 'cliente'
  ? [['seletor', '/index.html'], ['corridas-login', '/modules/corridas/index.html#/login'], ['entregas-login', '/modules/entregas/index.html#/login']]
  : [['seletor', '/index.html'], ['motorista-login', '/modules/motorista/index.html#/motorista/login'], ['entregador-login', '/modules/entregador/index.html#/courier']];
const report = { target, network: 'All non-loopback requests blocked; no backend/auth/payment/maps calls permitted', scope: 'Anonymous render and public interactions only; no form submissions, authenticated E2E or Android', results: [] };
// APOIS_INPUT_CONTRAST_ALL_FOUR_V1: inspect effective text/foreground, not just CSS classes.
async function checkReadableInputColors(page, screen) {
 const failures=await page.evaluate(()=>{
  const opaque=raw=>{
   const m=raw.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)$/);
   if(!m)return null;
   const alpha=m[4]===undefined?1:Number(m[4]);
   return alpha>=0.96?[Number(m[1]),Number(m[2]),Number(m[3])]:null;
  };
  const luma=a=>0.2126*a[0]+0.7152*a[1]+0.0722*a[2];
  return [...document.querySelectorAll('input:not([type="hidden"]), textarea')].flatMap((el)=>{
   const rect=el.getBoundingClientRect();
   if(rect.width<15||rect.height<10||rect.bottom<0||rect.top>innerHeight)return [];
   const s=getComputedStyle(el);
   let bg=opaque(s.backgroundColor),parent=el.parentElement;
   while(!bg&&parent){bg=opaque(getComputedStyle(parent).backgroundColor);parent=parent.parentElement;}
   const ink=opaque(s.webkitTextFillColor)||opaque(s.color);
   if(!bg||!ink)return [];
   const isLight=luma(bg)>220;
   const tooLight=luma(ink)>187;
   if(isLight&&tooLight)return [{screen:el.getAttribute('name')||el.id||'unnamed',
    color:s.color,fill:s.webkitTextFillColor,bg:s.backgroundColor,parentLuma:luma(bg)}];
   return [];
  });
 });
 assert.deepEqual(failures,[],screen+": white/light input text on light input surface");
 return true;
}

let browser;
let failed = false;
try {
  browser = await chromium.launch({ headless: true });
  for (const [width, height] of [[360, 800], [1280, 900]]) {
    for (const [name, path] of routes) {
      const context = await browser.newContext({ viewport: { width, height }, serviceWorkers: 'block', reducedMotion: 'reduce' });
      // No persistence, credentials or mocked successful authentication.
      const blocked = new Set();
      await context.route('**/*', route => {
        const url = new URL(route.request().url());
        if (url.origin === origin) return route.continue();
        blocked.add(url.hostname); // Never store URL query strings or credentials.
        return route.abort('blockedbyclient');
      });
      const page = await context.newPage();
      const pageErrors = [];
      page.on('pageerror', e => pageErrors.push(e.message.replace(/https?:\/\/\S+/g, '[url]').slice(0, 300)));
      const localFailures = [];
      page.on('response', response => {
        if (response.url().startsWith(origin) && response.status() >= 400) {
          localFailures.push(new URL(response.url()).pathname);
        }
      });
      const item = { name, width, height, blockedHosts: [], pageErrors, localFailures };
      try {
        await page.goto(origin + path, { waitUntil: 'networkidle', timeout: 30000 });
        await page.locator('body').waitFor({ state: 'visible' });
        await page.evaluate(() => document.fonts.ready);
        // Wait for hydration and any initial auth fallback without contacting backend.
        await page.waitForTimeout(1500);
        const metrics = await page.evaluate(() => ({
          textLength: document.body.innerText.trim().length,
          horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 2,
          visibleControls: [...document.querySelectorAll('button,a,input')].filter(e => e.getBoundingClientRect().width > 0).length,
        }));
        Object.assign(item, metrics);
        await checkReadableInputColors(page,name+" login "+width);
        if (name === 'corridas-login') {
          // Check actual painted title text fragments vs the floating module switch.
          const intersections=await page.evaluate(()=>{
            const title=document.querySelector('[data-apois-client-login-title-v2]');
            if(!title)return ['missing_title_marker'];
            const ranges=[];
            const walk=document.createTreeWalker(title,NodeFilter.SHOW_TEXT);
            while(walk.nextNode()){
              const node=walk.currentNode;
              if(!node.textContent?.trim())continue;
              const range=document.createRange();range.selectNodeContents(node);
              for(const rect of range.getClientRects())ranges.push(rect);
            }
            const controls=[...document.querySelectorAll('button,a,[role="button"]')]
              .filter(el=>!title.contains(el)).map(el=>el.getBoundingClientRect())
              .filter(r=>r.width>20 && r.height>20 && r.top<350 && r.bottom>title.getBoundingClientRect().top);
            const intersection=(a,b)=>a.left<b.right-2 && a.right>b.left+2 &&
              a.top<b.bottom-2 && a.bottom>b.top+2;
            return ranges.flatMap((rect,i)=>controls.some(r=>intersection(rect,r))?[i]:[]);
          });
          assert.deepEqual(intersections,[],'Corridas title text overlaps a floating navigation control');
          item.interactions=[...(item.interactions||[]),{action:'title does not overlap switch button',passed:true}];
        }
        if (name === 'entregas-login') {
          const primary=page.locator('[data-apois-entregas-login-label-v2]').first();
          await primary.waitFor({state:'visible'});
          const c=await primary.evaluate(el=>{const s=getComputedStyle(el);
            return {color:s.color,fill:s.webkitTextFillColor}});
          assert.equal(c.color,'rgb(255, 255, 255)','Entregas primary login button label must be white on red');
          assert.equal(c.fill,'rgb(255, 255, 255)','Android webkit submit fill must remain white on red');
          item.interactions=[...(item.interactions||[]),{action:'red submit button contrast',passed:true}];
        }
        item.assetReferences = await page.evaluate(() =>
          [...document.querySelectorAll('link[href],script[src]')].map(e => e.getAttribute('href') || e.getAttribute('src'))
            .filter(value => value && value.includes('assets/')));
        const entryPath = resolve(root, path.split('#')[0].slice(1));
        const entryHtml = readFileSync(entryPath, 'utf8');
        item.assetSerialization = (entryHtml.match(/.{0,24}assets.{0,90}/g) || []).slice(0, 40);
        item.blockedHosts = [...blocked].sort();
        item.screenshot = name + '-' + width + '.png';
        await page.screenshot({ path: resolve(output, item.screenshot), fullPage: true });
        item.passed = metrics.textLength > 20 && metrics.visibleControls > 0 && !metrics.horizontalOverflow && pageErrors.length === 0 && localFailures.length === 0;

        item.interactions = [];
        if (name !== 'seletor') {
          const password = page.locator('input[type="password"]').first();
          await password.waitFor({ state: 'visible' });
          const samplePassword = 'QA-only-not-a-real-password';
          await password.fill(samplePassword);
          const markedToggle = await password.evaluate(input => {
            let parent = input.parentElement;
            for (let level = 0; parent && level < 3; level++, parent = parent.parentElement) {
              const buttons = [...parent.querySelectorAll('button')].filter(button =>
                button.type === 'button' && button.querySelector('svg') && !button.innerText.trim());
              if (buttons.length === 1) { buttons[0].dataset.apoisQaPasswordToggle = 'true'; return true; }
            }
            return false;
          });
          assert.ok(markedToggle, name + ': password toggle not found');
          const toggle = page.locator('[data-apois-qa-password-toggle="true"]');
          await toggle.click();
          assert.equal(await page.locator('input').evaluateAll(inputs =>
            inputs.find(input => input.value === 'QA-only-not-a-real-password')?.type), 'text', name + ': reveal password');
          await toggle.click();
          assert.equal(await password.inputValue(), samplePassword, name + ': toggle changed password');
          await password.fill('');
          item.interactions.push({ action: 'password reveal/hide without changing value', passed: true });

          await page.goto(origin + path, { waitUntil: 'networkidle' });
          await page.getByText('Esqueci minha senha', { exact: true }).first().click();
          await page.waitForTimeout(600);
          const recoveryText = await page.locator('body').innerText();
          await checkReadableInputColors(page,name+" recovery "+width);
          assert.match(recoveryText, /recuper|redefin|enviar.*(?:link|instru|c[oó]digo)/i, name + ': recovery UI did not open');
          if (name === 'motorista-login') {
            // Reproduce the originally reported white-on-white regression in a
            // real browser DOM, without sending any email or contacting Auth.
            const email = page.locator('input[data-apois-driver-recovery-email-v1]').first();
            await email.waitFor({state:'visible'});
            await email.fill('qa-contraste@example.invalid');
            const visual = await email.evaluate(element => {
              const style=getComputedStyle(element);
              return { color:style.color,fill:style.webkitTextFillColor,caret:style.caretColor,
                value:element.value,scheme:style.colorScheme};
            });
            assert.equal(visual.value,'qa-contraste@example.invalid','Motorista recovery email must accept typing');
            assert.equal(visual.color,'rgb(17, 24, 39)','Motorista recovery email must have dark visible text');
            assert.equal(visual.fill,'rgb(17, 24, 39)','Android-style Webkit text fill must be dark');
            assert.equal(visual.caret,'rgb(17, 24, 39)','Recovery input caret must remain readable');
            item.recoveryEmailContrast={color:visual.color,fill:visual.fill,caret:visual.caret,scheme:visual.scheme,passed:true};
            item.interactions.push({action:'email typed and contrast computed (no submission)',passed:true});
            // The new recovery must accept a numeric code, not a clickable link.
            const otpInput=page.locator('[data-apois-driver-recovery-otp-input-v5]');
            await otpInput.waitFor({state:'visible'});
            await otpInput.fill('12ab345');
            assert.equal(await otpInput.inputValue(),'12345','Motorista OTP input must strip non-digits');
            const verifyButton=page.getByRole('button',{name:'Verificar código e continuar'});
            assert.ok(await verifyButton.isDisabled(),'Short OTP must not be submitted');
            await otpInput.fill('123456');
            assert.equal(await otpInput.inputValue(),'123456','Six-digit OTP accepted');
            assert.ok(await verifyButton.isEnabled(),'Valid-length OTP should enable verification');
            // Never submit a code or send email during visual tests.
            item.interactions.push({action:'numeric OTP input 6-digit validation without Auth request',passed:true});

          }

          await page.screenshot({ path: resolve(output, name + '-recovery-' + width + '.png'), fullPage: true });
          item.interactions.push({ action: 'open password recovery without submitting', passed: true });

          await page.goto(origin + path, { waitUntil: 'networkidle' });
          const registration = page.getByText(/^(?:Criar conta|Criar minha conta|Cadastrar como motorista|Cadastre-se)$/i).first();
          const beforeRegistrationText = await page.locator('body').innerText();
          await registration.click();
          await page.waitForTimeout(600);
          const registrationText = await page.locator('body').innerText();
          assert.notEqual(registrationText, beforeRegistrationText, name + ': registration click did not change the page');
          assert.match(registrationText, /cadastro|cadastr|crie sua|criar (?:uma |sua )?conta|nome completo/i, name + ': registration UI did not open');
          assert.ok(await page.locator('input').count() >= 2, name + ': registration form absent');
          if (name === 'entregas-login') {
            const expectedBrand = 'data:image/png;base64,' + readFileSync(resolve('superapp/branding/apois-client-red-logo.b64'), 'utf8').trim();
            item.registrationOfficialBrand = await page.locator('img').evaluateAll((images, expected) => images.some(image => image.src === expected && image.getBoundingClientRect().width > 0 && ['normal', 'none'].includes(getComputedStyle(image).content)), expectedBrand);
            assert.equal(item.registrationOfficialBrand, true, 'Customer Entregas registration does not render the official embedded brand');
          }
          // Dismiss the previous feedback toast through its real close control.
          const toastClose = page.locator('[data-sonner-toast] button[data-close-button]').first();
          if (await toastClose.isVisible()) await toastClose.click();
          await checkReadableInputColors(page,name+" register "+width);
          await page.screenshot({ path: resolve(output, name + '-register-' + width + '.png'), fullPage: true });
          item.interactions.push({ action: 'open registration without submitting', passed: true });
        } else {
          // Both role/service entries must navigate to the correct packaged module.
          for (const module of target === 'cliente' ? ['corridas', 'entregas'] : ['motorista', 'entregador']) {
            await page.goto(origin + path, { waitUntil: 'networkidle' });
            await page.locator('[data-module="' + module + '"]').first().click();
            await page.waitForURL(url => url.pathname.includes('/modules/' + module + '/index.html'), { timeout: 10000 });
            item.interactions.push({ action: 'selector opens ' + module, passed: true });
          }
        }
        assert.equal(pageErrors.length, 0, name + ': runtime errors during public interactions');
        assert.equal(localFailures.length, 0, name + ': missing resources during public interactions');

        if (!item.passed) failed = true;
      } catch (error) {
        item.passed = false;
        item.error = String(error.message).replace(/https?:\/\/\S+/g, '[url]').slice(0, 300);
        failed = true;
      } finally {
        report.results.push(item);
        await context.close();
      }
    }
  }
} finally {
  if (browser) await browser.close();
  await new Promise(r => server.close(r));
  writeFileSync(resolve(output, 'report.json'), JSON.stringify(report, null, 2));
}
console.log(JSON.stringify(report, null, 2));
if (failed) process.exitCode = 1;
