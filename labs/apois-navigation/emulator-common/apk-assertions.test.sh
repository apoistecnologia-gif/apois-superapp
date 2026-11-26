#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
source "$ROOT/emulator-common/apk-assertions.sh"
D="$(mktemp -d)"
trap 'rm -rf "$D"' EXIT
printf '%s\n' "package: name='br.com.apois.fixture'" > "$D/clean"
printf '%s\n' "uses-permission: name='android.permission.INTERNET'" > "$D/forbidden"
touch "$D/empty"
pattern='android\.permission\.INTERNET'
lab_assert_absent "$pattern" "$D/clean"
for file in "$D/forbidden" "$D/empty" "$D/missing";do
 if lab_assert_absent "$pattern" "$file";then echo "unexpected success for $file";exit 1;fi
done
if lab_assert_absent '[' "$D/clean";then echo 'invalid regex accepted';exit 1;fi
# Also simulate grep IO error after file preflight.
if (grep(){ return 2; }; lab_assert_absent "$pattern" "$D/clean");then echo 'grep error accepted';exit 1;fi
if bash -e -c 'source "$1"; lab_assert_absent "$2" "$3" || exit 1; echo false-success' _ "$ROOT/emulator-common/apk-assertions.sh" "$pattern" "$D/forbidden";then
 echo 'failed guard did not terminate build';exit 1
fi
scripts=(embedded-probe/build.sh embedded-northeast/android-build.sh launch-vale/android-build.sh launch-vale/pack-android-build.sh physical-lab/build.sh physical-passenger/build.sh field-apk/build.sh field-v3/build.sh field-v4/build.sh field-v42/build.sh)
for script in "${scripts[@]}";do
 bash -n "$ROOT/$script"
 grep -F 'source "$ROOT/emulator-common/apk-assertions.sh"' "$ROOT/$script"
 grep -E '^lab_assert_absent .+ \|\| exit 1$' "$ROOT/$script"
 if grep -E '^! grep|^if grep.*android.permission' "$ROOT/$script";then echo "unsafe absence check: $script";exit 1;fi
done
echo APOIS_APK_ABSENCE_GUARD_OK
