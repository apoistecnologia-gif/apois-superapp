#!/usr/bin/env bash
set -euo pipefail
H="$RUNNER_TEMP/apois-embedded"
OUT="$RUNNER_TEMP/apois-embedded-report"
D="$RUNNER_TEMP/apois-ne-local-graph"
PKG=br.com.apois.navigation.northeast.lab
source "$(cd "$(dirname "$0")/.." && pwd)/emulator-common/boot.sh"
boot_lab_emulator apois-northeast-lab "$OUT"
adb shell svc wifi disable
adb shell svc data disable
adb shell input keyevent 82
adb install "$H/app/build/outputs/apk/debug/app-debug.apk"
adb install "$H/app/build/outputs/apk/androidTest/debug/app-debug-androidTest.apk"
adb shell df -k /data > "$OUT/device-space.txt"
adb shell run-as "$PKG" mkdir -p files
# Binary stdin, no shared storage or network in the app, no graph inside APK.
adb exec-in run-as "$PKG" sh -c "'cat > files/ne-graph.tar'" < "$D/graph.tar"
adb shell run-as "$PKG" ls -l files/ne-graph.tar > "$OUT/graph-device-size.txt"
adb logcat -c
adb shell am instrument -w -r "$PKG.test/androidx.test.runner.AndroidJUnitRunner" | tee "$OUT/instrumentation.txt"
adb logcat -d -s APOIS_NE_OFFLINE:I AndroidRuntime:E > "$OUT/route-metrics.txt"
cat "$OUT/route-metrics.txt"
grep -F 'OK (1 test)' "$OUT/instrumentation.txt"
adb shell pm clear "$PKG"
