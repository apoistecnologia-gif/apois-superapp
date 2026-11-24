import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {patchLogin,MARKER} from './apply-driver-welcome-login-v1.mjs';
const root=process.cwd();
const welcome=readFileSync(root+'/superapp/partner-shell/motorista-welcome.html','utf8');
const shell=readFileSync(root+'/superapp/partner-shell/index.html','utf8');
const builder=readFileSync(root+'/superapp/partner-shell/build.mjs','utf8');
test('welcome preserves approved image and single real login button with camera and Android navigation safe areas',()=>{
 assert.match(welcome,/APOIS_DRIVER_APPROVED_WELCOME_V1/);
 assert.match(welcome,/apois-motorista-hero\.webp/);
 assert.match(welcome,/safe-area-inset-top/);
 assert.match(welcome,/safe-area-inset-bottom/);
 assert.match(welcome,/padding-top:max\(54px/);
 assert.match(welcome,/padding:9px 22px max\(70px/);
 assert.equal((welcome.match(/<button\b/g)||[]).length,1);
 assert.match(welcome,/modules\/motorista\/index\.html#\/motorista\/login/);
 assert.doesNotMatch(welcome,/\/entregador|entregas|mercadopago/i);
});
test('only manual Motorista selection opens welcome, courier, push, GPS operational lock and deep links remain unchanged',()=>{
 assert.match(shell,/motorista:'\.\/motorista-welcome\.html'/);
 assert.match(shell,/operationalUrls=\{motorista:/);
 assert.match(shell,/requestedRole==='motorista'.*operationalRole\(\)!=='motorista'/);
 assert.match(shell,/function routeRole\(requestedRole,target\)/);
 assert.match(shell,/function manualRouteRole\(requestedRole,target\)/);
 assert.match(shell,/const DRIVER_GOOGLE_KEY=/);
 assert.match(shell,/PARTNER_PENDING_PUSH_KEY/);
});
test('packager bundles real driver artwork and welcome HTML',()=>{
 assert.match(builder,/apois-motorista-hero\.webp/);
 assert.match(builder,/motorista-welcome\.html/);
 assert.match(builder,/APOIS_DRIVER_APPROVED_WELCOME_V1/);
});
test('driver approved login patch is presentation-only and retains all real callbacks',()=>{
 const s=`import { Link } from '@tanstack/react-router';
 const APOIS_PARTNER_LOGO_DATA_URL='asset';
 const DriverGoogleLoginButton=()=>null;
 supabase.auth.signInWithPassword;
 const DriverRecoveryLink=Link;
 function DriverLoginPage() {
 const loading=false; const error=null;const showPassword=false;const setShowPassword=()=>{};const onSubmit=()=>{};
  return (<main>old login <DriverGoogleLoginButton /> <Link to="/motorista/cadastro" /><DriverRecoveryLink to="/motorista/recuperar-senha" /></main>
  );
}`;
 const out=patchLogin(s);
 for(const token of ['data-apois-driver-approved-login-v1','supabase.auth.signInWithPassword','<DriverGoogleLoginButton />','to="/motorista/cadastro"','to="/motorista/recuperar-senha"','onSubmit={onSubmit}','aria-busy={loading}','APOIS_PARTNER_LOGO_DATA_URL'])assert.ok(out.includes(token),token);
 assert.equal((out.match(/<DriverGoogleLoginButton\s*\/>/g)||[]).length,1);
 assert.throws(()=>patchLogin(out),/duplicate patch/);
});