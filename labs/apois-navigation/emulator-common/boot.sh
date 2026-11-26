#!/usr/bin/env bash
# Source only from disposable CI. Isolate the AVD paths and explicitly validate
# that avdmanager and emulator are looking at the same directory.
boot_lab_emulator(){
 local name="$1" out="$2" sdk="$ANDROID_SDK_ROOT"
 local manager
 mkdir -p "$out"
 export ANDROID_USER_HOME="$RUNNER_TEMP/apois-android-user"
 export ANDROID_AVD_HOME="$ANDROID_USER_HOME/avd"
 mkdir -p "$ANDROID_AVD_HOME"
 manager="$(find "$sdk/cmdline-tools" -type f -name avdmanager | sort -V | tail -1)"
 test -x "$manager"
 test -x "$sdk/platform-tools/adb"
 export PATH="$sdk/platform-tools:$PATH"
 adb version | tee "$out/adb-version.txt"
 local image='system-images;android-35;google_apis;x86_64'
 printf 'no\n' | "$manager" create avd -n "$name" -k "$image" -p "$ANDROID_AVD_HOME/$name.avd" --device pixel_6 --force 2>&1 | tee "$out/avd-create.txt"
 "$manager" list avd > "$out/avd-manager-list.txt"
 "$sdk/emulator/emulator" -list-avds | tee "$out/avd-list.txt"
 grep -Fx "$name" "$out/avd-list.txt"
 test -s "$ANDROID_AVD_HOME/$name.ini"
 test -s "$ANDROID_AVD_HOME/$name.avd/config.ini"
 adb start-server
 "$sdk/emulator/emulator" -avd "$name" -port 5554 -no-window -no-audio -no-boot-anim -no-snapshot -gpu swiftshader_indirect -accel on -memory 2048 > "$out/emulator.log" 2>&1 &
 local pid=$!
 # Keep PID global for the EXIT trap; a local disappears when this function returns.
 LAB_EMULATOR_PID="$pid"
 LAB_EMULATOR_OUT="$out"
 export ANDROID_SERIAL=emulator-5554
 trap 'adb logcat -d -t 800 > "$LAB_EMULATOR_OUT/logcat.txt" 2>&1 || true; adb emu kill >/dev/null 2>&1 || true; kill "$LAB_EMULATOR_PID" 2>/dev/null || true' EXIT
 local deadline=$((SECONDS+300))
 while (( SECONDS < deadline )); do
  if ! kill -0 "$pid" 2>/dev/null; then tail -80 "$out/emulator.log"; return 1; fi
  if [[ "$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r' || true)" == 1 ]]; then
   adb shell getprop ro.build.version.sdk | tee "$out/sdk.txt"
   adb shell wm dismiss-keyguard || true
   return 0
  fi
  sleep 3
 done
 tail -80 "$out/emulator.log"
 return 1
}
