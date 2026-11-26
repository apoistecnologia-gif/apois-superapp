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
# Use adb push (sync protocol), then stream into the private directory with
# shell v2. Never trust adb exec-in exit alone: verify size and hash on device.
STAGE=/data/local/tmp/apois-ne-graph.tar
EXPECTED_BYTES=$(stat -c %s "$D/graph.tar")
EXPECTED_SHA=$(sha256sum "$D/graph.tar" | cut -d ' ' -f1)
AVAILABLE_KB=$(adb shell df -k /data | tr -d '\r' | awk 'END {print $4}')
[[ "$AVAILABLE_KB" =~ ^[0-9]+$ ]]
(( AVAILABLE_KB * 1024 >= EXPECTED_BYTES * 2 + 128 * 1024 * 1024 ))
adb push "$D/graph.tar" "$STAGE"
adb shell -T "run-as $PKG mkdir -p files"
adb shell -T "cat $STAGE | run-as $PKG sh -c 'cat > files/ne-graph.tar'"
adb shell rm -f "$STAGE"
ACTUAL_BYTES=$(adb shell -T "run-as $PKG stat -c %s files/ne-graph.tar" | tr -d '\r')
ACTUAL_SHA=$(adb shell -T "run-as $PKG sha256sum files/ne-graph.tar" | tr -d '\r' | cut -d ' ' -f1)
printf '%s\n' "$ACTUAL_BYTES" > "$OUT/graph-device-size.txt"
printf '%s\n' "$ACTUAL_SHA" > "$OUT/graph-device-sha256.txt"
test "$ACTUAL_BYTES" = "$EXPECTED_BYTES"
test "$ACTUAL_SHA" = "$EXPECTED_SHA"
adb logcat -c
adb shell am instrument -w -r "$PKG.test/androidx.test.runner.AndroidJUnitRunner" | tee "$OUT/instrumentation.txt"
adb logcat -d -s APOIS_NE_OFFLINE:I AndroidRuntime:E > "$OUT/route-metrics.txt"
cat "$OUT/route-metrics.txt"
grep -F 'OK (1 test)' "$OUT/instrumentation.txt"
adb shell pm clear "$PKG"
