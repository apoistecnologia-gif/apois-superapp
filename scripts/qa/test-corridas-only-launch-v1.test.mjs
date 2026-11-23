import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync,readdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {Script} from 'node:vm';
import {enabledModules,launchMode,isCorridasOnly} from '../../config/apois-launch-mode.mjs';

const root=process.cwd();
const file=path=>readFileSync(resolve(root,path),'utf8');
const client=file('superapp/shell/corridas-only.html');
const driver=file('superapp/partner-shell/corridas-only.html');
const js=html=>{
 const match=html.match(/<script>([\s\S]*?)<\/script>/);
 assert.ok(match,'no inline boot script');
 new Script(match[1]);
 return match[1];
};
test('Only Corridas is the immutable default for public builds; invalid modes fail closed',()=>{
 assert.equal(launchMode({}),'corridas_only');
 assert.equal(isCorridasOnly({}),true);
 assert.deepEqual(enabledModules('client',{}),['corridas']);
 assert.deepEqual(enabledModules('partner',{}),['motorista']);
 assert.deepEqual(enabledModules('client',{APOIS_LAUNCH_MODE:'full'}),['corridas','entregas']);
 assert.deepEqual(enabledModules('partner',{APOIS_LAUNCH_MODE:'full'}),['motorista','entregador']);
 assert.throws(()=>launchMode({APOIS_LAUNCH_MODE:'untrusted'}));
});
test('Customer direct launch has only Corridas URLs, preserves Google and password recovery',()=>{
 const body=js(client);
 assert.ok(body.includes('APOIS_CORRIDAS_ONLY_CLIENT_BOOT_V1'));
 for(const x of ['./modules/corridas/index.html','corridas-google','corridas-reset','corridas-confirm','pending-oauth-product','app.getLaunchUrl()','appUrlOpen'])assert.ok(body.includes(x),x);
 for(const x of ['modules/entregas','delivery','entregas-google','entregas-auth','data-module="entregas"'])assert.ok(!body.includes(x),'isolated customer reference '+x);
 assert.ok(!client.includes('data-module="entregas"'));
});
test('Partner direct launch only Motorista; delivery push and links ignored',()=>{
 const body=js(driver);
 for(const x of ['APOIS_CORRIDAS_ONLY_PARTNER_BOOT_V1','modules/motorista/index.html','motorista-recovery-url','motorista-google-url','pushNotificationActionPerformed','getLaunchUrl()'])assert.ok(body.includes(x),x);
 for(const x of ['modules/entregador','data-module="entregador"'])assert.ok(!body.includes(x),'isolated role leak '+x);
 assert.ok(body.includes("if(order||kind.includes('delivery')||kind.includes('order'))return false"));
});
test('Source repos and Entregas migrations remain pinned and build-time allowlist used',()=>{
 const lock=JSON.parse(file('.apois/source-lock.json'));
 assert.equal(lock.sources.entregas.commit,'2f4606e0fb52dffb49f2e6aebbe921ce687ab625');
 assert.equal(lock.sources.corridas_passageiro.commit,'7b047f75a1a919a5336c0df6e0d60b14b02f2618');
 assert.equal(lock.sources.corridas_motorista_admin.commit,'9fc171050d8b5703540c49d19a8f1e9f5162775f');
 for(const p of ['superapp/shell/build.mjs','superapp/partner-shell/build.mjs']){
  const s=file(p);assert.ok(s.includes("enabledModules('"),'allowlist absent: '+p);
  assert.ok(s.includes('corridas-only.html'),'direct native boot absent: '+p);
 }
});
const args=new Set(process.argv.slice(2));
if(args.has('--client'))test('Client release artifact excludes Entregas files and switchers',()=>{
 const dir=resolve(root,'superapp/shell/dist');
 assert.ok(existsSync(resolve(dir,'modules/corridas/index.html')));
 assert.ok(!existsSync(resolve(dir,'modules/entregas')));
 const html=readFileSync(resolve(dir,'index.html'),'utf8');
 assert.ok(html.includes('APOIS_CORRIDAS_ONLY_CLIENT_BOOT_V1'));
 assert.ok(!html.includes('modules/entregas'));
});
if(args.has('--partner'))test('Partner release artifact excludes Entregador web bundle and selection',()=>{
 const dir=resolve(root,'superapp/partner-shell/dist');
 assert.ok(existsSync(resolve(dir,'modules/motorista/index.html')));
 assert.ok(!existsSync(resolve(dir,'modules/entregador')));
 const html=readFileSync(resolve(dir,'index.html'),'utf8');
 assert.ok(html.includes('APOIS_CORRIDAS_ONLY_PARTNER_BOOT_V1'));
 assert.ok(!html.includes('modules/entregador'));
});
if(args.has('--native'))test('Partner compiled Android sources exclude Courier registrations',()=>{
 const rootAndroid=resolve(root,'superapp/partner-shell/android/app/src/main');
 const java=resolve(rootAndroid,'java/br/com/apois/parceiro');
 const main=readFileSync(resolve(java,'MainActivity.java'),'utf8');
 const manifest=readFileSync(resolve(rootAndroid,'AndroidManifest.xml'),'utf8');
 assert.ok(main.includes('registerPlugin(DriverLocationPlugin.class)'));
 assert.ok(manifest.includes('android:name=".DriverLocationService"'));
 for(const bad of ['CourierLocationPlugin','CourierLocationService','CourierVoicePlugin']){
  assert.ok(!main.includes(bad));assert.ok(!manifest.includes(bad));
  assert.ok(!existsSync(resolve(java,bad+'.java')),'Courier Java still compiled: '+bad);
 }
});
