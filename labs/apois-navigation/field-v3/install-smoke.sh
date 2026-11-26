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
source "$(cd "$(dirname "$0")/.." && pwd)/emulator-common/ui.sh"
ACT=br.com.apois.navigation.lab.FieldDynamicPilotActivity
lab_wait_screen "$PKG" "$ACT" 'Mapa local verificado.' "$OUT"
cp "$OUT/view.xml" "$OUT/verified-map.xml"
adb shell am force-stop "$PKG"
adb shell pm clear "$PKG" | tee "$OUT/clear.txt"
echo '[OK] exact V3 installed, launched, verified local map manifest and stopped; no actual navigation or GPS tested.'
