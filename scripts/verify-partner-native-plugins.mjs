import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const packagePath = resolve('superapp/partner-shell/package.json');
const registryPath = resolve('superapp/partner-shell/android/app/src/main/assets/capacitor.plugins.json');

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

console.log('[OK] APOIS Parceiro: App, Browser, Geolocation e PushNotifications estão instalados no host e registrados no Android.');
