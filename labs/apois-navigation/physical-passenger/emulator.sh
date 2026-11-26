#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$RUNNER_TEMP/apois-passenger-webview-report"
source "$ROOT/emulator-common/boot.sh"
boot_lab_emulator apois-passenger-webview "$OUT"
adb shell svc wifi disable
adb shell svc data disable
adb shell input keyevent 82
APK="$RUNNER_TEMP/apois-passenger-apk/APOIS-Passageiro-Teste-Fisico.apk"
test -s "$APK"
(cd "$(dirname "$APK")" && sha256sum -c SHA256SUMS.txt)
adb install "$APK"
adb shell dumpsys webviewupdate > "$OUT/webview-version.txt"
set +e
node "$ROOT/physical-passenger/webview-smoke.mjs" "$OUT" "$RUNNER_TEMP/apois-passenger-physical/catalog.json" 2>&1 | tee "$OUT/webview-smoke.log"
status=${PIPESTATUS[0]}
set -e
adb exec-out screencap -p > "$OUT/after-test.png" || true
adb shell dumpsys activity activities > "$OUT/activities.txt" || true
test "$status" = 0
grep -F APOIS_PASSENGER_WEBVIEW_SMOKE_OK "$OUT/webview-smoke.log"
