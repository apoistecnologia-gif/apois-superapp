import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const manifestPath = resolve('superapp/shell/android/app/src/main/AndroidManifest.xml');
let xml = readFileSync(manifestPath, 'utf8');

const permissions = [
  'android.permission.ACCESS_FINE_LOCATION',
  'android.permission.ACCESS_COARSE_LOCATION',
  'android.permission.POST_NOTIFICATIONS',
];

for (const permission of permissions) {
  if (!xml.includes(permission)) {
    xml = xml.replace(
      '<application',
      `    <uses-permission android:name="${permission}" />\n\n    <application`,
    );
  }
}

if (!xml.includes('android:scheme="br.com.apois.app"')) {
  const marker = '</activity>';
  const intentFilter = `
            <intent-filter android:autoVerify="false">
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.BROWSABLE" />
                <data android:scheme="br.com.apois.app" android:host="auth" />
            </intent-filter>
`;
  xml = xml.replace(marker, `${intentFilter}        ${marker}`);
}

const mapsKey = process.env.CORRIDAS_ANDROID_MAPS_API_KEY?.trim();
if (mapsKey && !xml.includes('com.google.android.geo.API_KEY')) {
  xml = xml.replace(
    '</application>',
    `        <meta-data android:name="com.google.android.geo.API_KEY" android:value="${mapsKey.replaceAll('&', '&amp;').replaceAll('"', '&quot;')}" />\n    </application>`,
  );
}

writeFileSync(manifestPath, xml);
console.log('[OK] AndroidManifest do APOIS Superapp configurado.');
