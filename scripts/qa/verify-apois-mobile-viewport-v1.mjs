// Integration gate for both APKs. Validates module shell and native guard,
// while deliberately preserving overflow/scroll on long content and form routes.
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
const role=process.argv[2];
assert.ok(['cliente','parceiro'].includes(role),'Usage: verify-apois-mobile-viewport-v1.mjs cliente|parceiro [--native]');
const native=process.argv.includes('--native');
const root=role==='cliente'?'superapp/shell':'superapp/partner-shell';
const modules=role==='cliente'?['corridas','entregas']:['motorista','entregador'];
for(const entry of ['index.html',...modules.map(name=>'modules/'+name+'/index.html')]){
  const path=resolve(root,'dist',entry);
  assert.ok(existsSync(path),'Missing packaged HTML: '+path);
  const html=readFileSync(path,'utf8');
  assert.equal(html.split('data-apois-embedded-viewport-v1').length-1,1,'Viewport guard must exist once in '+entry);
  assert.ok(html.includes('overscroll-behavior-y:none;overscroll-behavior-x:none'),'WebView scroll-chain guard missing in '+entry);
  const guard=html.match(/<style data-apois-embedded-viewport-v1>[\\s\\S]*?<\\/style>/)?.[0];
  assert.ok(guard,'Embedded guard must be a real stylesheet in '+entry);
  assert.ok(!guard.includes('touch-action:none')&&!guard.includes('overflow:hidden')&&!guard.includes('pointer-events:none'),
    'Viewport guard must not globally disable touches or scrolling in '+entry);
  assert.ok(html.includes('</body>'),'App body missing: '+entry);
}
if(role==='cliente'){
 const driver=readFileSync(resolve(root,'dist/modules/corridas/index.html'),'utf8');
 assert.ok(driver.includes('data-apois-client-loading-v1'),'Keep corrected Corridas splash');
 const check=readFileSync(resolve('.work/corridas/src/routes/_authenticated.tsx'),'utf8');
 for(const marker of ['APOIS_CORRIDAS_AUTH_VIEWPORT_V2','overflow-y-auto overscroll-contain','data-apois-android-nav-safe-v1'])
  assert.ok(check.includes(marker),'Corridas shell regression '+marker);
}
if(native){
 const main=resolve(root,'android/app/src/main/java/br/com/apois/'+(role==='cliente'?'app':'parceiro')+'/MainActivity.java');
 assert.ok(existsSync(main),'Android host missing');
 const java=readFileSync(main,'utf8');
 assert.equal(java.split('APOIS_ANDROID_WEBVIEW_OVERSCROLL_V1').length-1,1,'Native overscroll guard must be unique');
 assert.ok(java.includes('getBridge().getWebView().setOverScrollMode(android.view.View.OVER_SCROLL_NEVER)'),'Android native WebView still rubber-bands');
 assert.ok(java.includes('super.onCreate(savedInstanceState);'),'Capacitor lifecycle changed');
 if(role==='parceiro')assert.ok(java.includes('registerPlugin(DriverVoicePlugin.class)'),'Partner native voice hook lost');
}
console.log('[OK] '+role+': 3 HTML viewports protected'+(native?' + native WebView':'')+'; scrolling, app startup and navigation preserved');
