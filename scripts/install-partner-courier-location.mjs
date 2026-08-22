import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const androidRoot = resolve('superapp/partner-shell/android');
const javaRoot = resolve(androidRoot, 'app/src/main/java/br/com/apois/parceiro');
const manifestPath = resolve(androidRoot, 'app/src/main/AndroidManifest.xml');
const appGradlePath = resolve(androidRoot, 'app/build.gradle');
const mainActivityPath = resolve(javaRoot, 'MainActivity.java');

for (const path of [manifestPath, appGradlePath, mainActivityPath]) {
  if (!existsSync(path)) throw new Error(`APOIS Parceiro: Android ausente para instalar CourierLocation: ${path}`);
}

const pluginJava = `package br.com.apois.parceiro;

import android.content.Intent;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "CourierLocation")
public class CourierLocationPlugin extends Plugin {
    @PluginMethod
    public void start(PluginCall call) {
        String supabaseUrl = call.getString("supabaseUrl", "");
        String publishableKey = call.getString("publishableKey", "");
        String accessToken = call.getString("accessToken", "");
        String refreshToken = call.getString("refreshToken", "");
        if (supabaseUrl.isEmpty() || publishableKey.isEmpty() || accessToken.isEmpty()) {
            call.reject("Sessão/configuração ausente para localização do entregador em segundo plano.");
            return;
        }
        Intent intent = new Intent(getContext(), CourierLocationService.class);
        intent.setAction(CourierLocationService.ACTION_START);
        intent.putExtra(CourierLocationService.EXTRA_SUPABASE_URL, supabaseUrl);
        intent.putExtra(CourierLocationService.EXTRA_PUBLISHABLE_KEY, publishableKey);
        intent.putExtra(CourierLocationService.EXTRA_ACCESS_TOKEN, accessToken);
        intent.putExtra(CourierLocationService.EXTRA_REFRESH_TOKEN, refreshToken);
        ContextCompat.startForegroundService(getContext(), intent);
        JSObject result = new JSObject();
        result.put("started", true);
        call.resolve(result);
    }

    @PluginMethod
    public void stop(PluginCall call) {
        Intent intent = new Intent(getContext(), CourierLocationService.class);
        intent.setAction(CourierLocationService.ACTION_STOP);
        getContext().startService(intent);
        JSObject result = new JSObject();
        result.put("stopped", true);
        call.resolve(result);
    }
}
`;

