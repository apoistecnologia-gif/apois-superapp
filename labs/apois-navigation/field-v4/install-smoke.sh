#!/usr/bin/env bash
set -euo pipefail
SDK="$ANDROID_SDK_ROOT"
OUT="$RUNNER_TEMP/apois-v4-install-smoke"
mkdir -p "$OUT"
source "$(cd "$(dirname "$0")/.." && pwd)/emulator-common/boot.sh"
boot_lab_emulator apois-v4-lab "$OUT"
adb shell svc wifi disable
adb shell svc data disable
adb shell input keyevent 82
adb logcat -b crash -c
adb logcat -c
# Record the whole test interval rather than only the last 800 lines.
adb logcat -b main -b system -b crash -v threadtime > "$OUT/session-logcat.txt" 2>&1 &
CAPTURE_PID=$!
trap 'adb logcat -b crash -d > "$OUT/crash-buffer.txt" 2>&1 || true; adb shell dumpsys activity exit-info "$PKG" > "$OUT/exit-info.txt" 2>&1 || true; kill "$CAPTURE_PID" 2>/dev/null || true; adb emu kill >/dev/null 2>&1 || true; kill "$LAB_EMULATOR_PID" 2>/dev/null || true' EXIT
PKG=br.com.apois.navigation.field.v4.lab
adb install "$RUNNER_TEMP/apois-field-apk/APOIS-GPS-Piaui-Piloto-V4.apk" | tee "$OUT/install.txt"
grep -F Success "$OUT/install.txt"
PKG=br.com.apois.navigation.field.v4.lab
adb shell am start -W -n "$PKG/br.com.apois.navigation.lab.FieldOfflinePilotActivity" | tee "$OUT/launch.txt"
grep -F 'Status: ok' "$OUT/launch.txt"
source "$(cd "$(dirname "$0")/.." && pwd)/emulator-common/ui.sh"
ACT=br.com.apois.navigation.lab.FieldOfflinePilotActivity
lab_wait_screen "$PKG" "$ACT" 'Mapa local verificado.' "$OUT"
cp "$OUT/view.xml" "$OUT/verified-map.xml"
# Emulator-only synthetic GPS: public snapped start from the verified
# urban_initial.json graph evidence. This is not a physical-road test.
adb shell pm grant "$PKG" android.permission.ACCESS_COARSE_LOCATION
adb shell pm grant "$PKG" android.permission.ACCESS_FINE_LOCATION
adb shell cmd location set-location-enabled true
lab_click_xml "$OUT/view.xml" "$PKG" 'Itainópolis'
lab_wait_screen "$PKG" "$ACT" 'Calcular rota offline pelo GPS' "$OUT"
lab_click_xml "$OUT/view.xml" "$PKG" 'Calcular rota offline pelo GPS'
for i in $(seq 1 25);do
 if ! adb shell pidof "$PKG" >/dev/null;then echo "APOIS process terminated during route start";adb logcat -b crash -d;exit 1;fi
 adb emu geo fix -41.478544 -7.447933 >/dev/null
 sleep 1
done
lab_wait_screen "$PKG" "$ACT" 'Rota offline. Orientação por GPS real.' "$OUT"
# A status message alone is insufficient: wait for the actual next GPS fix.
for i in $(seq 1 5);do adb emu geo fix -41.478544 -7.447933 >/dev/null;sleep 1;done
adb shell pidof "$PKG" >/dev/null
adb logcat -b crash -d > "$OUT/crash-buffer.txt"
if grep -F "Process: $PKG" "$OUT/crash-buffer.txt";then cat "$OUT/crash-buffer.txt";exit 1;fi
cp "$OUT/view.xml" "$OUT/synthetic-route.xml"
lab_click_xml "$OUT/view.xml" "$PKG" 'Encerrar teste'
lab_wait_screen "$PKG" "$ACT" 'Teste encerrado.' "$OUT"
echo '[OK] V4 synthetic GPS drove dynamic offline route selection and cancellation; physical navigation still untested.'
adb shell am force-stop "$PKG"
adb shell pm clear "$PKG" | tee "$OUT/clear.txt"
echo '[OK] exact V4 installed, map verified and synthetic GPS route test finished; no physical GPS or road test.'
