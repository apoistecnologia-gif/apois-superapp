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

function validateGoogleKey(value, envName, label) {
  requireOrWarn(Boolean(value), `${label} disponível`);
  if (!value) return;
  if (/^(AIza)[A-Za-z0-9_-]{20,}$/.test(value)) ok(`${label} tem formato plausível`);
  else fail(`${envName} não parece uma chave Google válida`);
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

const publicAppUrl = process.env.CORRIDAS_PUBLIC_APP_URL?.trim() || '';
requireOrWarn(Boolean(publicAppUrl), 'URL pública de acompanhamento de Corridas disponível');
if (publicAppUrl) {
  try {
    const parsed = new URL(publicAppUrl);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      fail('CORRIDAS_PUBLIC_APP_URL deve usar http/https');
    } else if (strict && parsed.protocol !== 'https:') {
      fail('CORRIDAS_PUBLIC_APP_URL deve usar HTTPS em modo estrito');
    } else {
      ok(`URL pública de acompanhamento válida: ${parsed.hostname}`);
    }
  } catch {
    fail('CORRIDAS_PUBLIC_APP_URL não é uma URL válida');
  }
}

const androidMapsKey = process.env.CORRIDAS_ANDROID_MAPS_API_KEY?.trim() || '';
const webMapsKey = process.env.CORRIDAS_WEB_MAPS_API_KEY?.trim() || '';
validateGoogleKey(androidMapsKey, 'CORRIDAS_ANDROID_MAPS_API_KEY', 'Google Maps Android key do Superapp');
validateGoogleKey(webMapsKey, 'CORRIDAS_WEB_MAPS_API_KEY', 'Google Maps JavaScript/Places key do Superapp');

if (androidMapsKey && webMapsKey && androidMapsKey === webMapsKey) {
  warn('Maps Android e Maps JavaScript estão usando a mesma chave. Para produção, use credenciais separadas com restrições diferentes.');
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
