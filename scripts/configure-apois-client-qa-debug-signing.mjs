import { existsSync, appendFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// QA only. The generated Android project is ephemeral and this script is
// invoked exclusively by the test APK workflow (never release signing).
const gradlePath = resolve('superapp/shell/android/app/build.gradle');
const keyPath = resolve(process.env.HOME ?? '', '.android/debug.keystore');
if (!existsSync(gradlePath)) throw new Error('[FAIL] Generated Gradle app missing');
if (!existsSync(keyPath)) throw new Error('[FAIL] Persistent QA keystore missing');
const before = readFileSync(gradlePath, 'utf8');
if (!before.includes("com.android.application") || !before.includes('android {')) {
  throw new Error('[FAIL] Unexpected Gradle project; refusing to change signing');
}
const marker = '// APOIS_QA_STABLE_DEBUG_SIGNING_V1';
if (!before.includes(marker)) {
  appendFileSync(gradlePath, `
${marker}
android {
    signingConfigs {
        apoisQaDebug {
            storeFile file(System.getenv("HOME") + "/.android/debug.keystore")
            storePassword "android"
            keyAlias "androiddebugkey"
            keyPassword "android"
        }
    }
    buildTypes {
        debug {
            signingConfig signingConfigs.apoisQaDebug
        }
    }
}
`, 'utf8');
}
const after = readFileSync(gradlePath, 'utf8');
if (!after.includes(marker) || !after.includes('signingConfig signingConfigs.apoisQaDebug')) {
  throw new Error('[FAIL] Test signing override not installed');
}
console.log('[OK] Debug Gradle explicitly uses protected reusable QA identity');
