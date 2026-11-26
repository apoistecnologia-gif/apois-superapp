#!/usr/bin/env bash
set -euo pipefail
H="$RUNNER_TEMP/apois-embedded"
OUT="$RUNNER_TEMP/apois-embedded-report"
SDK="$ANDROID_SDK_ROOT"
source "$(cd "$(dirname "$0")/.." && pwd)/emulator-common/boot.sh"
boot_lab_emulator apois-embedded-lab "$OUT"
adb shell svc wifi disable
adb shell svc data disable
adb shell input keyevent 82
adb install "$H/app/build/outputs/apk/debug/app-debug.apk"
adb install "$H/app/build/outputs/apk/androidTest/debug/app-debug-androidTest.apk"
adb shell am instrument -w -r br.com.apois.navigation.embedded.lab.test/androidx.test.runner.AndroidJUnitRunner | tee "$OUT/instrumentation.txt"
grep -F 'OK (1 test)' "$OUT/instrumentation.txt"
