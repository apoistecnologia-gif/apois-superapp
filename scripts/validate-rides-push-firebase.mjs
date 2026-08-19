const ridesPushEnabled = process.env.APOIS_SUPERAPP_RIDES_PUSH_ENABLED === '1';

if (!ridesPushEnabled) {
  console.log('[OK] Corridas Push permanece desligado; compatibilidade Firebase server-side não é exigida neste build.');
  process.exit(0);
}

const expectedProjectId = process.env.CORRIDAS_FIREBASE_PROJECT_ID?.trim() || '';
const firebaseB64 = process.env.FIREBASE_SUPERAPP_GOOGLE_SERVICES_JSON_BASE64?.trim() || '';

if (!expectedProjectId) {
  console.error('[FAIL] APOIS_SUPERAPP_RIDES_PUSH_ENABLED=1 exige CORRIDAS_FIREBASE_PROJECT_ID do service account usado por send-ride-push.');
  process.exit(1);
}
if (!firebaseB64) {
  console.error('[FAIL] Push de Corridas habilitado sem FIREBASE_SUPERAPP_GOOGLE_SERVICES_JSON_BASE64.');
  process.exit(1);
}

let mobileProjectId = '';
try {
  const googleServices = JSON.parse(Buffer.from(firebaseB64, 'base64').toString('utf8'));
  mobileProjectId = String(googleServices?.project_info?.project_id ?? '').trim();
} catch (error) {
  console.error(`[FAIL] google-services.json unificado inválido: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}

if (!mobileProjectId) {
  console.error('[FAIL] google-services.json unificado não informa project_info.project_id.');
  process.exit(1);
}
if (mobileProjectId !== expectedProjectId) {
  console.error(`[FAIL] Firebase incompatível: APK usa ${mobileProjectId}, mas send-ride-push usa ${expectedProjectId}. Push de Corridas não pode ser habilitado.`);
  process.exit(1);
}

console.log(`[OK] Push de Corridas pode ser habilitado: Firebase mobile e server-side usam ${mobileProjectId}.`);
