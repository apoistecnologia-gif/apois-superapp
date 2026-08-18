const APP_PACKAGE = process.env.APP_PACKAGE?.trim() || 'br.com.apois.app';
const EXPECTED_SHA1 = (process.env.EXPECTED_SIGNING_SHA1 || '').trim();
const strict = process.env.APOIS_STRICT_NATIVE_CONFIG === '1';

let failures = 0;
let warnings = 0;

function ok(message) {
  console.log(`[OK] ${message}`);
}

function warn(message) {
  warnings += 1;
  console.warn(`[WARN] ${message}`);
}

function fail(message) {
  failures += 1;
  console.error(`[FAIL] ${message}`);
}

function requireOrWarn(condition, message) {
  if (condition) ok(message);
  else if (strict) fail(message);
  else warn(message);
}

if (!/^([A-Za-z][A-Za-z0-9_]*\.)+[A-Za-z][A-Za-z0-9_]*$/.test(APP_PACKAGE)) {
  fail(`package Android inválido: ${APP_PACKAGE}`);
} else {
  ok(`package Android válido: ${APP_PACKAGE}`);
}

if (EXPECTED_SHA1) {
  if (/^(?:[0-9A-Fa-f]{2}:){19}[0-9A-Fa-f]{2}$/.test(EXPECTED_SHA1)) {
    ok('SHA-1 de assinatura está em formato válido');
  } else {
    fail('EXPECTED_SIGNING_SHA1 está em formato inválido');
  }
}

const mapsKey = process.env.CORRIDAS_ANDROID_MAPS_API_KEY?.trim() || '';
requireOrWarn(Boolean(mapsKey), 'Google Maps API key disponível para o package unificado');
if (mapsKey) {
  if (/^(AIza)[A-Za-z0-9_-]{20,}$/.test(mapsKey)) ok('Google Maps API key tem formato plausível');
  else fail('CORRIDAS_ANDROID_MAPS_API_KEY não parece uma chave Google válida');
}

const firebaseB64 = process.env.FIREBASE_SUPERAPP_GOOGLE_SERVICES_JSON_BASE64?.trim() || '';
requireOrWarn(Boolean(firebaseB64), 'Firebase google-services.json disponível para o package unificado');

if (firebaseB64) {
  try {
    const decoded = Buffer.from(firebaseB64, 'base64').toString('utf8');
    const json = JSON.parse(decoded);
    const clients = Array.isArray(json?.client) ? json.client : [];
    const packages = clients
      .map((client) => client?.client_info?.android_client_info?.package_name)
      .filter(Boolean);

    if (!packages.includes(APP_PACKAGE)) {
      fail(`google-services.json não contém o package ${APP_PACKAGE}; encontrados: ${packages.join(', ') || 'nenhum'}`);
    } else {
      ok(`google-services.json contém o package ${APP_PACKAGE}`);
    }

    const projectId = json?.project_info?.project_id;
    const projectNumber = json?.project_info?.project_number;
    if (projectId && projectNumber) ok(`Firebase identificado: ${projectId}`);
    else fail('google-services.json não contém project_id/project_number válidos');
  } catch (error) {
    fail(`FIREBASE_SUPERAPP_GOOGLE_SERVICES_JSON_BASE64 inválido: ${error instanceof Error ? error.message : String(error)}`);
  }
}

if (failures > 0) {
  console.error(`[FAIL] configuração nativa do Superapp possui ${failures} erro(s) e ${warnings} aviso(s)`);
  process.exit(1);
}

console.log(`[OK] validação nativa concluída com ${warnings} aviso(s)${strict ? ' em modo estrito' : ''}`);
