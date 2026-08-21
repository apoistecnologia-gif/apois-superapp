import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const packageName = process.env.PARTNER_APP_PACKAGE?.trim() || 'br.com.apois.parceiro';
const expectedProjectId = process.env.PARTNER_FIREBASE_PROJECT_ID?.trim() || 'movvi-4d041';
const firebaseB64 = process.env.FIREBASE_PARTNER_GOOGLE_SERVICES_JSON_BASE64?.trim();
const appRoot = resolve('superapp/partner-shell/android/app');
const gradlePath = join(appRoot, 'build.gradle');

if (!firebaseB64) {
  throw new Error('FIREBASE_PARTNER_GOOGLE_SERVICES_JSON_BASE64 é obrigatório: o Entregador não pode ficar online sem registrar Push FCM.');
}
if (!existsSync(gradlePath)) throw new Error(`build.gradle do APOIS Parceiro ausente: ${gradlePath}`);
const gradle = readFileSync(gradlePath, 'utf8');
if (!gradle.includes("apply plugin: 'com.google.gms.google-services'") || !gradle.includes("file('google-services.json')")) {
  throw new Error('Projeto Android Parceiro não contém o hook Google Services esperado pelo Capacitor.');
}

let config;
try {
  config = JSON.parse(Buffer.from(firebaseB64, 'base64').toString('utf8'));
} catch (error) {
  throw new Error(`Firebase do APOIS Parceiro inválido: ${error instanceof Error ? error.message : String(error)}`);
}

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
console.log(`[OK] Firebase ${projectId} materializado para ${packageName}; Motorista e Entregador usam o mesmo projeto FCM do ecossistema.`);
