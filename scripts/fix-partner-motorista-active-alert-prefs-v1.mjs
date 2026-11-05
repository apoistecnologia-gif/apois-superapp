// UX-02: make persisted device preferences control audible/vibration ride alerts.
// No Supabase writes, dispatch contract changes, or new native permissions.
import {readFileSync,writeFileSync} from "node:fs";
import {resolve} from "node:path";
const root=resolve(process.env.APOIS_MOTORISTA_WORKSPACE||".work/partner-motorista");
const file=resolve(root,"src/routes/motorista.app.tsx");
let s=readFileSync(file,"utf8");
function one(old,replacement,label){const n=s.split(old).length-1;if(n!==1)throw Error("[FAIL] Driver preference "+label+" n="+n);s=s.replace(old,replacement);}
one('import { startRideRingtone, stopRideRingtone } from "@/lib/rideRingtone";',
'import { startRideRingtone, stopRideRingtone } from "@/lib/rideRingtone";\nimport {loadDriverPrefs, DEFAULT_DRIVER_PREFS, type DriverPrefs} from "@/lib/driverPrefs";',"prefs import");
one('  const [driverId, setDriverId] = useState<string | null>(null);',
`  const [driverId, setDriverId] = useState<string | null>(null);
  // APOIS_DRIVER_PREFS_ACTIVE_V1: UI-alert preferences are local to the logged-in driver.
  const [ridePrefs,setRidePrefs] = useState<DriverPrefs>(DEFAULT_DRIVER_PREFS);
  const ridePrefsRef=useRef(ridePrefs);
  useEffect(()=>{ridePrefsRef.current=ridePrefs;},[ridePrefs]);
  useEffect(() => {
    let active=true;
    if (!userId) { setRidePrefs(DEFAULT_DRIVER_PREFS); return; }
    const reload = () => { void loadDriverPrefs(userId).then(value=>{if(active)setRidePrefs(value);}).catch(()=>undefined); };
    reload();
    window.addEventListener("focus",reload);
    document.addEventListener("visibilitychange",reload);
    return () => {active=false;window.removeEventListener("focus",reload);document.removeEventListener("visibilitychange",reload);};
  },[userId]);`,"prefs lifecycle");
const vibrate1='if (navigator.vibrate) navigator.vibrate([280, 120, 280, 120, 280]);';
const vibrate2='if (navigator.vibrate) navigator.vibrate([220, 90, 220, 90, 220]);';
one(vibrate1,'if (ridePrefsRef.current.ride_alerts && ridePrefsRef.current.vibration && navigator.vibrate) navigator.vibrate([280, 120, 280, 120, 280]);',"offer vibration");
one(vibrate2,'if (ridePrefsRef.current.ride_alerts && ridePrefsRef.current.vibration && navigator.vibrate) navigator.vibrate([220, 90, 220, 90, 220]);',"cancellation vibration");
one('          countdown={countdown}\n          driverPos={position}',
'          countdown={countdown}\n          soundEnabled={ridePrefs.ride_alerts && ridePrefs.sound}\n          voiceAlertEnabled={ridePrefs.ride_alerts}\n          driverPos={position}',"offer properties");
one('  ride, passenger, countdown, driverPos, onAccept, onReject, onOpenProfile,',
'  ride, passenger, countdown, soundEnabled, voiceAlertEnabled, driverPos, onAccept, onReject, onOpenProfile,',"offer signature");
one('  ride: RideRow; passenger: Passenger | null; countdown: number;',
'  ride: RideRow; passenger: Passenger | null; countdown: number;\n  soundEnabled: boolean; voiceAlertEnabled: boolean;',"offer types");
one(`  useEffect(() => {
    startRideRingtone();
    void speak("Nova corrida", { interrupt: true });
    return () => { stopRideRingtone(); };
  }, []);`,
`  useEffect(() => {
    if (soundEnabled) startRideRingtone();
    if (voiceAlertEnabled) void speak("Nova corrida", { interrupt: true });
    return () => { stopRideRingtone(); };
  }, [ride.id, soundEnabled, voiceAlertEnabled]);`,"ringtone effect");
for(const check of ["ridePrefsRef.current.ride_alerts && ridePrefsRef.current.vibration","if (soundEnabled) startRideRingtone();","loadDriverPrefs(userId)"])if(!s.includes(check))throw Error("[FAIL] prefs marker "+check);
writeFileSync(file,s,"utf8");
console.log("[OK] Motorista offer sound/vibration respects persisted settings; incoming offers still displayed.");
