import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const javaRoot = resolve('superapp/partner-shell/android/app/src/main/java/br/com/apois/parceiro');
const driverPluginPath = resolve(javaRoot, 'DriverLocationPlugin.java');
const driverServicePath = resolve(javaRoot, 'DriverLocationService.java');
const courierPluginPath = resolve(javaRoot, 'CourierLocationPlugin.java');
const courierServicePath = resolve(javaRoot, 'CourierLocationService.java');

for (const path of [driverPluginPath, driverServicePath, courierPluginPath, courierServicePath]) {
  if (!existsSync(path)) throw new Error(`APOIS Parceiro: runtime nativo ausente para startup ACK: ${path}`);
}

// DriverLocation já é materializado pelo instalador com ACK real. Validamos aqui
// porque este hardener roda depois dos dois instaladores e enxerga o Java final.
const driverPlugin = readFileSync(driverPluginPath, 'utf8');
const driverService = readFileSync(driverServicePath, 'utf8');
for (const marker of [
  'STARTUP_KEY = "driver_running"',
  'STARTUP_ACK_DELAY_MS = 900L',
  'startup.getBoolean(STARTUP_KEY, false)',
  'O serviço de localização do motorista não confirmou a inicialização.',
]) {
  if (!driverPlugin.includes(marker)) throw new Error(`APOIS Parceiro: DriverLocation ainda confirma start sem ACK real (${marker}).`);
}
for (const marker of ['setStartupConfirmed(true);', 'setStartupConfirmed(false);']) {
  if (!driverService.includes(marker)) throw new Error(`APOIS Parceiro: DriverLocationService não publica estado real (${marker}).`);
}

let courierPlugin = readFileSync(courierPluginPath, 'utf8');
let courierService = readFileSync(courierServicePath, 'utf8');

if (!courierPlugin.includes('STARTUP_KEY = "courier_running"')) {
  courierPlugin = courierPlugin
    .replace(
      'import android.content.Intent;\n',
      'import android.content.Intent;\nimport android.content.SharedPreferences;\nimport android.os.Handler;\nimport android.os.Looper;\n',
    )
    .replace(
      'public class CourierLocationPlugin extends Plugin {',
      'public class CourierLocationPlugin extends Plugin {\n    private static final String STARTUP_PREFS = "apois_partner_location_service_status";\n    private static final String STARTUP_KEY = "courier_running";\n    private static final long STARTUP_ACK_DELAY_MS = 900L;',
    )
    .replace(
      `        ContextCompat.startForegroundService(getContext(), intent);\n        JSObject result = new JSObject();\n        result.put("started", true);\n        call.resolve(result);`,
      `        SharedPreferences startup = getContext().getSharedPreferences(STARTUP_PREFS, android.content.Context.MODE_PRIVATE);\n        startup.edit().putBoolean(STARTUP_KEY, false).commit();\n        try {\n            ContextCompat.startForegroundService(getContext(), intent);\n        } catch (Exception startError) {\n            call.reject("Não foi possível iniciar a localização do entregador em segundo plano.", startError);\n            return;\n        }\n        new Handler(Looper.getMainLooper()).postDelayed(() -> {\n            boolean started = startup.getBoolean(STARTUP_KEY, false);\n            if (!started) {\n                call.reject("O serviço de localização do entregador não confirmou a inicialização.");\n                return;\n            }\n            JSObject result = new JSObject();\n            result.put("started", true);\n            call.resolve(result);\n        }, STARTUP_ACK_DELAY_MS);`,
    );
}

if (!courierService.includes('STARTUP_KEY = "courier_running"')) {
  courierService = courierService
    .replace(
      'import android.content.Intent;\n',
      'import android.content.Intent;\nimport android.content.SharedPreferences;\n',
    )
    .replace(
      'public class CourierLocationService extends Service {',
      'public class CourierLocationService extends Service {\n    private static final String STARTUP_PREFS = "apois_partner_location_service_status";\n    private static final String STARTUP_KEY = "courier_running";',
    )
    .replace(
      `        if (supabaseUrl.isEmpty() || publishableKey.isEmpty() || accessToken.isEmpty()) {\n            stopSelf();`,
      `        if (supabaseUrl.isEmpty() || publishableKey.isEmpty() || accessToken.isEmpty()) {\n            setStartupConfirmed(false);\n            stopSelf();`,
    )
    .replace(
      '    private void startLocationUpdates() {\n        if (tracking) return;',
      '    private void startLocationUpdates() {\n        if (tracking) { setStartupConfirmed(true); return; }',
    )
    .replace(
      '        if (!fine && !coarse) { stopSelf(); return; }',
      '        if (!fine && !coarse) { setStartupConfirmed(false); stopSelf(); return; }',
    )
    .replace(
      `            tracking = true;\n            fusedLocationClient.requestLocationUpdates(request, locationCallback, Looper.getMainLooper());`,
      `            tracking = true;\n            fusedLocationClient.requestLocationUpdates(request, locationCallback, Looper.getMainLooper());\n            setStartupConfirmed(true);`,
    )
    .replace(
      `        } catch (SecurityException error) {\n            tracking = false;\n            stopSelf();`,
      `        } catch (SecurityException error) {\n            tracking = false;\n            setStartupConfirmed(false);\n            stopSelf();`,
    )
    .replace(
      '    private void stopTracking() {\n        tracking = false;',
      '    private void stopTracking() {\n        setStartupConfirmed(false);\n        tracking = false;',
    )
    .replace(
      '    private boolean syncLocation(Location location, boolean allowRefresh) {',
      '    private void setStartupConfirmed(boolean running) {\n        getSharedPreferences(STARTUP_PREFS, MODE_PRIVATE).edit().putBoolean(STARTUP_KEY, running).commit();\n    }\n\n    private boolean syncLocation(Location location, boolean allowRefresh) {',
    )
    .replace(
      '    @Override public void onDestroy() {\n        tracking = false;',
      '    @Override public void onDestroy() {\n        setStartupConfirmed(false);\n        tracking = false;',
    );
}

for (const marker of [
  'STARTUP_KEY = "courier_running"',
  'STARTUP_ACK_DELAY_MS = 900L',
  'startup.edit().putBoolean(STARTUP_KEY, false).commit()',
  'startup.getBoolean(STARTUP_KEY, false)',
  'O serviço de localização do entregador não confirmou a inicialização.',
]) {
  if (!courierPlugin.includes(marker)) throw new Error(`APOIS Parceiro: CourierLocationPlugin ACK incompleto (${marker}).`);
}
for (const marker of [
  'STARTUP_KEY = "courier_running"',
  'private void setStartupConfirmed(boolean running)',
  'setStartupConfirmed(true);',
  'setStartupConfirmed(false);',
]) {
  if (!courierService.includes(marker)) throw new Error(`APOIS Parceiro: CourierLocationService ACK incompleto (${marker}).`);
}

writeFileSync(courierPluginPath, courierPlugin, 'utf8');
writeFileSync(courierServicePath, courierService, 'utf8');

// Uma única leitura em 900 ms podia gerar falso negativo em aparelhos lentos.
// O retry é aplicado somente depois que os dois plugins/Services existem.
await import('./harden-partner-location-startup-retry.mjs');

console.log('[OK] APOIS Parceiro: DriverLocation e CourierLocation só retornam started=true após confirmação real do Service/LocationUpdates, com retry antes do fail-safe.');