const serviceJava = `package br.com.apois.parceiro;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ServiceInfo;
import android.location.Location;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import androidx.annotation.Nullable;
import androidx.core.app.ActivityCompat;
import androidx.core.app.NotificationCompat;
import com.google.android.gms.location.FusedLocationProviderClient;
import com.google.android.gms.location.LocationCallback;
import com.google.android.gms.location.LocationRequest;
import com.google.android.gms.location.LocationResult;
import com.google.android.gms.location.LocationServices;
import com.google.android.gms.location.Priority;
import org.json.JSONObject;
import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;

public class CourierLocationService extends Service {
    public static final String ACTION_START = "br.com.apois.parceiro.action.START_COURIER_LOCATION";
    public static final String ACTION_STOP = "br.com.apois.parceiro.action.STOP_COURIER_LOCATION";
    public static final String EXTRA_SUPABASE_URL = "supabaseUrl";
    public static final String EXTRA_PUBLISHABLE_KEY = "publishableKey";
    public static final String EXTRA_ACCESS_TOKEN = "accessToken";
    public static final String EXTRA_REFRESH_TOKEN = "refreshToken";

    private static final String CHANNEL_ID = "apois_courier_location";
    private static final int NOTIFICATION_ID = 41022;
    private static final long HEARTBEAT_MS = 45_000L;
    private static final long MIN_SEND_INTERVAL_MS = 5_000L;
    private static final float MIN_SEND_DISTANCE_METERS = 30f;

    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private final ExecutorService networkExecutor = Executors.newSingleThreadExecutor();
    private final AtomicBoolean syncQueued = new AtomicBoolean(false);
    private FusedLocationProviderClient fusedLocationClient;
    private LocationCallback locationCallback;
    private Location latestLocation;
    private Location lastSentLocation;
    private long lastSentAt = 0L;
    private boolean tracking = false;
    private String supabaseUrl = "";
    private String publishableKey = "";
    private String accessToken = "";
    private String refreshToken = "";

    private final Runnable heartbeat = new Runnable() {
        @Override public void run() {
            if (!tracking) return;
            if (latestLocation != null) queueLocationSync(latestLocation, true);
            mainHandler.postDelayed(this, HEARTBEAT_MS);
        }
    };

    @Override public void onCreate() {
        super.onCreate();
        fusedLocationClient = LocationServices.getFusedLocationProviderClient(this);
        locationCallback = new LocationCallback() {
            @Override public void onLocationResult(LocationResult result) {
                Location location = result.getLastLocation();
                if (location == null || !validCoordinate(location.getLatitude(), location.getLongitude())) return;
                latestLocation = location;
                queueLocationSync(location, false);
            }
        };
        createNotificationChannel();
    }

    @Override public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && ACTION_STOP.equals(intent.getAction())) {
            stopTracking();
            return START_NOT_STICKY;
        }
        if (intent == null || !ACTION_START.equals(intent.getAction())) return START_NOT_STICKY;
        supabaseUrl = normalizeUrl(intent.getStringExtra(EXTRA_SUPABASE_URL));
        publishableKey = safe(intent.getStringExtra(EXTRA_PUBLISHABLE_KEY));
        accessToken = safe(intent.getStringExtra(EXTRA_ACCESS_TOKEN));
        refreshToken = safe(intent.getStringExtra(EXTRA_REFRESH_TOKEN));
        if (supabaseUrl.isEmpty() || publishableKey.isEmpty() || accessToken.isEmpty()) {
            stopSelf();
            return START_NOT_STICKY;
        }
        startAsForeground();
        startLocationUpdates();
        return START_REDELIVER_INTENT;
    }

    private void startAsForeground() {
        Notification notification = buildNotification();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION);
        } else startForeground(NOTIFICATION_ID, notification);
    }

    private Notification buildNotification() {
        Intent openApp = new Intent(this, MainActivity.class);
        openApp.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pendingIntent = PendingIntent.getActivity(this, 22, openApp, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_apois_notification)
            .setContentTitle("APOIS Entregador online")
            .setContentText("Sua localização está ativa enquanto você recebe ou realiza entregas.")
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setContentIntent(pendingIntent)
            .build();
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationChannel channel = new NotificationChannel(CHANNEL_ID, "Localização do entregador", NotificationManager.IMPORTANCE_LOW);
        channel.setDescription("Mantém a localização ativa durante a disponibilidade e as entregas.");
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager != null) manager.createNotificationChannel(channel);
    }

    private void startLocationUpdates() {
        if (tracking) return;
        boolean fine = ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED;
        boolean coarse = ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED;
        if (!fine && !coarse) { stopSelf(); return; }
        LocationRequest request = new LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, 5_000L)
            .setMinUpdateIntervalMillis(3_000L)
            .setMinUpdateDistanceMeters(5f)
            .build();
        try {
            tracking = true;
            fusedLocationClient.requestLocationUpdates(request, locationCallback, Looper.getMainLooper());
            mainHandler.removeCallbacks(heartbeat);
            mainHandler.postDelayed(heartbeat, HEARTBEAT_MS);
        } catch (SecurityException error) {
            tracking = false;
            stopSelf();
        }
    }

    private void stopTracking() {
        tracking = false;
        latestLocation = null;
        lastSentLocation = null;
        lastSentAt = 0L;
        mainHandler.removeCallbacks(heartbeat);
        try { fusedLocationClient.removeLocationUpdates(locationCallback); } catch (Exception ignored) {}
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) stopForeground(STOP_FOREGROUND_REMOVE); else stopForeground(true);
        stopSelf();
    }

    private void queueLocationSync(Location location, boolean force) {
        if (location == null || !validCoordinate(location.getLatitude(), location.getLongitude())) return;
        long now = System.currentTimeMillis();
        if (!force && lastSentLocation != null) {
            long elapsed = now - lastSentAt;
            float moved = lastSentLocation.distanceTo(location);
            if (elapsed < HEARTBEAT_MS && moved < MIN_SEND_DISTANCE_METERS) return;
            if (elapsed < MIN_SEND_INTERVAL_MS) return;
        }
        if (!syncQueued.compareAndSet(false, true)) return;
        networkExecutor.execute(() -> {
            try {
                if (syncLocation(location, true)) {
                    lastSentLocation = new Location(location);
                    lastSentAt = System.currentTimeMillis();
                }
            } finally { syncQueued.set(false); }
        });
    }

    private boolean syncLocation(Location location, boolean allowRefresh) {
        HttpURLConnection connection = null;
        try {
            URL url = new URL(supabaseUrl + "/rest/v1/rpc/update_courier_location");
            connection = (HttpURLConnection) url.openConnection();
            connection.setRequestMethod("POST");
            connection.setConnectTimeout(10_000);
            connection.setReadTimeout(10_000);
            connection.setDoOutput(true);
            connection.setRequestProperty("Content-Type", "application/json");
            connection.setRequestProperty("apikey", publishableKey);
            connection.setRequestProperty("Authorization", "Bearer " + accessToken);
            connection.setRequestProperty("Prefer", "return=minimal");
            JSONObject body = new JSONObject();
            body.put("_latitude", location.getLatitude());
            body.put("_longitude", location.getLongitude());
            body.put("_accuracy_meters", location.hasAccuracy() ? location.getAccuracy() : JSONObject.NULL);
            body.put("_heading", location.hasBearing() ? location.getBearing() : JSONObject.NULL);
            body.put("_speed_mps", location.hasSpeed() && location.getSpeed() >= 0f ? location.getSpeed() : JSONObject.NULL);
            try (OutputStream output = connection.getOutputStream()) {
                output.write(body.toString().getBytes(StandardCharsets.UTF_8));
            }
            int status = connection.getResponseCode();
            consumeResponse(connection, status);
            if (status >= 200 && status < 300) return true;
            if ((status == 401 || status == 403) && allowRefresh && refreshSession()) return syncLocation(location, false);
            return false;
        } catch (Exception ignored) {
            return false;
        } finally { if (connection != null) connection.disconnect(); }
    }

    private boolean refreshSession() {
        if (refreshToken.isEmpty()) return false;
        HttpURLConnection connection = null;
        try {
            URL url = new URL(supabaseUrl + "/auth/v1/token?grant_type=refresh_token");
            connection = (HttpURLConnection) url.openConnection();
            connection.setRequestMethod("POST");
            connection.setConnectTimeout(10_000);
            connection.setReadTimeout(10_000);
            connection.setDoOutput(true);
            connection.setRequestProperty("Content-Type", "application/json");
            connection.setRequestProperty("apikey", publishableKey);
            JSONObject body = new JSONObject();
            body.put("refresh_token", refreshToken);
            try (OutputStream output = connection.getOutputStream()) { output.write(body.toString().getBytes(StandardCharsets.UTF_8)); }
            int status = connection.getResponseCode();
            if (status < 200 || status >= 300) { consumeResponse(connection, status); return false; }
            JSONObject json = new JSONObject(readStream(connection.getInputStream()));
            String nextAccess = json.optString("access_token", "");
            String nextRefresh = json.optString("refresh_token", "");
            if (nextAccess.isEmpty()) return false;
            accessToken = nextAccess;
            if (!nextRefresh.isEmpty()) refreshToken = nextRefresh;
            return true;
        } catch (Exception ignored) { return false; }
        finally { if (connection != null) connection.disconnect(); }
    }

    private static boolean validCoordinate(double lat, double lng) {
        return !Double.isNaN(lat) && !Double.isInfinite(lat) && !Double.isNaN(lng) && !Double.isInfinite(lng)
            && lat >= -90d && lat <= 90d && lng >= -180d && lng <= 180d;
    }
    private static void consumeResponse(HttpURLConnection connection, int status) {
        try { InputStream stream = status >= 400 ? connection.getErrorStream() : connection.getInputStream(); if (stream != null) readStream(stream); } catch (Exception ignored) {}
    }
    private static String readStream(InputStream stream) throws Exception {
        StringBuilder builder = new StringBuilder();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(stream, StandardCharsets.UTF_8))) {
            String line; while ((line = reader.readLine()) != null) builder.append(line);
        }
        return builder.toString();
    }
    private static String normalizeUrl(String value) {
        String result = safe(value).trim(); while (result.endsWith("/")) result = result.substring(0, result.length() - 1); return result;
    }
    private static String safe(String value) { return value == null ? "" : value; }

    @Override public void onDestroy() {
        tracking = false;
        mainHandler.removeCallbacks(heartbeat);
        try { if (fusedLocationClient != null && locationCallback != null) fusedLocationClient.removeLocationUpdates(locationCallback); } catch (Exception ignored) {}
        networkExecutor.shutdownNow();
        super.onDestroy();
    }
    @Nullable @Override public IBinder onBind(Intent intent) { return null; }
}
`;

