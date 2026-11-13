package br.com.apois.parceiro;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.Context;
import android.content.SharedPreferences;
import android.net.Uri;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * APOIS_PARTNER_EXTERNAL_NAV_V1.
 * Starts the external installed navigation Activity from a user gesture.
 * Uses documented schemes and official HTTPS fallback, never an embedded browser.
 * Does not touch operational state, authentication, location or Supabase.
 */
@CapacitorPlugin(name = "APOISExternalNavigation")
public class APOISExternalNavigationPlugin extends Plugin {

    private static final String GPS_STARTUP_PREFS = "apois_partner_location_service_status";

    @PluginMethod
    public void open(PluginCall call) {
        final String provider = call.getString("provider", "");
        final Double latitude = call.getDouble("latitude");
        final Double longitude = call.getDouble("longitude");
        if (!"google".equals(provider) && !"waze".equals(provider)) {
            call.reject("Aplicativo de navegação inválido.");
            return;
        }
        if (latitude == null || longitude == null ||
                !Double.isFinite(latitude) || !Double.isFinite(longitude) ||
                Math.abs(latitude) > 90 || Math.abs(longitude) > 180 ||
                (latitude == 0.0 && longitude == 0.0)) {
            call.reject("Coordenadas de navegação inválidas.");
            return;
        }
        final Activity activity = getActivity();
        if (activity == null) {
            call.reject("O APOIS não está visível para abrir um aplicativo externo.");
            return;
        }
        final String coordinate = String.format(java.util.Locale.US, "%.6f,%.6f", latitude, longitude);
        activity.runOnUiThread(() -> {
            try {
                final Intent installed;
                final String https;
                if ("google".equals(provider)) {
                    installed = new Intent(Intent.ACTION_VIEW,
                        Uri.parse("google.navigation:q=" + coordinate + "&mode=d"));
                    installed.setPackage("com.google.android.apps.maps");
                    https = "https://www.google.com/maps/dir/?api=1&destination=" +
                        Uri.encode(coordinate) + "&travelmode=driving&dir_action=navigate";
                } else {
                    installed = new Intent(Intent.ACTION_VIEW,
                        Uri.parse("waze://?ll=" + coordinate + "&navigate=yes"));
                    installed.setPackage("com.waze");
                    https = "https://waze.com/ul?ll=" +
                        Uri.encode(coordinate) + "&navigate=yes&utm_source=apois_parceiro";
                }
                boolean fallback = false;
                try {
                    activity.startActivity(installed);
                } catch (ActivityNotFoundException | SecurityException unavailable) {
                    // Official universal URL opens the app if available or a browser otherwise.
                    fallback = true;
                    Intent universal = new Intent(Intent.ACTION_VIEW, Uri.parse(https));
                    universal.addCategory(Intent.CATEGORY_BROWSABLE);
                    activity.startActivity(universal);
                }
                JSObject response = new JSObject();
                response.put("opened", true);
                response.put("fallback", fallback);
                response.put("provider", provider);
                call.resolve(response);
            } catch (Exception error) {
                call.reject("Não foi possível abrir a navegação externa. Confira os aplicativos instalados.", error);
            }
        });
    }

    @PluginMethod
    public void setOperation(PluginCall call) {
        String role = call.getString("role", "");
        if (!"motorista".equals(role) && !"entregador".equals(role)) {
            call.reject("Papel operacional inválido.");
            return;
        }
        boolean active = Boolean.TRUE.equals(call.getBoolean("active"));
        SharedPreferences status = getContext().getSharedPreferences(GPS_STARTUP_PREFS, Context.MODE_PRIVATE);
        String key = "motorista".equals(role) ? "driver_running" : "courier_running";
        if (!status.getBoolean(key, false)) {
            // Never start a new Android Service to update the notification.
            JSObject reply = new JSObject();
            reply.put("updated", false);
            call.resolve(reply);
            return;
        }
        // Broadcast directly to the RECEIVER registered by the existing running
        // GPS service. Never call startService: doing so would alter restart
        // semantics and might strand background tracking after process recreation.
        Intent update = new Intent("br.com.apois.parceiro.action.UPDATE_" +
            ("motorista".equals(role) ? "DRIVER" : "COURIER") + "_OPERATION");
        update.setPackage(getContext().getPackageName());
        update.putExtra("operationActive", active);
        try {
            getContext().sendBroadcast(update); // Receiver is not exported.
            JSObject reply = new JSObject();
            reply.put("updated", true);
            call.resolve(reply);
        } catch (Exception error) {
            call.reject("Não foi possível atualizar a notificação do serviço operacional.", error);
        }
    }
}
