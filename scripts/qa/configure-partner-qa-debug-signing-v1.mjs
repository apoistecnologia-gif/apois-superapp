import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// QA only: restore the SAME protected certificate for every APK update.
// Never generate a replacement key automatically, or existing installs break.
const MARKER = '// APOIS_PARTNER_PINNED_QA_DEBUG_SIGNING_V1';

export function normalizeCertificateSha256(value) {
  const fingerprint = String(value ?? '').replace(/:/g, '').trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(fingerprint)) {
    throw Error('[FAIL] Partner QA certificate SHA-256 fingerprint must contain 64 hex digits');
  }
  return fingerprint;
}

export function configurePartnerQaGradle(source) {
  if (!source.includes('com.android.application') || !/android\s*\{/.test(source)) {
    throw Error('[FAIL] Partner generated app/build.gradle is not a known Android application');
  }
  if (source.includes(MARKER)) {
    if (!source.includes('signingConfig signingConfigs.apoisPartnerQaDebug')) {
      throw Error('[FAIL] Partner QA signing marker present without its debug signing config');
    }
    return source;
  }
  return source + '\n' + MARKER + '\n' + [
    'android {',
    '    signingConfigs {',
    '        apoisPartnerQaDebug {',
    '            storeFile file(System.getenv("HOME") + "/.android/debug.keystore")',
    '            storePassword "android"',
    '            keyAlias "androiddebugkey"',
    '            keyPassword "android"',
    '        }',
    '    }',
    '    buildTypes {',
    '        debug {',
    '            signingConfig signingConfigs.apoisPartnerQaDebug',
    '        }',
    '    }',
    '}',
    '',
  ].join('\n');
}

export function certificateFingerprintFromKeytool(output) {
  const matched = String(output ?? '').match(/\bSHA256:\s*([A-Fa-f0-9:]{64,95})/);
  if (!matched) throw Error('[FAIL] Could not read SHA256 fingerprint from QA keystore');
  return normalizeCertificateSha256(matched[1]);
}

export function preparePartnerQaSigning({
  gradleFile = 'superapp/partner-shell/android/app/build.gradle',
  keystoreFile = resolve(process.env.HOME || '', '.android/debug.keystore'),
  expectedSha256 = process.env.APOIS_PARTNER_QA_CERT_SHA256,
} = {}) {
  const expected = normalizeCertificateSha256(expectedSha256);
  const path = resolve(gradleFile);
  if (!existsSync(path)) throw Error('[FAIL] Partner generated Gradle file missing');
  if (!existsSync(keystoreFile)) {
    throw Error('[FAIL] Partner QA keystore missing; restore ORIGINAL key, do not create a new one');
  }
  const info = spawnSync('keytool', [
    '-list', '-v', '-keystore', keystoreFile,
    '-alias', 'androiddebugkey', '-storepass', 'android',
  ], { encoding: 'utf8', timeout: 10000 });
  if (info.status !== 0) throw Error('[FAIL] Partner QA keystore is unreadable or alias androiddebugkey is missing');
  const actual = certificateFingerprintFromKeytool(info.stdout);
  if (actual !== expected) {
    throw Error('[FAIL] Partner QA keystore certificate does NOT match pinned fingerprint; update blocked');
  }
  const source = readFileSync(path, 'utf8');
  const updated = configurePartnerQaGradle(source);
  if (updated !== source) writeFileSync(path, updated, 'utf8');
  console.log('[PASS] Partner QA Gradle uses original pinned Android debug identity (' + actual + ')');
  return actual;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  preparePartnerQaSigning();
}
