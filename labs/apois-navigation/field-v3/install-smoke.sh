#!/usr/bin/env bash
set -euo pipefail
SDK="$ANDROID_SDK_ROOT"
OUT="$RUNNER_TEMP/apois-v3-install-smoke"
mkdir -p "$OUT"
source "$(cd "$(dirname "$0")/.." && pwd)/emulator-common/boot.sh"
boot_lab_emulator apois-v3-lab "$OUT"
adb shell svc wifi disable
adb shell svc data disable
adb shell input keyevent 82
adb install "$RUNNER_TEMP/apois-field-apk/APOIS-GPS-Piaui-Piloto-V3.apk" | tee "$OUT/install.txt"
grep -F Success "$OUT/install.txt"
PKG=br.com.apois.navigation.field.v3.lab
adb shell am start -W -n "$PKG/br.com.apois.navigation.lab.FieldDynamicPilotActivity" | tee "$OUT/launch.txt"
grep -F 'Status: ok' "$OUT/launch.txt"
sleep 8
adb shell pidof "$PKG" > "$OUT/pid.txt"
test -s "$OUT/pid.txt"
adb shell uiautomator dump /sdcard/apois-lab-view.xml >/dev/null
adb pull /sdcard/apois-lab-view.xml "$OUT/view.xml" >/dev/null
grep -F 'APOIS GPS' "$OUT/view.xml"
grep -F 'Mapa local verificado.' "$OUT/view.xml"
adb shell am force-stop "$PKG"
adb shell pm clear "$PKG" | tee "$OUT/clear.txt"
echo '[OK] exact artifact installed, launched, verified local map manifest and stopped; no actual navigation or GPS tested.'
