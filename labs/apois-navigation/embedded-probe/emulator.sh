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
expected="${APOIS_EXPECTED_TESTS:-1}"
[[ "$expected" =~ ^[1-9][0-9]*$ ]]
if [[ "$expected" == 1 ]];then summary='OK (1 test)';else summary="OK ($expected tests)";fi
grep -Fx "$summary" "$OUT/instrumentation.txt"
grep -Fx 'INSTRUMENTATION_CODE: -1' "$OUT/instrumentation.txt"
test "$(grep -c '^INSTRUMENTATION_STATUS_CODE: 0
 "$OUT/instrumentation.txt")" = "$expected"
if grep -Eq '^INSTRUMENTATION_STATUS_CODE: -[1-9]|^FAILURES!!!' "$OUT/instrumentation.txt";then exit 1;fi
