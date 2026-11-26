#!/usr/bin/env bash
# Fail closed even inside an errexit-exempt conditional. GNU grep status 1 is
# the only success condition for an absence assertion. A missing/unreadable
# report, invalid regex or actual forbidden entry must fail the build.
lab_assert_absent(){
 local pattern="$1" file="$2" status
 if [[ ! -f "$file" || ! -s "$file" || ! -r "$file" ]];then
  echo "Missing or unreadable APK report: $file" >&2
  return 1
 fi
 if grep -E -- "$pattern" "$file";then
  echo "Forbidden APK entry: $pattern" >&2
  return 1
 else
  status=$?
  if [[ "$status" -ne 1 ]];then
   echo "APK report verification failed: grep status $status" >&2
   return 1
  fi
 fi
 return 0
}
