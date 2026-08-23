import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const packageName = process.env.PARTNER_APP_PACKAGE?.trim() || 'br.com.apois.parceiro';
const expectedProjectId = process.env.PARTNER_FIREBASE_PROJECT_ID?.trim() || 'movvi-4d041';
const firebaseInput = process.env.FIREBASE_PARTNER_GOOGLE_SERVICES_JSON_BASE64?.trim();
const appRoot = resolve('superapp/partner-shell/android/app');
const gradlePath = join(appRoot, 'build.gradle');

if (!firebaseInput) {
  throw new Error('FIREBASE_PARTNER_GOOGLE_SERVICES_JSON_BASE64 é obrigatório: o Entregador não pode ficar online sem registrar Push FCM.');
}
if (!existsSync(gradlePath)) throw new Error(`build.gradle do APOIS Parceiro ausente: ${gradlePath}`);
const gradle = readFileSync(gradlePath, 'utf8');
if (!gradle.includes("apply plugin: 'com.google.gms.google-services'") || !gradle.includes("file('google-services.json')")) {
  throw new Error('Projeto Android Parceiro não contém o hook Google Services esperado pelo Capacitor.');
}

function parseFirebaseConfig(input) {
  const attempts = [];
  const addAttempt = (label, text) => {
    const value = String(text ?? '').replace(/^\uFEFF/, '').trim();
    if (!value || attempts.some((entry) => entry.value === value)) return;
    attempts.push({ label, value });
  };

  // Codemagic pode guardar o conteúdo do google-services.json diretamente em uma
  // variável segura, mesmo quando o nome histórico da variável termina em BASE64.
  addAttempt('JSON direto', input);

  // Também aceite uma string JSON encapsulada (por exemplo, valor copiado com aspas).
  try {
    const unwrapped = JSON.parse(input);
    if (typeof unwrapped === 'string') addAttempt('JSON encapsulado', unwrapped);
  } catch {
    // Não era uma string JSON encapsulada; prossiga para Base64.
  }

  // Formato originalmente esperado pelo workflow.
  try {
    addAttempt('Base64', Buffer.from(input.replace(/\s+/g, ''), 'base64').toString('utf8'));
  } catch {
    // Buffer.from normalmente não lança para Base64 malformado; a validação JSON abaixo decide.
  }

  const errors = [];
  for (const attempt of attempts) {
    try {
      const parsed = JSON.parse(attempt.value);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return { config: parsed, format: attempt.label };
      }
      errors.push(`${attempt.label}: conteúdo JSON não é um objeto`);
    } catch (error) {
      errors.push(`${attempt.label}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  throw new Error(`Firebase do APOIS Parceiro inválido. Aceitos: conteúdo JSON direto ou Base64 do google-services.json. ${errors.join(' | ')}`);
}

const { config, format } = parseFirebaseConfig(firebaseInput);

const projectId = String(config?.project_info?.project_id ?? '').trim();
if (!projectId || projectId !== expectedProjectId) {
  throw new Error(`Firebase do APOIS Parceiro deve usar o projeto ${expectedProjectId}; recebido: ${projectId || 'ausente'}. Motorista e Entregador compartilham o mesmo token FCM nativo.`);
}

const packages = (Array.isArray(config?.client) ? config.client : [])
  .map((client) => client?.client_info?.android_client_info?.package_name)
  .filter(Boolean);
if (!packages.includes(packageName)) {
  throw new Error(`google-services.json do Parceiro não contém ${packageName}; encontrados: ${packages.join(', ') || 'nenhum'}`);
}

writeFileSync(join(appRoot, 'google-services.json'), `${JSON.stringify(config, null, 2)}\n`, 'utf8');
console.log(`[OK] Firebase ${projectId} materializado para ${packageName} (${format}); Motorista e Entregador usam o mesmo projeto FCM do ecossistema.`);
