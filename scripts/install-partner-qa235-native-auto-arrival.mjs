// APOIS_PARTNER_QA235_NATIVE_ARRIVAL_V1
// Reuses existing foreground DriverLocationService. No extra service or DB migration.
// Requires QA233 private service receiver and installed Navigator plugin.
import {readFileSync,writeFileSync} from "node:fs";
import {resolve} from "node:path";
const dir=resolve("superapp/partner-shell/android/app/src/main/java/br/com/apois/parceiro");
const pluginPath=resolve(dir,"APOISExternalNavigationPlugin.java");
const servicePath=resolve(dir,"DriverLocationService.java");
const plugin=readFileSync(pluginPath,"utf8"),service=readFileSync(servicePath,"utf8");
function once(s,a,b,label){const count=s.split(a).length-1;if(count!==1)throw Error("[FAIL] QA235 native "+label+" count="+count);return s.replace(a,b);}
if(!plugin.includes("APOISExternalNavigation")||!service.includes("APOIS_PARTNER_EXTERNAL_NAV_NOTIFICATION_V1"))
 throw Error("[FAIL] QA235 native existing services/plugins missing");
let p=plugin;
p=once(p,'        update.putExtra("operationActive", active);',
[
'        update.putExtra("operationActive", active);',
'        // QA235: only a real authenticated ride with pickup coordinates can',
'        // arm the existing native GPS service for automatic arrival.',
'        if ("motorista".equals(role) && active) {',
'            String rideId = call.getString("rideId", "");',
'            Double lat = call.getDouble("pickupLatitude");',
'            Double lng = call.getDouble("pickupLongitude");',
'            if (rideId != null && rideId.matches("[0-9a-fA-F-]{36}")',
'                    && lat != null && lng != null',
'                    && Double.isFinite(lat) && Double.isFinite(lng)',
'                    && lat >= -34 && lat <= 6 && lng >= -74 && lng <= -32) {',
'                update.putExtra("qa235RideId", rideId);',
'                update.putExtra("qa235PickupLat", lat.doubleValue());',
'                update.putExtra("qa235PickupLng", lng.doubleValue());',
'            }',
'        }'
].join("\n"),"pickup metadata on private operation broadcast");
let s=service;
s=once(s,'    private String refreshToken;',
[
'    private String refreshToken;',
'    // QA235: the existing GPS Foreground Service owns reliable proximity even',
'    // while Waze/Google Maps is the foreground Activity.',
'    private volatile String qa235RideId = "";',
'    private volatile double qa235PickupLat = 0d;',
'    private volatile double qa235PickupLng = 0d;',
'    private long qa235FirstAt = 0L;',
'    private long qa235LastAt = 0L;',
'    private int qa235Fixes = 0;',
'    private long qa235RetryAfterAt = 0L;',
'    private boolean qa235Sending = false;',
'    private static final String QA235_ARRIVAL_PREFS = "apois_driver_qa235_arrival";'
].join("\n"),"native arrival state");
s=once(s,'        super.onCreate();',
[
'        super.onCreate();',
'        // Persist only the assigned ride pickup through Android service re-creation.',
'        SharedPreferences qa235Prefs=getSharedPreferences(QA235_ARRIVAL_PREFS,MODE_PRIVATE);',
'        qa235RideId=qa235Prefs.getString("rideId","");',
'        qa235PickupLat=Double.longBitsToDouble(qa235Prefs.getLong("latBits",0L));',
'        qa235PickupLng=Double.longBitsToDouble(qa235Prefs.getLong("lngBits",0L));'
].join("\n"),"restore pickup on native FGS restart");
s=once(s,'            apoisOperationActive = intent.getBooleanExtra("operationActive", false);',
[
'            apoisOperationActive = intent.getBooleanExtra("operationActive", false);',
'            // Authenticated WebView publishes the current ride only while',
'            // travelling to pickup; other phases clear native arrival monitoring.',
'            String nextRide=apoisOperationActive ? intent.getStringExtra("qa235RideId") : null;',
'            double nextLat=intent.getDoubleExtra("qa235PickupLat",Double.NaN);',
'            double nextLng=intent.getDoubleExtra("qa235PickupLng",Double.NaN);',
'            if(nextRide!=null && nextRide.matches("[0-9a-fA-F-]{36}")',
'                    && Double.isFinite(nextLat) && Double.isFinite(nextLng)',
'                    && nextLat>=-34 && nextLat<=6 && nextLng>=-74 && nextLng<=-32){',
'                if(!nextRide.equals(qa235RideId)){qa235Fixes=0;qa235FirstAt=0;qa235Sending=false;}',
'                qa235RideId=nextRide;qa235PickupLat=nextLat;qa235PickupLng=nextLng;',
'                getSharedPreferences(QA235_ARRIVAL_PREFS,MODE_PRIVATE).edit()',
'                  .putString("rideId",qa235RideId)',
'                  .putLong("latBits",Double.doubleToRawLongBits(nextLat))',
'                  .putLong("lngBits",Double.doubleToRawLongBits(nextLng)).apply();',
'            }else{',
'                qa235RideId="";qa235Fixes=0;qa235FirstAt=0;',
'                getSharedPreferences(QA235_ARRIVAL_PREFS,MODE_PRIVATE).edit().clear().apply();',
'            }'
].join("\n"),"native receiver carry ride GPS");
s=once(s,'                queuePresenceSync(true, location);',
 '                queuePresenceSync(true, location);\n                qa235CheckPickupArrival(location);',
 "add arrival callback to existing real GPS provider");
