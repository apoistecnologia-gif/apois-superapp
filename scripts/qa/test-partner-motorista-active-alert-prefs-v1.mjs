import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
const p=resolve(process.env.APOIS_MOTORISTA_WORKSPACE||".work/partner-motorista","src/routes/motorista.app.tsx");
const s=readFileSync(p,"utf8");
for (const required of [
"APOIS_DRIVER_PREFS_ACTIVE_V1",
"loadDriverPrefs(userId)",
"ridePrefsRef.current=ridePrefs;",
"ridePrefsRef.current.ride_alerts && ridePrefsRef.current.vibration && navigator.vibrate",
"soundEnabled={ridePrefs.ride_alerts && ridePrefs.sound}",
"voiceAlertEnabled={ridePrefs.ride_alerts}",
"if (soundEnabled) startRideRingtone();",
"if (voiceAlertEnabled) void speak(\"Nova corrida\"",
"return () => { stopRideRingtone(); };",
])assert.ok(s.includes(required),"Ride UX preference missing "+required);
assert.ok(!s.includes('if (navigator.vibrate) navigator.vibrate('),"No unconditional vibration");
assert.ok(s.includes("<IncomingOffer"),"Offers remain in UI");
assert.ok(s.includes("await callAccept("),"Accept still calls server");
const shouldRing=(p)=>p.ride_alerts&&p.sound;
const shouldVibrate=(p)=>p.ride_alerts&&p.vibration;
assert.equal(shouldRing({ride_alerts:false,sound:true,vibration:true}),false);
assert.equal(shouldVibrate({ride_alerts:true,sound:true,vibration:false}),false);
assert.equal(shouldRing({ride_alerts:true,sound:true,vibration:true}),true);
console.log("[PASS] Driver sound/vibration preferences affect offer alerts, never server dispatch.");
