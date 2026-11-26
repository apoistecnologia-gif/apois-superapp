#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
source "$ROOT/emulator-common/instrumentation-check.sh"
D="$(mktemp -d)";trap 'rm -rf "$D"' EXIT
printf '%s\n' 'INSTRUMENTATION_STATUS_CODE: 0' 'OK (1 test)' 'INSTRUMENTATION_CODE: -1' > "$D/one"
printf '%s\n' 'INSTRUMENTATION_STATUS_CODE: 0' 'INSTRUMENTATION_STATUS_CODE: 0' 'OK (2 tests)' 'INSTRUMENTATION_CODE: -1' > "$D/two"
lab_check_instrumentation "$D/one" 1
lab_check_instrumentation "$D/two" 2
if lab_check_instrumentation "$D/two" 1;then exit 1;fi
cp "$D/two" "$D/bad";echo 'INSTRUMENTATION_STATUS_CODE: -2' >> "$D/bad"
if lab_check_instrumentation "$D/bad" 2;then exit 1;fi
sed '/INSTRUMENTATION_CODE/d' "$D/two" > "$D/missing"
if lab_check_instrumentation "$D/missing" 2;then exit 1;fi
if lab_check_instrumentation "$D/missing" 0;then exit 1;fi
echo APOIS_INSTRUMENTATION_GUARD_OK
