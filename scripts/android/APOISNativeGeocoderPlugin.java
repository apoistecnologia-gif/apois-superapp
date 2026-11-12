package br.com.apois.app;

// APOIS_NATIVE_GEOCODER_RECOVERY_V1: Android OS reverse geocoding, without a
// Google Maps server key or requests to a new third-party provider.
import android.location.Address;
import android.location.Geocoder;
import android.os.Build;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.List;
import java.util.Locale;

@CapacitorPlugin(name = "APOISNativeGeocoder")
public class APOISNativeGeocoderPlugin extends Plugin {

    @PluginMethod
    public void reverse(PluginCall call) {
        Double latitude = call.getDouble("lat");
        Double longitude = call.getDouble("lng");
        if (latitude == null || longitude == null
                || !Double.isFinite(latitude) || !Double.isFinite(longitude)
                || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
            call.reject("invalid_coordinates");
            return;
        }
        if (!Geocoder.isPresent()) {
            call.reject("android_geocoder_unavailable");
            return;
        }
        final Geocoder geocoder = new Geocoder(getContext(), Locale.forLanguageTag("pt-BR"));
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            try {
                geocoder.getFromLocation(latitude, longitude, 1, new Geocoder.GeocodeListener() {
                    @Override
                    public void onGeocode(List<Address> addresses) {
                        resolveAddress(call, addresses);
                    }
                    @Override
                    public void onError(String errorMessage) {
                        call.reject("android_geocoder_provider_unavailable");
                    }
                });
            } catch (Exception exception) {
                call.reject("android_geocoder_provider_unavailable");
            }
        } else {
            new Thread(() -> {
                try {
                    List<Address> addresses = geocoder.getFromLocation(latitude, longitude, 1);
                    resolveAddress(call, addresses);
                } catch (Exception exception) {
                    call.reject("android_geocoder_provider_unavailable");
                }
            }, "apois-reverse-geocoder").start();
        }
    }

    private void resolveAddress(PluginCall call, List<Address> addresses) {
        if (addresses == null || addresses.isEmpty() || addresses.get(0) == null) {
            call.reject("android_geocoder_empty");
            return;
        }
        Address first = addresses.get(0);
        String street = clean(first.getThoroughfare());
        String number = clean(first.getSubThoroughfare());
        String locality = clean(first.getSubLocality());
        String city = clean(first.getLocality());
        String state = clean(first.getAdminArea());
        String country = clean(first.getCountryName());
        String line = first.getMaxAddressLineIndex() >= 0 ? clean(first.getAddressLine(0)) : "";
        String shortLabel = street;
        if (!shortLabel.isEmpty() && !number.isEmpty()) shortLabel += ", " + number;
        if (shortLabel.isEmpty()) shortLabel = !locality.isEmpty() ? locality : city;
        String address = line;
        if (address.isEmpty()) {
            StringBuilder parts = new StringBuilder();
            for (String part : new String[]{shortLabel, locality, city, state, country}) {
                if (part.isEmpty()) continue;
                if (parts.toString().contains(part)) continue;
                if (parts.length() > 0) parts.append(", ");
                parts.append(part);
            }
            address = parts.toString();
        }
        if (address.isEmpty()) {
            call.reject("android_geocoder_empty");
            return;
        }
        JSObject output = new JSObject();
        output.put("address", address);
        output.put("shortLabel", shortLabel.isEmpty() ? address.split(",")[0] : shortLabel);
        output.put("approximate", street.isEmpty());
        call.resolve(output);
    }

    private static String clean(String value) {
        return value == null ? "" : value.trim();
    }
}
