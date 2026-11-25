// Source transformation for a disposable host only. No imports from production.
import assert from "node:assert/strict";
const FEED="br.com.apois.navigation.lab.DriverGpsFeed";
function once(s,a,b) {
  assert.equal(s.split(a).length-1,1,"GPS lab anchor missing or ambiguous: "+a);
  return s.replace(a,b);
}
export function instrumentDriverService(source) {
  assert.ok(!source.includes("APOIS_LAB_PASSIVE_GPS"),"already instrumented");
  for(const marker of ["public class DriverLocationService extends Service {","requestLocationUpdates(request, locationCallback, Looper.getMainLooper())","queuePresenceSync(true, location);","START_REDELIVER_INTENT","driver_set_presence","setStartupConfirmed(true);",".setMinUpdateDistanceMeters(0f)"])
    assert.ok(source.includes(marker),"not expected QA290 driver source: "+marker);
  let s=once(source,"public class DriverLocationService extends Service {",
    "public class DriverLocationService extends Service {\n    // APOIS_LAB_PASSIVE_GPS — disposable host only\n    private long labGpsSource = 0L;");
  s=once(s,"        supabaseUrl = normalizeUrl(intent.getStringExtra(EXTRA_SUPABASE_URL));",
    "        labGpsEnd(); // every START invalidates old account/source epoch\n        supabaseUrl = normalizeUrl(intent.getStringExtra(EXTRA_SUPABASE_URL));");
  s=once(s,"        startLocationUpdates();",
    "        startLocationUpdates();\n        if (tracking) labGpsBegin();");
  const after=source.includes("                qa235CheckPickupArrival(location);")
    ?"                qa235CheckPickupArrival(location);":"                queuePresenceSync(true, location);";
  s=once(s,after,after+"\n                labGpsPublish(location);");
  s=once(s,"    private void stopFromDriverAction() {",
    "    private void stopFromDriverAction() {\n        labGpsEnd();");
  s=once(s,"    public void onDestroy() {",
    "    public void onDestroy() {\n        labGpsEnd();");
  s=once(s,"    private void startLocationUpdates() {",`    private void labGpsBegin() {
        try { labGpsSource = ${FEED}.beginSource(); }
        catch (RuntimeException | LinkageError ignored) { labGpsSource = 0L; }
    }
    private void labGpsEnd() {
        final long old = labGpsSource;
        labGpsSource = 0L;
        if (old == 0L) return;
        try { ${FEED}.endSource(old); }
        catch (RuntimeException | LinkageError ignored) { }
    }
    private void labGpsPublish(Location location) {
        final long epoch = labGpsSource;
        if (!tracking || epoch == 0L) return;
        try {
            if (!${FEED}.hasConsumer(epoch)) return;
            final Location copy = new Location(location);
            // Existing presence / arrival callbacks finish first. Never replay the disk buffer.
            mainHandler.post(() -> {
                if (!tracking || labGpsSource != epoch) return;
                try { ${FEED}.publish(epoch, copy); }
                catch (RuntimeException | LinkageError ignored) { labGpsEnd(); }
            });
        } catch (RuntimeException | LinkageError ignored) { labGpsEnd(); }
    }

    private void startLocationUpdates() {`);
  assert.equal((s.match(/requestLocationUpdates\(/g)||[]).length,(source.match(/requestLocationUpdates\(/g)||[]).length);
  assert.equal((s.match(/removeLocationUpdates\(/g)||[]).length,(source.match(/removeLocationUpdates\(/g)||[]).length);
  return s;
}
