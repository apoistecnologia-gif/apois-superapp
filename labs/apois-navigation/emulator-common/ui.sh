#!/usr/bin/env bash
# Disposable CI UI validation. Never dismiss an APOIS error or ANR.
lab_dump_ui(){
 local file="$1"
 timeout 20 adb shell uiautomator dump /sdcard/apois-lab-view.xml >/dev/null &&
 adb pull /sdcard/apois-lab-view.xml "$file" >/dev/null
}
lab_click_xml(){
 local file="$1" pkg="$2" text="$3"
 local xy
 xy="$(python3 - "$file" "$pkg" "$text" <<'PY'
import re,sys,xml.etree.ElementTree as E
root=E.parse(sys.argv[1]).getroot()
for n in root.iter("node"):
    if n.get("package")==sys.argv[2] and (n.get("text")==sys.argv[3] or n.get("resource-id")==sys.argv[3]):
        m=re.fullmatch(r"\[(\d+),(\d+)\]\[(\d+),(\d+)\]",n.get("bounds",""))
        if m:
            x1,y1,x2,y2=map(int,m.groups())
            if x2>x1 and y2>y1: print((x1+x2)//2,(y1+y2)//2);break
else: sys.exit(1)
PY
)" || return 1
 adb shell input tap $xy
}
lab_wait_screen(){
 local pkg="$1" activity="$2" expected="$3" out="$4"
 local deadline=$((SECONDS+75)) dismissed=0
 while (( SECONDS < deadline ));do
  if ! lab_dump_ui "$out/view.xml";then sleep 2;continue;fi
  # Only the known external Pixel Launcher dialog may be dismissed. Record
  # it, re-open the same APK, and still require the actual app UI afterward.
  if python3 - "$out/view.xml" <<'PY'
import sys,xml.etree.ElementTree as E
nodes=list(E.parse(sys.argv[1]).getroot().iter("node"))
sys.exit(0 if any(n.get("package")=="android" and n.get("text")=="Pixel Launcher isn't responding" for n in nodes) else 1)
PY
  then
   (( dismissed+=1 ))
   if (( dismissed>2 ));then return 1;fi
   cp "$out/view.xml" "$out/external-launcher-anr-$dismissed.xml"
   lab_click_xml "$out/view.xml" android android:id/aerr_close
   sleep 2
   adb shell am start -W -n "$pkg/$activity" | tee -a "$out/relaunch.txt"
  elif python3 - "$out/view.xml" "$pkg" "$expected" <<'PY'
import sys,xml.etree.ElementTree as E
nodes=list(E.parse(sys.argv[1]).getroot().iter("node"))
sys.exit(0 if any(n.get("package")==sys.argv[2] and sys.argv[3] in n.get("text","") for n in nodes) else 1)
PY
  then
   adb shell pidof "$pkg" > "$out/pid.txt"
   test -s "$out/pid.txt"
   return 0
  elif grep -Ei 'APOIS[^"]*(isn.t responding|keeps stopping)' "$out/view.xml";then
   echo 'APOIS app error, not dismissed';return 1
  fi
  sleep 2
 done
 echo "Expected app screen not observed: $expected"
 return 1
}