const method=[
'    // QA235: real, fresh, accurate GPS only; 3 samples inside 85 meters',
'    // over >=6.5 s. The same backend RPC used by the original driver button',
'    // performs the transactional status change and then sends passenger push.',
'    private void qa235CheckPickupArrival(Location location){',
'        final String rideId=qa235RideId;',
'        if(!tracking || rideId==null || rideId.isEmpty() || !isUsableLocation(location))return;',
'        long now=System.currentTimeMillis();',
'        if(now-capturedAt(location)>15000L || !location.hasAccuracy() || location.getAccuracy()>65f)return;',
'        Location pickup=new Location("apois-pickup");',
'        pickup.setLatitude(qa235PickupLat);pickup.setLongitude(qa235PickupLng);',
'        if(location.distanceTo(pickup)>85f){qa235FirstAt=0L;qa235Fixes=0;return;}',
'        if(qa235Sending || now<qa235RetryAfterAt || now-qa235LastAt<2500L)return;',
'        if(qa235Fixes==0)qa235FirstAt=now;',
'        qa235LastAt=now;qa235Fixes++;',
'        if(qa235Fixes<3 || now-qa235FirstAt<6500L)return;',
'        qa235Sending=true;',
'        networkExecutor.execute(()->{',
'            boolean confirmed=qa235SendArrival(rideId,true);',
'            mainHandler.post(()->{',
'                qa235Sending=false;',
'                qa235Fixes=0;qa235FirstAt=0L;',
'                if(confirmed){',
'                    if(rideId.equals(qa235RideId)){qa235RideId="";',
'                        getSharedPreferences(QA235_ARRIVAL_PREFS,MODE_PRIVATE).edit().clear().apply();}',
'                }else{qa235RetryAfterAt=System.currentTimeMillis()+30000L;}',
'            });',
'        });',
'    }',
'    private boolean qa235SendArrival(String rideId,boolean allowRefresh){',
'        if(rideId==null || !rideId.equals(qa235RideId) ||',
'                supabaseUrl==null || supabaseUrl.isEmpty() ||',
'                accessToken==null || accessToken.isEmpty())return false;',
'        HttpURLConnection connection=null;',
'        try{',
'            connection=(HttpURLConnection)new URL(supabaseUrl+"/rest/v1/rpc/driver_mark_arrived").openConnection();',
'            connection.setRequestMethod("POST");connection.setDoOutput(true);',
'            connection.setConnectTimeout(10000);connection.setReadTimeout(10000);',
'            connection.setRequestProperty("Content-Type","application/json");',
'            connection.setRequestProperty("apikey",publishableKey);',
'            connection.setRequestProperty("Authorization","Bearer "+accessToken);',
'            JSONObject body=new JSONObject();body.put("_ride_id",rideId);',
'            try(OutputStream output=connection.getOutputStream()){',
'                output.write(body.toString().getBytes(StandardCharsets.UTF_8));',
'            }',
'            int status=connection.getResponseCode();consumeResponse(connection,status);',
'            if(status>=200&&status<300){',
'                qa235SendPush("ride.driver_arrived",rideId);',
'                return true;',
'            }',
'            if((status==401||status==403)&&allowRefresh&&refreshSession())return qa235SendArrival(rideId,false);',
'            return false;',
'        }catch(Exception ignored){return false;}',
'        finally{if(connection!=null)connection.disconnect();}',
'    }',
'    private void qa235SendPush(String event,String rideId){',
'        HttpURLConnection connection=null;',
'        try{',
'            connection=(HttpURLConnection)new URL(supabaseUrl+"/functions/v1/send-ride-push").openConnection();',
'            connection.setRequestMethod("POST");connection.setDoOutput(true);',
'            connection.setConnectTimeout(10000);connection.setReadTimeout(10000);',
'            connection.setRequestProperty("Content-Type","application/json");',
'            connection.setRequestProperty("apikey",publishableKey);',
'            connection.setRequestProperty("Authorization","Bearer "+accessToken);',
'            JSONObject body=new JSONObject();body.put("event",event);body.put("ride_id",rideId);',
'            try(OutputStream output=connection.getOutputStream()){',
'                output.write(body.toString().getBytes(StandardCharsets.UTF_8));',
'            }',
'            int status=connection.getResponseCode();consumeResponse(connection,status);',
'        }catch(Exception ignored){}',
'        finally{if(connection!=null)connection.disconnect();}',
'    }',
''].join("\n");
s=once(s,'    private void startAsForeground() {',method+'    private void startAsForeground() {',"insert native arrival sender before FGS startup");
for(const must of ["qa235SendArrival(","qa235SendPush(\"ride.driver_arrived\"","/rest/v1/rpc/driver_mark_arrived","ContextCompat.registerReceiver","startForeground(",
  "START_REDELIVER_INTENT","queuePresenceSync(true, location);"]){
 if(!s.includes(must))throw Error("[FAIL] QA235 native preserved "+must);
}
writeFileSync(pluginPath,p,"utf8");writeFileSync(servicePath,s,"utf8");
console.log("[OK] QA235 existing GPS FGS monitors verified pickup; original driver_mark_arrived RPC + passenger push in background, no new service");
