#!/usr/bin/env bash
set -euo pipefail
SDK="$ANDROID_SDK_ROOT"
OUT="$RUNNER_TEMP/apois-v3-install-smoke"
mkdir -p "$OUT"
AVDMANAGER="$(find "$SDK/cmdline-tools" -type f -name avdmanager | sort -V | tail -1)"
printf 'no\n' | "$AVDMANAGER" create avd -n apois-v3-lab -k 'system-images;android-35;google_apis;x86_64' --force
"$SDK/emulator/emulator" -avd apois-v3-lab -no-window -no-audio -no-boot-anim -no-snapshot -gpu swiftshader_indirect > "$OUT/emulator.log" 2>&1 &
PID=$!
trap 'adb emu kill >/dev/null 2>&1 || true; kill "$PID" 2>/dev/null || true' EXIT
timeout 240 bash -c 'until [[ "$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d "\r")" == 1 ]]; do sleep 3; done'
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