writeFileSync(resolve(javaRoot, 'CourierLocationPlugin.java'), pluginJava, 'utf8');
writeFileSync(resolve(javaRoot, 'CourierLocationService.java'), serviceJava, 'utf8');

let mainActivity = readFileSync(mainActivityPath, 'utf8');
if (!mainActivity.includes('registerPlugin(CourierLocationPlugin.class)')) {
  const anchor = '        registerPlugin(DriverLocationPlugin.class);';
  if (!mainActivity.includes(anchor)) throw new Error('APOIS Parceiro: DriverLocation precisa estar instalado antes de CourierLocation.');
  mainActivity = mainActivity.replace(anchor, `${anchor}\n        registerPlugin(CourierLocationPlugin.class);`);
}
writeFileSync(mainActivityPath, mainActivity, 'utf8');

let manifest = readFileSync(manifestPath, 'utf8');
if (!manifest.includes('android.permission.FOREGROUND_SERVICE_LOCATION')) {
  throw new Error('APOIS Parceiro: permissão FOREGROUND_SERVICE_LOCATION deveria ter sido instalada pelo host.');
}
if (!manifest.includes('android:name=".CourierLocationService"')) {
  const xml = `\n        <service\n            android:name=".CourierLocationService"\n            android:exported="false"\n            android:foregroundServiceType="location"\n            android:stopWithTask="false" />\n`;
  manifest = manifest.replace('</application>', `${xml}    </application>`);
}
manifest = manifest.replace(/\s*<uses-permission\s+android:name="android\.permission\.ACCESS_BACKGROUND_LOCATION"\s*\/?>\s*/g, '\n');
writeFileSync(manifestPath, manifest, 'utf8');

const gradle = readFileSync(appGradlePath, 'utf8');
if (!gradle.includes('com.google.android.gms:play-services-location:21.3.0')) {
  throw new Error('APOIS Parceiro: play-services-location precisa estar disponível para CourierLocation.');
}

const finalMain = readFileSync(mainActivityPath, 'utf8');
const finalManifest = readFileSync(manifestPath, 'utf8');
for (const marker of [
  'registerPlugin(CourierLocationPlugin.class)',
  'android:name=".CourierLocationService"',
  'android:foregroundServiceType="location"',
]) {
  const target = marker.startsWith('registerPlugin') ? finalMain : finalManifest;
  if (!target.includes(marker)) throw new Error(`APOIS Parceiro: CourierLocation incompleto (${marker}).`);
}
if (finalManifest.includes('android.permission.ACCESS_BACKGROUND_LOCATION')) throw new Error('APOIS Parceiro: CourierLocation não deve reintroduzir ACCESS_BACKGROUND_LOCATION.');

console.log('[OK] APOIS Parceiro: CourierLocation nativo instalado para manter GPS/heartbeat do Entregador durante tela bloqueada ou app em segundo plano, sem solicitar ACCESS_BACKGROUND_LOCATION.');
