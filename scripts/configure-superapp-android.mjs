import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const APP_PACKAGE = process.env.APP_PACKAGE?.trim() || 'br.com.apois.superapp';
const androidRoot = resolve('superapp/shell/android');
const appRoot = join(androidRoot, 'app');
const manifestPath = join(appRoot, 'src/main/AndroidManifest.xml');
let xml = readFileSync(manifestPath, 'utf8');

const permissions = [
  'android.permission.ACCESS_COARSE_LOCATION',
  'android.permission.ACCESS_FINE_LOCATION',
  'android.permission.POST_NOTIFICATIONS',
];
for (const permission of permissions) {
  if (!xml.includes(`android.permission.${permission.split('.').pop()}`)) {
    xml = xml.replace('<application', `    <uses-permission android:name="${permission}" />\n\n    <application`);
  }
}

xml = xml.replace(/package="[^"]+"/, `package="${APP_PACKAGE}"`);
writeFileSync(manifestPath, xml);

const gradlePath = join(appRoot, 'build.gradle');
if (existsSync(gradlePath)) {
  let gradle = readFileSync(gradlePath, 'utf8');
  gradle = gradle.replace(/applicationId\s+['\"][^'\"]+['\"]/, `applicationId '${APP_PACKAGE}'`);
  writeFileSync(gradlePath, gradle);
}

const variablesPath = join(androidRoot, 'variables.gradle');
if (existsSync(variablesPath)) {
  let variables = readFileSync(variablesPath, 'utf8');
  variables = variables.replace(/APP_ID\s*=\s*['\"][^'\"]+['\"]/, `APP_ID = '${APP_PACKAGE}'`);
  writeFileSync(variablesPath, variables);
}

console.log(`[OK] SuperApp Android configurado com package ${APP_PACKAGE}`);
