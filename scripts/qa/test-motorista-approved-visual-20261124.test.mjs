/**
 * Visual screenshots reference 2026-11-24 — SOURCE contracts only.
 * Safety: no native APK / Supabase / production mutation; no fake ride metrics.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';

const read=(p)=>readFileSync(p,'utf8');
const login=read('scripts/apply-driver-login-approved-qa-v1.mjs');
const welcome=read('superapp/partner-shell/motorista-welcome.html');
const offer=read('scripts/harden-partner-motorista-offer-premium-v1.mjs');
const googleGenerator=read('scripts/harden-motorista-auth.mjs');
const typesScript=read('scripts/harden-motorista-supabase-types-20261124.mjs');
const top=read('scripts/templates/ApoisDriverHomePremiumTop.tsx.txt');
const panel=read('scripts/templates/ApoisDriverHomePremiumPanel.tsx.txt');
const home=read('scripts/harden-partner-motorista-home-premium-v1.mjs');
const build=read('scripts/build-partner-modules.sh');
const shell=read('superapp/partner-shell/index-motorista-only.html');

function expect(src, needles){
 for(const needle of needles)assert.ok(src.includes(needle),'Missing approved visual/functional contract '+needle);
}
test('01 — login visual white/red with original logo and safe inputs',()=>{
 expect(login,[
  'APOIS_MOTORISTA_VISUAL_REF_20261124_LOGIN',
  'data-apois-driver-approved-login-v1',
  'APOIS_PARTNER_LOGO_DATA_URL',
  '::before', '::after', 'text-[#0D0F12]',
  'Entrar na sua conta', 'Acesse com e-mail e senha',
  'aria-label=\"E-mail\"','aria-label=\"Senha\"',
  'aria-label={showPassword ? \"Ocultar senha\" : \"Mostrar senha\"}',
  'supabase.auth.signInWithPassword',
  'onSubmit={onSubmit}', 'disabled={loading}',
  '<DriverGoogleLoginButton />',
  'to=\"/motorista/recuperar-senha\"',
  'to=\"/motorista/cadastro\"'
 ]);
 assert.equal(login.split('<DriverGoogleLoginButton />').length-1,3,
  'Google button must remain in patch guard, rendered JSX and final check');
 assert.ok(existsSync('superapp/branding/apois-client-red-logo.b64'),'Official logo missing');
});
test('02 — official welcome artwork fits without cropping, same login destination',()=>{
 expect(welcome,[
  'APOIS_MOTORISTA_VISUAL_REF_20261124_WELCOME',
  './assets/apois-motorista-hero.webp',
  'data-apois-driver-approved-welcome-v1',
  'position:absolute', 'bottom:0', 'object-fit:contain', 'padding-bottom:calc(72px + env(safe-area-inset-bottom))',
  'apois-driver-welcome-enter',
  "window.location.assign('./modules/motorista/index.html#/motorista/login')",
  'env(safe-area-inset-bottom)'
 ]);
 assert.ok(existsSync('superapp/partner-shell/branding/apois-motorista-hero.webp.b64'));
});
test('03 — dynamic ride offer with original accept/reject and real passenger preferences',()=>{
 expect(offer,[
  'APOIS_MOTORISTA_VISUAL_REF_20261124_OFFER',
  'APOIS_PARTNER_LOGO_DATA_URL',
  'Preferências do passageiro','preferencePending',
  'supabase.from(', 'MessageCircle', 'paymentLabelFor(ride.payment_method)',
  'formatBRL(expectedFare)','pickupKm','tripKm',
  'RIDE_OFFER_TIMEOUT_SECONDS','startRideRingtone()',
  'onClick={onAccept}', 'onClick={onReject}', 'onOpenProfile',
  'ride.origin_name','ride.destination_name',
  'bg-gradient-to-b from-[#FF0524]'
 ]);
 assert.ok(!offer.includes('R$ 21,42'),'Never hardcode screenshot demo fare');
});
test('04 — bright Home uses same real online state, map and route destinations',()=>{
 expect(top,[
  'APOIS_PARTNER_LOGO_DATA_URL','online?"Online":"Offline"',
  'onClick={toggleOnline}', 'role=\"switch\" aria-checked={online}',
  'gpsStatus','Recebendo corridas','/motorista/notificacoes',
  'from-white via-white/98 to-transparent'
 ]);
 expect(panel,[
  'data-apois-driver-home-v1','Resumo de hoje',
  'Taxa de aceitação','stats.rides','stats.earnings',
  'formatBRL(stats.earnings||0)',
  'Tempo desta sessão. Aceitação ainda não disponível.',
  'Siga online e aumente seus ganhos!',
  '/motorista/ganhos','onUseTestLocation'
 ]);
 expect(home,[
  'APOIS_PARTNER_LOGO_DATA_URL','themeOverride={!active ? \"client\" : \"dark\"}',
  'toggleOnline={toggleOnline}', 'const hasRideUI',
  '<ApoisDriverBottomNav'
 ]);
 assert.ok(!panel.includes('R$ 64,19')&&!panel.includes('100%'),'No fabricated metrics');
});
test('05 — login Google listener type preserved with supported Capacitor core type',()=>{
 assert.ok(googleGenerator.includes('import type { PluginListenerHandle } from "@capacitor/core";'));
 assert.ok(googleGenerator.includes('import { App } from "@capacitor/app";'));
 assert.ok(googleGenerator.includes('supabase.auth.signInWithOAuth'));
});
test('06 — RPC types match verified production only in disposable workspace',()=>{
 expect(typesScript,[
  'APOIS_MOTORISTA_VERIFIED_DB_TYPES_20261124',
  'disconnect_my_mercadopago_driver: { Args: never; Returns: Json }',
  '_lat?: number | null','_lng?: number | null',
  'src/integrations/supabase/types.ts'
 ]);
 assert.ok(!typesScript.includes('execute_sql('));
});
test('07 — Android update signing is hard-pinned to the ADB-confirmed installed certificate (versionCode 328)',()=>{
 const pipeline=read('.github/workflows/apois-motorista-only-qa-apk.yml');
 expect(pipeline,[
   '4a3476b91674301eb066146b6f3b8384d9827ab4bdb287b6f00cbbeab56a33f4',
   'APOIS_PARTNER_QA_DEBUG_KEYSTORE_BASE64',
   'secrets.APOIS_PARTNER_QA_DEBUG_KEYSTORE_BASE64',
   'Exigir certificado original protegido',
   'APK_CERT','EXPECTED_CERT',
   'VersionCode do novo APK nao supera o instalado',
   'if [ "$INSTALLED" != "$DEVICE_ORIGINAL_CERT" ] || [ "$ORIGINAL" != "$DEVICE_ORIGINAL_CERT" ]'
 ]);
 assert.ok(!pipeline.includes('APK usara assinatura debug temporaria'));
 assert.ok(!pipeline.includes('94a11563082e4f8e57f76b0a5d0982d4b88da93353753f87c732310e9d887132'));
 assert.ok(!pipeline.includes('APOIS_MOTORISTA_9003_KEYSTORE_BASE64'));
 assert.ok(!pipeline.includes('secrets.APOIS_CLIENT_QA_DEBUG_KEYSTORE_BASE64'));
});
test('08 — Corridas-only source order and runtime safety unchanged',()=>{
 const offerPos=build.indexOf('harden-partner-motorista-offer-premium-v1.mjs');
 const homePos=build.indexOf('harden-partner-motorista-home-premium-v1.mjs');
 const loginPos=build.indexOf('apply-driver-login-approved-qa-v1.mjs');
 const bundlePos=build.indexOf('npm run build:motorista');
 assert.ok(offerPos>=0 && homePos>offerPos && loginPos>homePos && bundlePos>loginPos);
 expect(build,['Geolocation.watchPosition(', 'restauração do GPS nativo falhou',
  'tbbzkrfupmqdywnzgnms.supabase.co',
  'APOIS_MOTORISTA_ONLY:-0',
  'test ! -e superapp/partner-shell/dist/modules/entregador']);
 expect(shell,['APOIS_MOTORISTA_APPROVED_WELCOME_RESTORED_V1',
  'apois-parceiro:motorista-google-url',
  'apois-parceiro:motorista-recovery-url']);
 assert.ok(!shell.includes('modules/entregador'),'Delivery selector must never load');
});

test('09 — idle map has reserved viewport, compact summary and usable navigation',()=>{
 expect(home,['viewport mapa livre','+ 174px','+ 198px','m.setHeading(0)','m.setTilt(0)','altura nav home','rotulos sem quebra','labels.icon']);
 expect(top,['h-[46px]','h-[44px]','navigate({to:"/motorista/perfil"})']);
 expect(panel,['"116px"','aria-expanded={expanded}','aria-controls="apois-driver-summary-details"','+ 58px','hidden={!expanded}']);
 assert.ok(!welcome.includes('object-fit:cover'));
 assert.ok(!panel.includes('45dvh'));
});
