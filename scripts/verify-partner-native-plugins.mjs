import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const packagePath = resolve('superapp/partner-shell/package.json');
const registryPath = resolve('superapp/partner-shell/android/app/src/main/assets/capacitor.plugins.json');
const javaRoot = resolve('superapp/partner-shell/android/app/src/main/java/br/com/apois/parceiro');
const mainActivityPath = resolve(javaRoot, 'MainActivity.java');
const driverPluginPath = resolve(javaRoot, 'DriverLocationPlugin.java');
const driverServicePath = resolve(javaRoot, 'DriverLocationService.java');
const courierPluginPath = resolve(javaRoot, 'CourierLocationPlugin.java');
const courierServicePath = resolve(javaRoot, 'CourierLocationService.java');

if (!existsSync(packagePath)) throw new Error('package.json do host APOIS Parceiro não encontrado.');
const pkg = JSON.parse(readFileSync(packagePath, 'utf8'));
const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };

const requiredPackages = [
  '@capacitor/app',
  '@capacitor/browser',
  '@capacitor/geolocation',
  '@capacitor/push-notifications',
];
for (const dependency of requiredPackages) {
  if (!deps[dependency]) {
    throw new Error(`APOIS Parceiro: plugin nativo obrigatório ausente do host: ${dependency}`);
  }
}

if (!existsSync(registryPath)) {
  throw new Error('APOIS Parceiro: capacitor.plugins.json ausente após cap sync.');
}
const registry = readFileSync(registryPath, 'utf8');
for (const marker of [
  'AppPlugin',
  'BrowserPlugin',
  'GeolocationPlugin',
  'PushNotificationsPlugin',
]) {
  if (!registry.includes(marker)) {
    throw new Error(`APOIS Parceiro: plugin ${marker} não foi registrado no Android pelo cap sync.`);
  }
}

for (const path of [mainActivityPath, driverPluginPath, driverServicePath, courierPluginPath, courierServicePath]) {
  if (!existsSync(path)) throw new Error(`APOIS Parceiro: runtime nativo customizado ausente após instalação: ${path}`);
}
const mainActivity = readFileSync(mainActivityPath, 'utf8');
for (const marker of [
  'registerPlugin(DriverVoicePlugin.class)',
  'registerPlugin(DriverLocationPlugin.class)',
  'registerPlugin(CourierLocationPlugin.class)',
]) {
  if (!mainActivity.includes(marker)) throw new Error(`APOIS Parceiro: MainActivity não registrou plugin customizado (${marker}).`);
}

const customRuntimes = [
  ['Motorista', readFileSync(driverPluginPath, 'utf8'), readFileSync(driverServicePath, 'utf8'), 'driver_running'],
  ['Entregador', readFileSync(courierPluginPath, 'utf8'), readFileSync(courierServicePath, 'utf8'), 'courier_running'],
];
for (const [label, plugin, service, startupKey] of customRuntimes) {
  if (!plugin.includes(`STARTUP_KEY = "${startupKey}"`) || !plugin.includes('startup.getBoolean(STARTUP_KEY, false)')) {
    throw new Error(`APOIS Parceiro: ${label} pode confirmar localização em background antes do Service iniciar.`);
  }
  for (const marker of [
    'STARTUP_ACK_MAX_ATTEMPTS = 4',
    'private void resolveStartup(PluginCall call, SharedPreferences startup, int attempt)',
    'attempt >= STARTUP_ACK_MAX_ATTEMPTS',
    '() -> resolveStartup(call, startup, attempt + 1)',
  ]) {
    if (!plugin.includes(marker)) {
      throw new Error(`APOIS Parceiro: ${label} não tolera startup lento do Foreground Service (${marker}).`);
    }
  }
  if (!service.includes('setStartupConfirmed(true);') || !service.includes('setStartupConfirmed(false);')) {
    throw new Error(`APOIS Parceiro: ${label} não publica corretamente o estado real do Foreground Service.`);
  }
  if (!service.includes('FOREGROUND_SERVICE_TYPE_LOCATION')) {
    throw new Error(`APOIS Parceiro: ${label} não usa foregroundServiceType location.`);
  }
  for (const marker of [
    'public void session(PluginCall call)',
    'public void updateSession(PluginCall call)',
    'result.put("updated", true)',
    'apois_partner_location_session',
  ]) {
    if (!plugin.includes(marker)) {
      throw new Error(`APOIS Parceiro: ${label} não permite reconciliar/atualizar a sessão nativa (${marker}).`);
    }
  }
  for (const marker of [
    'private void persistSessionTokens()',
    'private void loadPersistedSessionTokens()',
    'loadPersistedSessionTokens();',
    'persistSessionTokens();',
  ]) {
    if (!service.includes(marker)) {
      throw new Error(`APOIS Parceiro: ${label} não recarrega/persiste tokens atuais antes das RPCs (${marker}).`);
    }
  }
  if (!plugin.includes('remove(SESSION_ACCESS_KEY)') || !plugin.includes('remove(SESSION_REFRESH_KEY)')) {
    throw new Error(`APOIS Parceiro: ${label} mantém tokens nativos depois do stop explícito.`);
  }
}

console.log('[OK] APOIS Parceiro: plugins nativos registrados; GPS confirma start com retry, atualiza sessão sem reiniciar FGS e limpa credenciais no stop.');
