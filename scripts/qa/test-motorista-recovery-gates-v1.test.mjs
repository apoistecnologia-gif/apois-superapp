import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normalizeCertificateSha256,configurePartnerQaGradle,certificateFingerprintFromKeytool} from './configure-partner-qa-debug-signing-v1.mjs';
import {extractPartnerApkCertSha256} from './extract-partner-apk-cert-sha256-v1.mjs';
const read=p=>readFileSync(p,'utf8');
const workflow=read('.github/workflows/apois-motorista-only-qa-apk.yml');
const legacy=read('.github/workflows/apois-partner-motorista-home-qa-apk.yml');
const only=read('scripts/build-apois-motorista-only-qa.mjs');
const launcher=read('scripts/install-partner-launcher.mjs');
const sanitizer=read('scripts/sanitize-partner-launcher-resources.mjs');
const shell=read('superapp/partner-shell/index-motorista-only.html');
const approved=read('scripts/apply-driver-login-approved-qa-v1.mjs');
const splash=read('scripts/install-partner-splash.mjs');
const androidPackage=JSON.parse(read('superapp/partner-shell/package.json'));

test('unknown or wrong signer blocks app update; original QA key only',()=>{
 assert.match(workflow,/APOIS_PARTNER_QA_DEBUG_KEYSTORE_BASE64/);
 assert.match(workflow,/APOIS_PARTNER_QA_CERT_SHA256/);
 assert.ok(workflow.includes('secrets.APOIS_PARTNER_QA_DEBUG_KEYSTORE_BASE64'));
 assert.ok(workflow.includes('4a3476b91674301eb066146b6f3b8384d9827ab4bdb287b6f00cbbeab56a33f4'));
 assert.ok(!workflow.includes('94a11563082e4f8e57f76b0a5d0982d4b88da93353753f87c732310e9d887132'));
 assert.ok(!workflow.includes('APOIS_MOTORISTA_9003_KEYSTORE_BASE64'));
 assert.ok(workflow.includes('9100+GITHUB_RUN_NUMBER'));
 assert.ok(workflow.includes('1.0.29-qa.$GITHUB_RUN_NUMBER'));
 assert.match(workflow,/APOIS_MOTORISTA_INSTALLED_CERT_SHA256/);
 assert.match(workflow,/APOIS_MOTORISTA_INSTALLED_VERSION_CODE/);
 assert.match(workflow,/node scripts\/qa\/configure-partner-qa-debug-signing-v1\.mjs/);
 assert.match(workflow,/node scripts\/qa\/extract-partner-apk-cert-sha256-v1\.mjs/);
 assert.match(workflow,/APK_CERT.*EXPECTED_CERT/);
 assert.match(workflow,/INSTALLED.*ORIGINAL/);
 assert.doesNotMatch(workflow,/secrets\.APOIS_CLIENT_QA_DEBUG_KEYSTORE_BASE64/);
 assert.doesNotMatch(workflow,/assinatura debug temporaria/);
 assert.equal(normalizeCertificateSha256('4A:34:76:B9:16:74:30:1E:B0:66:14:6B:6F:3B:83:84:D9:82:7A:B4:BD:B2:87:B6:F0:0C:BB:EA:B5:6A:33:F4'),
 '4a3476b91674301eb066146b6f3b8384d9827ab4bdb287b6f00cbbea b56a33f4'.replaceAll(' ',''));
 assert.throws(()=>normalizeCertificateSha256('NOT_A_REAL_CERT'));
});
test('Gradle uses protected keystore explicitly for debug, no ephemeral fallback',()=>{
 const source='plugins { id \'com.android.application\' }\nandroid { buildTypes { debug {} } }';
 const gradle=configurePartnerQaGradle(source);
 assert.match(gradle,/storeFile file\(System\.getenv\("HOME"\)/);
 assert.match(gradle,/signingConfig signingConfigs\.apoisPartnerQaDebug/);
 assert.equal(configurePartnerQaGradle(gradle),gradle);
 assert.equal(certificateFingerprintFromKeytool('Certificate fingerprints:\nSHA256: 4A:34:76:B9:16:74:30:1E:B0:66:14:6B:6F:3B:83:84:D9:82:7A:B4:BD:B2:87:B6:F0:0C:BB:EA:B5:6A:33:F4'),
 '4a3476b91674301eb066146b6f3b8384d9827ab4bdb287b6f00cbbea b56a33f4'.replaceAll(' ',''));
});
test('APK certificate fingerprint extractor rejects ambiguous signers',()=>{
 const expected='4a3476b91674301eb066146b6f3b8384d9827ab4bdb287b6f00cbbea b56a33f4'.replaceAll(' ','');
 assert.equal(extractPartnerApkCertSha256('V2 Signer: certificate SHA-256 digest: '+expected),expected);
 assert.throws(()=>extractPartnerApkCertSha256(''),/exactly one/);
 assert.throws(()=>extractPartnerApkCertSha256('Signer #1 certificate SHA-256 digest: '+expected+'\nSigner #2 certificate SHA-256 digest: '+'6b'.repeat(32)),/exactly one/);
});
test('Motorista-only has original red branding, approved login, and no courier assets',()=>{
 assert.match(only,/rmSync\(courier,\{recursive:true,force:true\}\)/);
 assert.match(only,/registerPlugin\(DriverLocationPlugin\.class\)/);
 assert.match(only,/DriverVoicePlugin/);
 assert.match(only,/apois-client-red-logo\.b64/);
 assert.match(only,/\.work\/motorista-only-branding/);
 assert.match(launcher,/APOIS_MOTORISTA_QA_BRANDING_DIR/);
 assert.match(sanitizer,/APOIS_MOTORISTA_QA_BRANDING_DIR/);
 assert.match(splash,/splashColor/);
 assert.match(shell,/APOIS_MOTORISTA_APPROVED_WELCOME_RESTORED_V1/);
 assert.doesNotMatch(shell,/modules\/entregador|Sou Entregador/);
 assert.match(approved,/data-apois-driver-approved-login-v1/);
 assert.match(approved,/supabase\.auth\.signInWithPassword/);
 assert.match(approved,/<DriverGoogleLoginButton\s*\/>/);
 assert.match(approved,/recuperar-senha/);
});
test('Camera Android plugin restored to last previously packaged version',()=>{
 assert.equal(androidPackage.dependencies['@capacitor/camera'],'8.2.1');
 assert.match(workflow,/IONCAMRFileProvider/);
});

test('mixed Partner APK generator is retired; source and security audits stay versioned',()=>{
 assert.match(legacy,/if: \$\{\{ false \}\}/);
 assert.doesNotMatch(legacy,/secrets\.APOIS_PARTNER_QA_DEBUG_KEYSTORE_BASE64/);
 assert.match(workflow,/npm run audit:partner/);
 assert.match(workflow,/npm run verify:pins/);
 assert.match(workflow,/npm run verify:partner-portability/);
});

test('Corridas-only build does not compile delivery module; full-mode path stays intact',()=>{
 const script=read('scripts/build-partner-modules.sh');
 const bundler=read('superapp/partner-shell/build.mjs');
 assert.match(script,/APOIS_MOTORISTA_ONLY:-0/);
 assert.match(script,/test ! -e superapp\/partner-shell\/dist\/modules\/entregador/);
 assert.match(script,/exit 0\nfi\n\n# ---------------- Entregador ----------------/);
 assert.match(bundler,/const motoristaOnly = process\.env\.APOIS_MOTORISTA_ONLY === '1'/);
 assert.match(bundler,/motoristaOnly \? 'index-motorista-only\.html'/);
 assert.match(bundler,/if \(!motoristaOnly\) \{/);
 assert.match(script,/node "\$ROOT\/scripts\/harden-partner-motorista-native-gps\.mjs"/);
 assert.match(script,/node "\$ROOT\/scripts\/apply-driver-login-approved-qa-v1\.mjs"/);
});
