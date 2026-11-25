// APOIS_ANDROID_WEBVIEW_OVERSCROLL_V1
// Android-only guard for both APK hosts. Keeps ordinary nested scrolling, maps,
// inputs, gestures, native voice/location and Capacitor bridge untouched.
// Prevents Android WebView rubber-band/edge displacement of app shell chrome.
import assert from 'node:assert/strict';
import {existsSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
export function protectNativeWebView(role){
assert.ok(['cliente','parceiro'].includes(role),'Usage: node scripts/harden-apois-native-webview-scroll-v1.mjs cliente|parceiro');
const file=resolve(role==='cliente'
  ? 'superapp/shell/android/app/src/main/java/br/com/apois/app/MainActivity.java'
  : 'superapp/partner-shell/android/app/src/main/java/br/com/apois/parceiro/MainActivity.java');
if(!existsSync(file))throw Error('[FAIL] Android MainActivity missing: '+file);
const marker='APOIS_ANDROID_WEBVIEW_OVERSCROLL_V1';
let code=readFileSync(file,'utf8');
if(!code.includes(marker)){
  const anchor='super.onCreate(savedInstanceState);';
  if(!code.includes(anchor)) {
    // Fresh Capacitor Android can generate an empty BridgeActivity class.
    const empty=/public class MainActivity extends BridgeActivity\s*\{\s*\}/;
    if(!empty.test(code))throw Error('[FAIL] MainActivity without recognized onCreate '+role);
    code=code.replace(empty,`public class MainActivity extends BridgeActivity {\n    @Override\n    public void onCreate(android.os.Bundle savedInstanceState) {\n        super.onCreate(savedInstanceState);\n    }\n}`);
  }
  if(code.split(anchor).length!==2)throw Error('[FAIL] MainActivity onCreate anchor drift for '+role);
  code=code.replace(anchor,anchor+`
        // ${marker}: do not rubber-band the whole app when a nested page reaches its edge.
        if (getBridge() != null && getBridge().getWebView() != null) {
            getBridge().getWebView().setOverScrollMode(android.view.View.OVER_SCROLL_NEVER);
        }`);
  writeFileSync(file,code,'utf8');
}
for(const required of [marker,'getBridge().getWebView().setOverScrollMode(android.view.View.OVER_SCROLL_NEVER)','super.onCreate(savedInstanceState);'])
  if(!code.includes(required))throw Error('[FAIL] MainActivity scroll protection missing '+required);
if(role==='parceiro'&&!code.includes('registerPlugin(DriverVoicePlugin.class)'))throw Error('[FAIL] Partner native voice plugin lost');
console.log('[OK] '+role+': WebView overscroll disabled; nested scroll and Capacitor plugins preserved');

}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))
  protectNativeWebView(process.argv[2]);
