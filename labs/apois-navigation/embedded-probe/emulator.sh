#!/usr/bin/env bash
set -euo pipefail
H="$RUNNER_TEMP/apois-embedded"
OUT="$RUNNER_TEMP/apois-embedded-report"
SDK="$ANDROID_SDK_ROOT"
AVDMANAGER="$(find "$SDK/cmdline-tools" -type f -name avdmanager | sort -V | tail -1)"
printf 'no\n' | "$AVDMANAGER" create avd -n apois-embedded-lab -k 'system-images;android-35;google_apis;x86_64' --force
"$SDK/emulator/emulator" -avd apois-embedded-lab -no-window -no-audio -no-boot-anim -no-snapshot -gpu swiftshader_indirect > "$OUT/emulator.log" 2>&1 &
PID=$!
trap 'adb emu kill >/dev/null 2>&1 || true; kill "$PID" 2>/dev/null || true' EXIT
timeout 240 bash -c 'until [[ "$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d "\r")" == 1 ]]; do sleep 3; done'
adb shell svc wifi disable
adb shell svc data disable
adb shell input keyevent 82
adb install "$H/app/build/outputs/apk/debug/app-debug.apk"
adb install "$H/app/build/outputs/apk/androidTest/debug/app-debug-androidTest.apk"
adb shell am instrument -w -r br.com.apois.navigation.embedded.lab.test/androidx.test.runner.AndroidJUnitRunner | tee "$OUT/instrumentation.txt"
grep -F 'OK (1 test)' "$OUT/instrumentation.txt"
