#!/usr/bin/env bash
# Check actual runner results, not merely the adb command exit status.
lab_check_instrumentation(){
 local file="$1" expected="$2" summary count
 [[ -s "$file" && "$expected" =~ ^[1-9][0-9]*$ ]] || return 1
 if [[ "$expected" == 1 ]];then summary='OK (1 test)';else summary="OK ($expected tests)";fi
 grep -Fx "$summary" "$file" || return 1
 grep -Fx 'INSTRUMENTATION_CODE: -1' "$file" || return 1
 count="$(grep -c '^INSTRUMENTATION_STATUS_CODE: 0$' "$file")" || return 1
 [[ "$count" == "$expected" ]] || return 1
 if grep -Eq '^INSTRUMENTATION_STATUS_CODE: -[1-9]|^FAILURES!!!|^INSTRUMENTATION_FAILED' "$file";then return 1;else [[ "$?" == 1 ]] || return 1;fi
}
